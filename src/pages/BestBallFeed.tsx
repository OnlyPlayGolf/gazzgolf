import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Profile {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  content: string;
  hole_number: number | null;
  user_id: string;
  created_at: string;
  profiles: Profile | null;
  likes_count: number;
  replies_count: number;
  user_has_liked: boolean;
}

interface Reply {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: Profile | null;
}

export default function BestBallFeed() {
  const { gameId } = useParams();
  const { toast } = useToast();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('best_ball', gameId);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<Map<string, Reply[]>>(new Map());
  const [replyText, setReplyText] = useState<Map<string, string>>(new Map());

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
      // Fetch comments for this best ball game
      const { data: commentsData, error } = await supabase
        .from("round_comments")
        .select("id, content, hole_number, user_id, created_at")
        .eq("round_id", gameId)
        .eq("game_type", "best_ball")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get unique user IDs and fetch profiles
      const userIds = [...new Set((commentsData || []).map(c => c.user_id))];
      let profilesMap = new Map<string, Profile>();
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        if (profilesData) {
          profilesMap = new Map(profilesData.map(p => [p.id, p as Profile]));
        }
      }

      // Fetch likes and replies counts for each comment
      const commentsWithCounts: Comment[] = await Promise.all(
        (commentsData || []).map(async (comment) => {
          const { count: likesCount } = await supabase
            .from("round_comment_likes")
            .select("*", { count: "exact", head: true })
            .eq("comment_id", comment.id);

          const { count: repliesCount } = await supabase
            .from("round_comment_replies")
            .select("*", { count: "exact", head: true })
            .eq("comment_id", comment.id);

          let userHasLiked = false;
          if (currentUserId) {
            const { data: likeData } = await supabase
              .from("round_comment_likes")
              .select("id")
              .eq("comment_id", comment.id)
              .eq("user_id", currentUserId)
              .maybeSingle();
            userHasLiked = !!likeData;
          }

          return {
            ...comment,
            profiles: profilesMap.get(comment.user_id) || null,
            likes_count: likesCount || 0,
            replies_count: repliesCount || 0,
            user_has_liked: userHasLiked,
          };
        })
      );

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
        game_type: "best_ball",
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
          let profilesMap = new Map<string, Profile>();
          
          if (userIds.length > 0) {
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, display_name, username, avatar_url")
              .in("id", userIds);
            
            if (profilesData) {
              profilesMap = new Map(profilesData.map(p => [p.id, p as Profile]));
            }
          }

          const repliesWithProfiles: Reply[] = repliesData.map(r => ({
            ...r,
            profiles: profilesMap.get(r.user_id) || null
          }));
          
          setReplies(prev => new Map(prev).set(commentId, repliesWithProfiles));
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
        let profilesMap = new Map<string, Profile>();
        
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url")
            .in("id", userIds);
          
          if (profilesData) {
            profilesMap = new Map(profilesData.map(p => [p.id, p as Profile]));
          }
        }

        const repliesWithProfiles: Reply[] = repliesData.map(r => ({
          ...r,
          profiles: profilesMap.get(r.user_id) || null
        }));
        
        setReplies(prev => new Map(prev).set(commentId, repliesWithProfiles));
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

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Game Feed</h1>

        {/* New Comment Box */}
        {currentUserId && (
          <Card>
            <CardContent className="p-4">
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="mb-3"
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

      {gameId && !isSpectatorLoading && <BestBallBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
