import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { SimpleSkinsBottomTabBar } from "@/components/SimpleSkinsBottomTabBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Heart, MessageCircle, Send, Clock, Flag, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from "date-fns";

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

export default function RoundFeed() {
  const { roundId } = useParams();
  const { toast } = useToast();
  const [origin, setOrigin] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<Map<string, Reply[]>>(new Map());
  const [replyText, setReplyText] = useState<Map<string, string>>(new Map());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (roundId) {
      fetchRoundData();
      fetchComments();
    }
  }, [roundId, currentUserId]);

  const fetchRoundData = async () => {
    const { data } = await supabase
      .from("rounds")
      .select("origin")
      .eq("id", roundId)
      .single();
    setOrigin(data?.origin || null);
  };

  const fetchComments = async () => {
    if (!roundId) return;
    
    try {
      const { data: commentsData, error } = await supabase
        .from("round_comments")
        .select("id, content, hole_number, user_id, created_at")
        .eq("round_id", roundId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((commentsData || []).map(c => c.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const commentsWithCounts = await Promise.all(
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
    if (!newComment.trim() || !roundId || !currentUserId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("round_comments").insert({
        round_id: roundId,
        user_id: currentUserId,
        content: newComment.trim(),
        game_type: "round",
      });

      if (error) throw error;

      setNewComment("");
      fetchComments();
      toast({ title: "Update posted" });
    } catch (error: any) {
      toast({ title: "Error posting update", description: error.message, variant: "destructive" });
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
      setReplyingTo(null);
    } else {
      newExpanded.add(commentId);
      if (!replies.has(commentId)) {
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
      setReplyingTo(null);
      
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return `Yesterday, ${format(date, "h:mm a")}`;
    }
    return format(date, "MMM d, h:mm a");
  };

  const renderBottomTabBar = () => {
    if (!roundId) return null;
    if (origin === "simple_skins") {
      return <SimpleSkinsBottomTabBar roundId={roundId} />;
    }
    return <RoundBottomTabBar roundId={roundId} />;
  };

  // Group comments by date
  const groupedComments = comments.reduce((groups, comment) => {
    const date = new Date(comment.created_at);
    let key: string;
    if (isToday(date)) {
      key = "Today";
    } else if (isYesterday(date)) {
      key = "Yesterday";
    } else {
      key = format(date, "MMMM d, yyyy");
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(comment);
    return groups;
  }, {} as Record<string, Comment[]>);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Round Updates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {comments.length} update{comments.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* New Update Input */}
        {currentUserId && (
          <div className="flex gap-2">
            <Input
              placeholder="Add an update..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
              className="flex-1"
            />
            <Button 
              onClick={handleSubmitComment} 
              disabled={!newComment.trim() || submitting}
              size="icon"
              variant="secondary"
            >
              <Send size={16} />
            </Button>
          </div>
        )}

        {/* Updates List */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12 text-sm">
            Loading updates...
          </div>
        ) : comments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Clock className="text-muted-foreground" size={24} />
              </div>
              <p className="text-sm font-medium mb-1">No updates yet</p>
              <p className="text-xs text-muted-foreground">
                Updates and events will appear here during the round
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedComments).map(([dateLabel, dateComments]) => (
              <div key={dateLabel}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {dateLabel}
                  </span>
                  <Separator className="flex-1" />
                </div>

                {/* Updates for this date */}
                <div className="space-y-2">
                  {dateComments.map((comment) => (
                    <div 
                      key={comment.id} 
                      className="group bg-card border rounded-lg p-4 hover:border-border/80 transition-colors"
                    >
                      {/* Update Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Hole indicator and time */}
                          <div className="flex items-center gap-2 mb-1.5">
                            {comment.hole_number && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                                <Flag size={12} />
                                Hole {comment.hole_number}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatTime(comment.created_at)}
                            </span>
                          </div>

                          {/* Content */}
                          <p className="text-sm leading-relaxed">
                            {comment.content}
                          </p>

                          {/* Author */}
                          <p className="text-xs text-muted-foreground mt-2">
                            {getDisplayName(comment.profiles)}
                          </p>
                        </div>

                        {/* Actions - shown on hover or when active */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 w-8 p-0 ${comment.user_has_liked ? "text-red-500" : "text-muted-foreground"}`}
                            onClick={() => handleLike(comment.id, comment.user_has_liked)}
                          >
                            <Heart size={14} fill={comment.user_has_liked ? "currentColor" : "none"} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground"
                            onClick={() => toggleReplies(comment.id)}
                          >
                            <MessageCircle size={14} />
                          </Button>
                        </div>
                      </div>

                      {/* Interaction counts - only show if any */}
                      {(comment.likes_count > 0 || comment.replies_count > 0) && (
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
                          {comment.likes_count > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {comment.likes_count} like{comment.likes_count !== 1 ? 's' : ''}
                            </span>
                          )}
                          {comment.replies_count > 0 && (
                            <button
                              onClick={() => toggleReplies(comment.id)}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                            >
                              {comment.replies_count} repl{comment.replies_count !== 1 ? 'ies' : 'y'}
                              {expandedReplies.has(comment.id) ? (
                                <ChevronUp size={12} />
                              ) : (
                                <ChevronDown size={12} />
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Replies Section */}
                      {expandedReplies.has(comment.id) && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                          {replies.get(comment.id)?.map((reply) => (
                            <div key={reply.id} className="pl-4 border-l-2 border-muted">
                              <p className="text-sm">{reply.content}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {getDisplayName(reply.profiles)} · {formatTime(reply.created_at)}
                              </p>
                            </div>
                          ))}

                          {/* Reply Input */}
                          {currentUserId && (
                            <div className="flex gap-2 pt-2">
                              <Input
                                placeholder="Add a reply..."
                                value={replyText.get(comment.id) || ""}
                                onChange={(e) => setReplyText(prev => new Map(prev).set(comment.id, e.target.value))}
                                onKeyDown={(e) => e.key === 'Enter' && handleSubmitReply(comment.id)}
                                className="flex-1 h-9 text-sm"
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-9"
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
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {renderBottomTabBar()}
    </div>
  );
}