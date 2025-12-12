import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Info, Newspaper, List, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Round {
  id: string;
  course_name: string;
  holes_played: number;
  date_played: string;
  user_id: string;
  tee_set: string | null;
}

interface PlayerData {
  id: string;
  user_id: string;
  display_name: string;
  scores: Map<number, number>;
}

interface CourseHole {
  hole_number: number;
  par: number;
}

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

export default function SpectateRound() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [round, setRound] = useState<Round | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Determine active tab from URL
  const getActiveTab = () => {
    if (location.pathname.includes('/feed')) return 'feed';
    if (location.pathname.includes('/info')) return 'info';
    if (location.pathname.includes('/settings')) return 'settings';
    return 'leaderboard';
  };

  useEffect(() => {
    if (roundId) {
      fetchData();
      setupRealtimeSubscription();
    }
  }, [roundId]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Fetch round
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRound(roundData);

      // Fetch owner profile
      const { data: ownerData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", roundData.user_id)
        .single();
      setOwnerProfile(ownerData);

      // Fetch course holes
      const { data: courseData } = await supabase
        .from("courses")
        .select("id")
        .eq("name", roundData.course_name)
        .single();

      if (courseData) {
        const { data: holesData } = await supabase
          .from("course_holes")
          .select("hole_number, par")
          .eq("course_id", courseData.id)
          .order("hole_number");
        setCourseHoles(holesData || []);
      }

      // Fetch players and scores
      const { data: playersData } = await supabase
        .from("round_players")
        .select("id, user_id")
        .eq("round_id", roundId);

      if (playersData) {
        const userIds = playersData.map(p => p.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", userIds);

        const { data: scoresData } = await supabase
          .from("holes")
          .select("hole_number, score, player_id")
          .eq("round_id", roundId);

        const scoresMap = new Map<string, Map<number, number>>();
        scoresData?.forEach((hole) => {
          if (hole.player_id) {
            if (!scoresMap.has(hole.player_id)) {
              scoresMap.set(hole.player_id, new Map());
            }
            scoresMap.get(hole.player_id)!.set(hole.hole_number, hole.score);
          }
        });

        const playersWithScores: PlayerData[] = playersData.map(player => {
          const profile = profilesData?.find(p => p.id === player.user_id);
          return {
            id: player.id,
            user_id: player.user_id,
            display_name: profile?.display_name || profile?.username || "Player",
            scores: scoresMap.get(player.id) || new Map(),
          };
        });
        setPlayers(playersWithScores);
      }

      // Fetch comments
      const { data: commentsData } = await supabase
        .from("round_comments")
        .select("*")
        .eq("round_id", roundId)
        .eq("game_type", "round")
        .order("created_at", { ascending: false });

      if (commentsData) {
        // Fetch profiles for comments
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
      toast({ title: "Error loading round", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`round-${roundId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'holes', filter: `round_id=eq.${roundId}` },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'round_comments', filter: `round_id=eq.${roundId}` },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUserId || !roundId) return;

    try {
      const { error } = await supabase
        .from("round_comments")
        .insert({
          round_id: roundId,
          game_type: "round",
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

  const calculateTotals = (player: PlayerData) => {
    let totalScore = 0;
    let totalPar = 0;
    let holesCompleted = 0;

    courseHoles.forEach(hole => {
      const score = player.scores.get(hole.hole_number);
      if (score && score > 0) {
        totalScore += score;
        totalPar += hole.par;
        holesCompleted++;
      }
    });

    return { totalScore, totalPar, holesCompleted };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading round...</div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Round not found</div>
      </div>
    );
  }

  const ownerName = ownerProfile?.display_name || ownerProfile?.username || "Friend";

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
                <p className="font-semibold text-sm">{ownerName}'s Round</p>
                <p className="text-xs text-muted-foreground">{round.course_name}</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-green-600">LIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto p-4">
        <Tabs defaultValue={getActiveTab()} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="leaderboard" className="flex items-center gap-1">
              <List size={14} />
              <span className="hidden sm:inline">Leaderboard</span>
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

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="mt-4 space-y-4">
            {players.map((player) => {
              const totals = calculateTotals(player);
              const scoreToPar = totals.totalScore - totals.totalPar;
              const scoreDisplay = scoreToPar === 0 ? "E" : scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar;

              return (
                <Card key={player.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{player.display_name}</CardTitle>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{scoreDisplay}</p>
                        <p className="text-xs text-muted-foreground">Thru {totals.holesCompleted}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs w-12">Hole</TableHead>
                            {courseHoles.slice(0, 9).map(h => (
                              <TableHead key={h.hole_number} className="text-center text-xs px-1 w-8">
                                {h.hole_number}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="text-xs">Par</TableCell>
                            {courseHoles.slice(0, 9).map(h => (
                              <TableCell key={h.hole_number} className="text-center text-xs px-1">
                                {h.par}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-xs font-semibold">Score</TableCell>
                            {courseHoles.slice(0, 9).map(h => {
                              const score = player.scores.get(h.hole_number);
                              return (
                                <TableCell key={h.hole_number} className="text-center text-xs font-semibold px-1">
                                  {score || "-"}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Info Tab */}
          <TabsContent value="info" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Round Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Course</span>
                  <span>{round.course_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span>{new Date(round.date_played).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Holes</span>
                  <span>{round.holes_played}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tees</span>
                  <span>{round.tee_set || "Not specified"}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feed Tab */}
          <TabsContent value="feed" className="mt-4 space-y-4">
            {/* Comment Input */}
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

            {/* Comments List */}
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
                          {(comment.profile?.display_name || comment.profile?.username || "?").charAt(0).toUpperCase()}
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
                  You're viewing this round as a spectator. Only the round owner can modify settings.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
