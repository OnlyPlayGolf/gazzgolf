import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Info, Newspaper, List, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { formatMatchStatus } from "@/utils/matchPlayScoring";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

export default function SpectateMatchPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<MatchPlayGame | null>(null);
  const [holes, setHoles] = useState<MatchPlayHole[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (gameId) {
      fetchData();
      setupRealtimeSubscription();
    }
  }, [gameId]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      const { data: gameData, error: gameError } = await supabase
        .from("match_play_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      setGame(gameData as MatchPlayGame);

      const { data: ownerData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", gameData.user_id)
        .single();
      setOwnerProfile(ownerData);

      const { data: holesData } = await supabase
        .from("match_play_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");
      setHoles((holesData || []) as MatchPlayHole[]);

      // Fetch comments
      const { data: commentsData } = await supabase
        .from("round_comments")
        .select("*")
        .eq("game_id", gameId)
        .eq("game_type", "match_play")
        .order("created_at", { ascending: false });

      if (commentsData) {
        const commentUserIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: commentProfiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", commentUserIds);

        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          profile: commentProfiles?.find(p => p.id === comment.user_id),
        }));
        setComments(commentsWithProfiles);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`match-play-${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_play_holes', filter: `game_id=eq.${gameId}` },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'round_comments', filter: `game_id=eq.${gameId}` },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUserId || !gameId) return;

    try {
      const { error } = await supabase
        .from("round_comments")
        .insert({
          round_id: gameId,
          game_id: gameId,
          game_type: "match_play",
          user_id: currentUserId,
          content: newComment.trim(),
        });

      if (error) throw error;
      setNewComment("");
      fetchData();
    } catch (error: any) {
      toast({ title: "Error adding comment", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
      </div>
    );
  }

  const ownerName = ownerProfile?.display_name || ownerProfile?.username || "Friend";
  const player1HolesWon = holes.filter(h => h.hole_result === 1).length;
  const player2HolesWon = holes.filter(h => h.hole_result === -1).length;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
              <ArrowLeft size={20} />
            </Button>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                {ownerProfile?.avatar_url ? (
                  <img src={ownerProfile.avatar_url} alt={ownerName} className="object-cover" />
                ) : (
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {ownerName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <p className="font-semibold text-sm">Match Play</p>
                <p className="text-xs text-muted-foreground">{game.course_name}</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-green-600">LIVE</span>
            </div>
          </div>

          {/* Match Status */}
          <div className="bg-primary text-primary-foreground rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-primary">
              {formatMatchStatus(game.match_status, game.holes_remaining, game.player_1, game.player_2)}
            </p>
            <p className="text-xs text-muted-foreground">{game.holes_remaining} holes remaining</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto p-4">
        <Tabs defaultValue="leaderboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="leaderboard" className="flex items-center gap-1">
              <List size={14} />
              <span className="hidden sm:inline">Status</span>
            </TabsTrigger>
            <TabsTrigger value="info" className="flex items-center gap-1">
              <Info size={14} />
              <span className="hidden sm:inline">Info</span>
            </TabsTrigger>
            <TabsTrigger value="feed" className="flex items-center gap-1">
              <Newspaper size={14} />
              <span className="hidden sm:inline">Feed</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings size={14} />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Leaderboard/Status Tab */}
          <TabsContent value="leaderboard" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 text-center">
                <p className="font-semibold text-blue-600">{game.player_1}</p>
                <p className="text-3xl font-bold mt-2">{player1HolesWon}</p>
                <p className="text-xs text-muted-foreground">Holes Won</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="font-semibold text-red-600">{game.player_2}</p>
                <p className="text-3xl font-bold mt-2">{player2HolesWon}</p>
                <p className="text-xs text-muted-foreground">Holes Won</p>
              </Card>
            </div>

            {holes.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Hole by Hole</h3>
                <div className="grid grid-cols-9 gap-1 text-xs">
                  {holes.slice(0, 9).map((hole) => (
                    <div key={hole.id} className="text-center">
                      <div className="text-muted-foreground">{hole.hole_number}</div>
                      <div className={`font-medium ${
                        hole.hole_result === 1 ? 'text-blue-600' : 
                        hole.hole_result === -1 ? 'text-red-600' : 
                        'text-muted-foreground'
                      }`}>
                        {hole.hole_result === 1 ? 'W' : hole.hole_result === -1 ? 'L' : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Info Tab */}
          <TabsContent value="info" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Game Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Course</span>
                  <span>{game.course_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Player 1</span>
                  <span>{game.player_1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Player 2</span>
                  <span>{game.player_2}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feed Tab */}
          <TabsContent value="feed" className="mt-4 space-y-4">
            {currentUserId && (
              <Card className="p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  />
                  <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                    Post
                  </Button>
                </div>
              </Card>
            )}

            {comments.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No comments yet. Be the first to cheer them on!</p>
              </Card>
            ) : (
              comments.map((comment) => (
                <Card key={comment.id} className="p-4">
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      {comment.profile?.avatar_url ? (
                        <img src={comment.profile.avatar_url} alt="" className="object-cover" />
                      ) : (
                        <AvatarFallback className="bg-muted text-xs">
                          {(comment.profile?.display_name || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {comment.profile?.display_name || comment.profile?.username || "User"}
                      </p>
                      <p className="text-sm text-foreground mt-1">{comment.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(comment.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Game Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  You're viewing this game as a spectator. Only the game owner can modify settings.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
