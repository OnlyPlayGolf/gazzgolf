import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Send, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ScorecardCommentsSheet } from "@/components/ScorecardCommentsSheet";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { GameHeader } from "@/components/GameHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Comment {
  id: string;
  content: string;
  hole_number: number | null;
  user_id: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  likes_count: number;
  replies_count: number;
  user_has_liked: boolean;
  is_activity_item: boolean;
  scorecard_player_name: string | null;
}

interface Reply {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export default function WolfFeed() {
  const { gameId } = useParams();
  const { toast } = useToast();
  const { isSpectator, isLoading: isSpectatorLoading, isEditWindowExpired } = useIsSpectator('wolf', gameId);
  const [gameData, setGameData] = useState<{ round_name: string | null; course_name: string } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<Map<string, Reply[]>>(new Map());
  const [replyText, setReplyText] = useState<Map<string, string>>(new Map());
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [commentsSheetOpen, setCommentsSheetOpen] = useState(false);
  const [selectedScorecardPlayerName, setSelectedScorecardPlayerName] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [showDeleteCommentDialog, setShowDeleteCommentDialog] = useState(false);

  useEffect(() => {
    const fetchGameData = async () => {
      if (!gameId) return;
      const { data } = await supabase
        .from("wolf_games" as any)
        .select("round_name, course_name")
        .eq("id", gameId)
        .single();
      if (data) setGameData(data as unknown as { round_name: string | null; course_name: string });
    };
    fetchGameData();
  }, [gameId]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (gameId) {
      fetchComments();
    }
  }, [gameId, currentUserId]);

  const fetchComments = async () => {
    if (!gameId) return;
    
    try {
      // Fetch comments for this wolf game
      const { data: commentsData, error } = await supabase
        .from("round_comments")
        .select("id, content, hole_number, user_id, created_at, is_activity_item, scorecard_player_name")
        .eq("game_id", gameId)
        .eq("game_type", "wolf")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter: show activity items OR regular feed comments (exclude scorecard-thread comments that aren't activity items)
      const filteredComments = (commentsData || []).filter(c =>
        c.is_activity_item || !c.scorecard_player_name
      );

      // Get unique user IDs and fetch profiles
      const userIds = [...new Set(filteredComments.map(c => c.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Batch fetch all likes, replies, and user likes in parallel
      const commentIds = filteredComments.map(c => c.id);
      
      const [likesResult, repliesResult, userLikesResult] = await Promise.all([
        commentIds.length > 0
          ? supabase
              .from("round_comment_likes")
              .select("comment_id")
              .in("comment_id", commentIds)
          : Promise.resolve({ data: [] }),
        commentIds.length > 0
          ? supabase
              .from("round_comment_replies")
              .select("comment_id")
              .in("comment_id", commentIds)
          : Promise.resolve({ data: [] }),
        currentUserId && commentIds.length > 0
          ? supabase
              .from("round_comment_likes")
              .select("comment_id")
              .in("comment_id", commentIds)
              .eq("user_id", currentUserId)
          : Promise.resolve({ data: [] })
      ]);

      const likesCountMap = new Map<string, number>();
      likesResult.data?.forEach(like => {
        likesCountMap.set(like.comment_id, (likesCountMap.get(like.comment_id) || 0) + 1);
      });

      const repliesCountMap = new Map<string, number>();
      repliesResult.data?.forEach(reply => {
        repliesCountMap.set(reply.comment_id, (repliesCountMap.get(reply.comment_id) || 0) + 1);
      });

      const userLikesSet = new Set(userLikesResult.data?.map(like => like.comment_id) || []);

      const commentsWithCounts = filteredComments.map(comment => ({
        ...comment,
        profiles: profilesMap.get(comment.user_id) || null,
        likes_count: likesCountMap.get(comment.id) || 0,
        replies_count: repliesCountMap.get(comment.id) || 0,
        user_has_liked: userLikesSet.has(comment.id),
        is_activity_item: comment.is_activity_item || false,
        scorecard_player_name: comment.scorecard_player_name || null,
      }));

      setComments(commentsWithCounts);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !gameId || !currentUserId) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.from("round_comments").insert({
        round_id: gameId,
        game_id: gameId,
        user_id: currentUserId,
        content: newComment.trim(),
        game_type: "wolf",
      }).select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error("Comment was not saved. Please try again.");
      }

      setNewComment("");
      fetchComments();
      toast({ title: "Comment posted" });
    } catch (error: any) {
      console.error("Error posting comment:", error);
      toast({ title: "Error posting comment", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (commentId: string, hasLiked: boolean) => {
    if (!currentUserId) return;

    try {
      if (hasLiked) {
        await supabase
          .from("round_comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", currentUserId);
      } else {
        await supabase.from("round_comment_likes").insert({
          comment_id: commentId,
          user_id: currentUserId,
        });
      }
      fetchComments();
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const toggleReplies = async (commentId: string) => {
    const newExpanded = new Set(expandedReplies);
    
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
    } else {
      newExpanded.add(commentId);
      // Fetch replies if not already loaded
      if (!replies.has(commentId)) {
        const { data: repliesData } = await supabase
          .from("round_comment_replies")
          .select("id, content, user_id, created_at")
          .eq("comment_id", commentId)
          .order("created_at", { ascending: true });

        if (repliesData) {
          // Fetch profiles for replies
          const userIds = [...new Set(repliesData.map(r => r.user_id))];
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url")
            .in("id", userIds);

          const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

          setReplies(prev => new Map(prev).set(commentId, repliesData.map(r => ({
            ...r,
            profiles: profilesMap.get(r.user_id) || null
          }))));
        }
      }
    }
    setExpandedReplies(newExpanded);
  };

  const handleSubmitReply = async (commentId: string) => {
    const text = replyText.get(commentId)?.trim();
    if (!text || !currentUserId) return;

    try {
      const { error } = await supabase.from("round_comment_replies").insert({
        comment_id: commentId,
        user_id: currentUserId,
        content: text,
      });

      if (error) throw error;

      setReplyText(prev => new Map(prev).set(commentId, ""));
      
      // Refresh replies
      const { data: repliesData } = await supabase
        .from("round_comment_replies")
        .select("id, content, user_id, created_at")
        .eq("comment_id", commentId)
        .order("created_at", { ascending: true });

      if (repliesData) {
        const userIds = [...new Set(repliesData.map(r => r.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

        setReplies(prev => new Map(prev).set(commentId, repliesData.map(r => ({
          ...r,
          profiles: profilesMap.get(r.user_id) || null
        }))));
      }
      fetchComments();
    } catch (error: any) {
      toast({ title: "Error posting reply", description: error.message, variant: "destructive" });
    }
  };

  const getDisplayName = (profiles: Comment["profiles"] | Reply["profiles"]) => {
    return profiles?.display_name || profiles?.username || "Player";
  };

  const getInitials = (profiles: Comment["profiles"] | Reply["profiles"]) => {
    const name = getDisplayName(profiles);
    return name.substring(0, 2).toUpperCase();
  };

  const handleEditComment = (commentId: string, currentContent: string) => {
    setEditingCommentId(commentId);
    setEditCommentContent(currentContent);
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!editCommentContent.trim() || !currentUserId) return;

    try {
      const { error } = await supabase
        .from("round_comments")
        .update({ content: editCommentContent.trim() })
        .eq("id", commentId)
        .eq("user_id", currentUserId);

      if (error) throw error;

      setComments(prevComments =>
        prevComments.map(comment =>
          comment.id === commentId
            ? { ...comment, content: editCommentContent.trim() }
            : comment
        )
      );

      setEditingCommentId(null);
      setEditCommentContent("");
      toast({ title: "Comment updated" });
    } catch (error: any) {
      console.error("Error updating comment:", error);
      toast({ title: "Error updating comment", description: error.message, variant: "destructive" });
      await fetchComments();
    }
  };

  const handleDeleteComment = (commentId: string) => {
    setCommentToDelete(commentId);
    setShowDeleteCommentDialog(true);
  };

  const handleDeleteCommentConfirm = async () => {
    if (!commentToDelete || !currentUserId) return;

    try {
      const { error } = await supabase
        .from("round_comments")
        .delete()
        .eq("id", commentToDelete)
        .eq("user_id", currentUserId);

      if (error) throw error;

      await fetchComments();
      toast({ title: "Comment deleted" });
      setShowDeleteCommentDialog(false);
      setCommentToDelete(null);
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      toast({ title: "Error deleting comment", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={gameData?.round_name || "Wolf"}
        courseName={gameData?.course_name || ""}
        pageTitle="Game feed"
      />
      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* New Comment Box */}
        {currentUserId && (
          <Card>
            <CardContent className="p-4">
              <Textarea
                ref={commentTextareaRef}
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  const textarea = commentTextareaRef.current;
                  if (textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
                  }
                }}
                className="min-h-[2.5rem] resize-none overflow-hidden mb-3"
                rows={1}
              />
              <Button 
                onClick={handleSubmitComment} 
                disabled={!newComment.trim() || submitting}
                className="w-full"
              >
                <Send size={16} className="mr-2" />
                Post Comment
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Comments List */}
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : comments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageCircle className="mx-auto text-muted-foreground mb-4" size={48} />
              <h2 className="text-lg font-semibold mb-2">No comments yet</h2>
              <p className="text-sm text-muted-foreground">
                Be the first to comment on this game!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => {
              // Activity items (e.g., "X commented on Y's scorecard") - render as clickable
              if (comment.is_activity_item && comment.scorecard_player_name) {
                // Build the activity header dynamically from profile and scorecard_player_name
                const commenterName = getDisplayName(comment.profiles);
                const activityHeader = `${commenterName} commented on ${comment.scorecard_player_name}'s scorecard`;
                
                // The content is the actual comment text (handle legacy format too)
                let commentText = comment.content;
                if (comment.content.includes("|||COMMENT_TEXT:")) {
                  const parts = comment.content.split("|||COMMENT_TEXT:");
                  commentText = parts[1]?.trim() || "";
                } else if (comment.content.includes(" commented on ") && comment.content.includes("'s scorecard")) {
                  commentText = "";
                }
                
                return (
                  <Card 
                    key={comment.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setSelectedScorecardPlayerName(comment.scorecard_player_name!);
                      setCommentsSheetOpen(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(comment.profiles)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <div className="inline-flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-full">
                            <span className="text-sm text-muted-foreground">{activityHeader}</span>
                          </div>
                          {commentText && (
                            <p className="text-sm text-foreground">{commentText}</p>
                          )}
                          <span className="text-xs text-muted-foreground block">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <ChevronRight size={20} className="text-muted-foreground flex-shrink-0 mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              // Parse mulligan comments
              const isMulliganComment = comment.content.startsWith("🔄");
              let userComment = "";
              let mulliganText = "";
              
              if (isMulliganComment) {
                // Check if there's a user comment attached: format is "🔄 Name used a mulligan on hole X: "comment""
                const colonQuoteMatch = comment.content.match(/^🔄 (.+?) used a mulligan on hole (\d+): "(.+)"$/);
                const simpleMatch = comment.content.match(/^🔄 (.+?) used a mulligan on hole (\d+)$/);
                
                if (colonQuoteMatch) {
                  const [, playerName, holeNum, extractedComment] = colonQuoteMatch;
                  userComment = extractedComment;
                  mulliganText = `${playerName} used a mulligan on hole ${holeNum}`;
                } else if (simpleMatch) {
                  const [, playerName, holeNum] = simpleMatch;
                  mulliganText = `${playerName} used a mulligan on hole ${holeNum}`;
                }
              }
              
              const isOwnComment = comment.user_id === currentUserId;
              const isEditing = editingCommentId === comment.id;

              return (
                <Card key={comment.id}>
                  <CardContent className="p-4">
                    {/* Comment Header */}
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(comment.profiles)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editCommentContent}
                              onChange={(e) => setEditCommentContent(e.target.value)}
                              className="min-h-[60px]"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveEditComment(comment.id)}
                                disabled={!editCommentContent.trim()}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditCommentContent("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{getDisplayName(comment.profiles)}</span>
                              {comment.hole_number && (
                                <Badge variant="secondary" className="text-xs">
                                  Hole {comment.hole_number}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                              </span>
                              {isOwnComment && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground ml-auto"
                                    >
                                      <MoreHorizontal size={14} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEditComment(comment.id, comment.content)}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteComment(comment.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            
                            {/* Content Display */}
                            {isMulliganComment ? (
                              <div className="mt-2 space-y-2">
                                {userComment && (
                                  <p className="text-sm">{userComment}</p>
                                )}
                                <div className="bg-muted/50 border border-border rounded-lg px-3 py-2">
                                  <p className="text-sm text-muted-foreground">{mulliganText}</p>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1 text-sm">{comment.content}</p>
                            )}
                          </>
                        )}

                        {!isEditing && (
                          <>
                            {/* Actions */}
                            <div className="flex items-center gap-4 mt-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`gap-1 ${comment.user_has_liked ? "text-red-500" : ""}`}
                                onClick={() => handleLike(comment.id, comment.user_has_liked)}
                              >
                                <Heart size={16} fill={comment.user_has_liked ? "currentColor" : "none"} />
                                {comment.likes_count > 0 && comment.likes_count}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                onClick={() => toggleReplies(comment.id)}
                              >
                                <MessageCircle size={16} />
                                {comment.replies_count > 0 && comment.replies_count}
                              </Button>
                            </div>
                          </>
                        )}

                        {/* Replies Section */}
                        {expandedReplies.has(comment.id) && (
                          <div className="mt-4 space-y-3 border-l-2 border-muted pl-4">
                            {replies.get(comment.id)?.map((reply) => (
                              <div key={reply.id} className="flex items-start gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={reply.profiles?.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">{getInitials(reply.profiles)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">{getDisplayName(reply.profiles)}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                    </span>
                                  </div>
                                  <p className="text-sm">{reply.content}</p>
                                </div>
                              </div>
                            ))}

                            {/* Reply Input */}
                            {currentUserId && (
                              <div className="flex gap-2 mt-2">
                                <Textarea
                                  placeholder="Write a reply..."
                                  value={replyText.get(comment.id) || ""}
                                  onChange={(e) => setReplyText(prev => new Map(prev).set(comment.id, e.target.value))}
                                  className="min-h-[60px]"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSubmitReply(comment.id)}
                                  disabled={!replyText.get(comment.id)?.trim()}
                                >
                                  <Send size={14} />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      {gameId && !isSpectatorLoading && <WolfBottomTabBar gameId={gameId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
      
      {/* Scorecard Comments Sheet */}
      {selectedScorecardPlayerName && (
        <ScorecardCommentsSheet
          open={commentsSheetOpen}
          onOpenChange={setCommentsSheetOpen}
          gameId={gameId || ""}
          gameType="wolf"
          scorecardPlayerId=""
          scorecardPlayerName={selectedScorecardPlayerName}
        />
      )}

      {/* Delete Comment Confirmation Dialog */}
      <AlertDialog open={showDeleteCommentDialog} onOpenChange={setShowDeleteCommentDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCommentConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
