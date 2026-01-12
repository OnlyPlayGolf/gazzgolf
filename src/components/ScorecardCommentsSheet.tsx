import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    // Scroll to bottom when new comments are added
    if (scrollRef.current && comments.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

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
        .order("created_at", { ascending: true });

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
        // Don't throw - the main comment was saved successfully
      }

      // Add the new comment to the list immediately
      const newCommentObj: Comment = {
        id: commentData.id,
        content: newComment.trim(),
        user_id: currentUserId,
        created_at: new Date().toISOString(),
        profiles: currentUserProfile,
      };
      
      setComments(prev => [...prev, newCommentObj]);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">
              Comments on {scorecardPlayerName}'s Scorecard
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X size={20} />
            </Button>
          </div>
        </SheetHeader>

        {/* Chat Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading comments...</div>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center text-muted-foreground">
                <p>No comments yet</p>
                <p className="text-sm">Be the first to comment!</p>
              </div>
            </div>
          ) : (
            comments.map((comment) => {
              const isOwnMessage = comment.user_id === currentUserId;
              
              return (
                <div 
                  key={comment.id} 
                  className={`flex gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{getInitials(comment.profiles)}</AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-medium">{getDisplayName(comment.profiles)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div 
                      className={`px-3 py-2 rounded-2xl text-sm ${
                        isOwnMessage 
                          ? 'bg-primary text-primary-foreground rounded-br-md' 
                          : 'bg-muted rounded-bl-md'
                      }`}
                    >
                      {comment.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Area */}
        {currentUserId ? (
          <div className="border-t p-4 flex gap-2">
            <Input
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={submitting}
              className="flex-1"
            />
            <Button 
              size="icon" 
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
            >
              <Send size={18} />
            </Button>
          </div>
        ) : (
          <div className="border-t p-4 text-center text-muted-foreground text-sm">
            Sign in to leave a comment
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
