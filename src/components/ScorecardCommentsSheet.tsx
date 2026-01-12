import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Profile {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: Profile | null;
}

interface ScorecardCommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameId: string;
  gameType: 'round' | 'match_play' | 'best_ball' | 'umbriago' | 'wolf' | 'scramble' | 'copenhagen' | 'skins';
  scorecardPlayerId?: string;
  scorecardPlayerName: string;
}

export function ScorecardCommentsSheet({
  open,
  onOpenChange,
  gameId,
  gameType,
  scorecardPlayerId,
  scorecardPlayerName,
}: ScorecardCommentsSheetProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username, avatar_url")
          .eq("id", user.id)
          .single();
        setCurrentUserProfile(profile);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (open && gameId) {
      fetchComments();
    }
  }, [open, gameId, scorecardPlayerId]);

  const fetchComments = async () => {
    if (!gameId) return;
    setLoading(true);
    
    try {
      // Fetch comments for this specific scorecard
      let query = supabase
        .from("round_comments")
        .select("id, content, user_id, created_at, scorecard_player_id, scorecard_player_name")
        .eq("round_id", gameId)
        .eq("game_type", gameType)
        .eq("scorecard_player_name", scorecardPlayerName)
        .is("is_activity_item", false) // Only get actual comments, not activity items
        .order("created_at", { ascending: false });

      const { data: commentsData, error } = await query;

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

      const commentsWithProfiles: Comment[] = (commentsData || []).map(comment => ({
        ...comment,
        profiles: profilesMap.get(comment.user_id) || null,
      }));

      setComments(commentsWithProfiles);
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
      const commenterName = currentUserProfile?.display_name || currentUserProfile?.username || "Someone";
      
      // Insert the actual comment
      const { data: commentData, error: commentError } = await supabase
        .from("round_comments")
        .insert({
          round_id: gameId,
          game_id: gameId,
          user_id: currentUserId,
          content: newComment.trim(),
          game_type: gameType,
          scorecard_player_id: scorecardPlayerId || null,
          scorecard_player_name: scorecardPlayerName,
          is_activity_item: false,
        })
        .select()
        .single();

      if (commentError) throw commentError;

      // Also create an activity item for the Game Feed
      const activityContent = `${commenterName} commented on ${scorecardPlayerName}'s scorecard`;
      
      const { error: activityError } = await supabase
        .from("round_comments")
        .insert({
          round_id: gameId,
          game_id: gameId,
          user_id: currentUserId,
          content: activityContent,
          game_type: gameType,
          scorecard_player_id: scorecardPlayerId || null,
          scorecard_player_name: scorecardPlayerName,
          is_activity_item: true,
        });

      if (activityError) {
        console.error("Error creating activity item:", activityError);
      }

      // Add the new comment to the list immediately
      const newCommentObj: Comment = {
        id: commentData.id,
        content: newComment.trim(),
        user_id: currentUserId,
        created_at: new Date().toISOString(),
        profiles: currentUserProfile,
      };
      
      setComments(prev => [newCommentObj, ...prev]);
      setNewComment("");
    } catch (error: any) {
      console.error("Error posting comment:", error);
      toast({ title: "Error posting comment", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getDisplayName = (profiles: Profile | null) => {
    return profiles?.display_name || profiles?.username || "Player";
  };

  const getInitials = (profiles: Profile | null) => {
    const name = getDisplayName(profiles);
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-lg">
            {scorecardPlayerName}'s Scorecard
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Comment Input Card */}
          {currentUserId ? (
            <Card className="border bg-card">
              <CardContent className="p-4 space-y-3">
                <Textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={submitting}
                  className="min-h-[80px] resize-none bg-background"
                  rows={3}
                />
                <Button 
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submitting}
                  className="w-full gap-2"
                >
                  <Send size={16} />
                  Post Comment
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border bg-card">
              <CardContent className="p-4 text-center text-muted-foreground text-sm">
                Sign in to leave a comment
              </CardContent>
            </Card>
          )}

          {/* Comments List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center text-muted-foreground">
                <p>No comments yet</p>
                <p className="text-sm">Be the first to comment!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <Card key={comment.id} className="border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{getInitials(comment.profiles)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{getDisplayName(comment.profiles)}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{comment.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
