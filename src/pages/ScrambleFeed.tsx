import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { ScrambleBottomTabBar } from "@/components/ScrambleBottomTabBar";
import { Send, ChevronRight, MoreHorizontal, Pencil, Trash2, Heart, MessageCircle } from "lucide-react";
import { ScorecardCommentsSheet } from "@/components/ScorecardCommentsSheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { GameHeader } from "@/components/GameHeader";
import { useGameAdminStatus } from "@/hooks/useGameAdminStatus";
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
  created_at: string;
  user_id: string;
  hole_number: number | null;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  is_activity_item?: boolean;
  scorecard_player_name?: string | null;
  likes_count?: number;
  replies_count?: number;
  user_has_liked?: boolean;
}

export default function ScrambleFeed() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { isSpectator, isEditWindowExpired } = useIsSpectator('scramble', gameId);
  const { isAdmin } = useGameAdminStatus('scramble', gameId);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<{ round_name: string | null; course_name: string } | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [commentsSheetOpen, setCommentsSheetOpen] = useState(false);
  const [selectedScorecardPlayerName, setSelectedScorecardPlayerName] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [showDeleteCommentDialog, setShowDeleteCommentDialog] = useState(false);

  useEffect(() => {
    if (gameId) {
      fetchComments();
      getCurrentUser();
      fetchGameData();
    }
  }, [gameId]);

  const fetchGameData = async () => {
    const { data } = await supabase
      .from("scramble_games")
      .select("round_name, course_name")
      .eq("id", gameId)
      .maybeSingle();
    if (data) setGameData(data);
  };

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchComments = async () => {
    if (!gameId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('round_comments')
        .select('*, hole_number, is_activity_item, scorecard_player_name')
        .eq('game_id', gameId)
        .eq('game_type', 'scramble')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data) {
        setComments([]);
        setLoading(false);
        return;
      }

      // Filter: show activity items OR regular feed comments (exclude scorecard-thread comments that aren't activity items)
      const filteredData = data.filter(c =>
        c.is_activity_item || !c.scorecard_player_name
      );

      if (filteredData.length === 0) {
        setComments([]);
        setLoading(false);
        return;
      }

      const commentIds = filteredData.map(c => c.id);

      // Batch fetch all data in parallel
      const [profilesResult, likesResult, repliesResult, userLikesResult] = await Promise.all([
        // Fetch profiles
        (async () => {
          const userIds = [...new Set(filteredData.map(c => c.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', userIds);
          return profiles || [];
        })(),
        // Fetch all likes counts
        supabase
          .from('round_comment_likes')
          .select('comment_id')
          .in('comment_id', commentIds),
        // Fetch all replies counts
        supabase
          .from('round_comment_replies')
          .select('comment_id')
          .in('comment_id', commentIds),
        // Fetch user's likes
        currentUserId
          ? supabase
              .from('round_comment_likes')
              .select('comment_id')
              .in('comment_id', commentIds)
              .eq('user_id', currentUserId)
          : Promise.resolve({ data: [] })
      ]);

      // Create maps for efficient lookup
      const profilesMap = new Map(profilesResult.map(p => [p.id, p]));
      
      const likesCountMap = new Map<string, number>();
      likesResult.data?.forEach(like => {
        likesCountMap.set(like.comment_id, (likesCountMap.get(like.comment_id) || 0) + 1);
      });

      const repliesCountMap = new Map<string, number>();
      repliesResult.data?.forEach(reply => {
        repliesCountMap.set(reply.comment_id, (repliesCountMap.get(reply.comment_id) || 0) + 1);
      });

      const userLikesSet = new Set(userLikesResult.data?.map(like => like.comment_id) || []);

      // Combine all data
      const commentsWithProfiles = filteredData.map(comment => ({
        ...comment,
        profile: profilesMap.get(comment.user_id),
        likes_count: likesCountMap.get(comment.id) || 0,
        replies_count: repliesCountMap.get(comment.id) || 0,
        user_has_liked: userLikesSet.has(comment.id)
      }));

      setComments(commentsWithProfiles);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      toast.error(error.message || "Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !currentUserId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('round_comments')
        .insert({
          game_id: gameId,
          round_id: gameId!,
          game_type: 'scramble',
          user_id: currentUserId,
          content: newComment.trim()
        })
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error("Comment was not saved. Please try again.");
      }

      setNewComment("");
      fetchComments();
    } catch (error: any) {
      console.error("Error posting comment:", error);
      toast.error(error.message || "Failed to post comment");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishGame = async () => {
    try {
      await supabase.from("scramble_games").update({ is_finished: true }).eq("id", gameId);
      toast.success("Game finished!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("scramble_holes").delete().eq("game_id", gameId);
      await supabase.from("scramble_games").delete().eq("id", gameId);
      toast.success("Game deleted");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    }
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
      toast.success("Comment updated");
    } catch (error: any) {
      console.error("Error updating comment:", error);
      toast.error(error.message || "Failed to update comment");
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
      toast.success("Comment deleted");
      setShowDeleteCommentDialog(false);
      setCommentToDelete(null);
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      toast.error(error.message || "Failed to delete comment");
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
      toast.error("Failed to update like");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <GameHeader
        gameTitle={gameData?.round_name || "Scramble"}
        courseName={gameData?.course_name || ""}
        pageTitle="Game feed"
      />

      <div className="p-4 space-y-4">
        {/* Comment input */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Textarea
                ref={commentTextareaRef}
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  const textarea = commentTextareaRef.current;
                  if (textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
                  }
                }}
                className="min-h-[2.5rem] resize-none overflow-hidden"
                rows={1}
              />
              <Button
                onClick={submitComment}
                disabled={!newComment.trim() || loading}
                size="icon"
              >
                <Send size={18} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Comments list */}
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No comments yet</p>
            <p className="text-sm">Be the first to comment!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              // Activity items (e.g., "X commented on Y's scorecard") - render as clickable
              if (comment.is_activity_item && comment.scorecard_player_name) {
                const commenterName = comment.profile?.display_name || comment.profile?.username || 'Unknown';
                const activityHeader = `${commenterName} commented on ${comment.scorecard_player_name}'s scorecard`;
                
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
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-sm">
                            {(comment.profile?.display_name || comment.profile?.username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
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

              const isOwnComment = comment.user_id === currentUserId;
              const isEditing = editingCommentId === comment.id;

              return (
              <Card key={comment.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                      {(comment.profile?.display_name || comment.profile?.username || 'U').charAt(0).toUpperCase()}
                    </div>
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
                            <p className="font-medium text-sm">
                              {comment.profile?.display_name || comment.profile?.username || 'Unknown'}
                            </p>
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
                          <p className="text-sm mt-1">{comment.content}</p>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-4 mt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`gap-1 ${comment.user_has_liked ? "text-red-500" : ""}`}
                              onClick={() => handleLike(comment.id, comment.user_has_liked || false)}
                            >
                              <Heart size={16} fill={comment.user_has_liked ? "currentColor" : "none"} />
                              {comment.likes_count > 0 && comment.likes_count}
                            </Button>
                          </div>
                        </>
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

      <ScrambleBottomTabBar gameId={gameId!} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />
      
      {/* Scorecard Comments Sheet */}
      {selectedScorecardPlayerName && (
        <ScorecardCommentsSheet
          open={commentsSheetOpen}
          onOpenChange={setCommentsSheetOpen}
          gameId={gameId || ""}
          gameType="scramble"
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
