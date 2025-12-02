import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Trophy } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function UmbriagioSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Team players
  const [teamAPlayer1, setTeamAPlayer1] = useState("");
  const [teamAPlayer2, setTeamAPlayer2] = useState("");
  const [teamBPlayer1, setTeamBPlayer1] = useState("");
  const [teamBPlayer2, setTeamBPlayer2] = useState("");

  // Load players from session storage on mount
  useEffect(() => {
    const loadPlayers = async () => {
      // Get current user's display name
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', user.id)
          .single();
        
        const currentUserName = profile?.display_name || profile?.username || 'You';
        setTeamAPlayer1(currentUserName);
      }

      // Get saved players from session storage
      const savedPlayers = sessionStorage.getItem('roundPlayers');
      if (savedPlayers) {
        const players = JSON.parse(savedPlayers);
        // Auto-assign players to teams
        if (players.length >= 1) setTeamAPlayer2(players[0].displayName || players[0].username || 'Player 2');
        if (players.length >= 2) setTeamBPlayer1(players[1].displayName || players[1].username || 'Player 3');
        if (players.length >= 3) setTeamBPlayer2(players[2].displayName || players[2].username || 'Player 4');
      }
    };
    loadPlayers();
  }, []);

  const handleStartGame = async () => {
    if (!teamAPlayer1.trim() || !teamAPlayer2.trim() || !teamBPlayer1.trim() || !teamBPlayer2.trim()) {
      toast({ title: "All player names required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: game, error } = await supabase
        .from("umbriago_games")
        .insert({
          user_id: user.id,
          course_name: "Umbriago Game",
          holes_played: 18,
          team_a_player_1: teamAPlayer1,
          team_a_player_2: teamAPlayer2,
          team_b_player_1: teamBPlayer1,
          team_b_player_2: teamBPlayer2,
          stake_per_point: 0,
          payout_mode: "difference",
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Umbriago game started!" });
      navigate(`/umbriago/${game.id}/play`);
    } catch (error: any) {
      toast({ title: "Error creating game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rounds-play')} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Umbriago Setup</h1>
        </div>

        {/* Teams */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users size={20} className="text-primary" />
              Teams (2 vs 2)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <Label className="font-semibold">Team A</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={teamAPlayer1}
                  onChange={(e) => setTeamAPlayer1(e.target.value)}
                  placeholder="Player 1"
                />
                <Input
                  value={teamAPlayer2}
                  onChange={(e) => setTeamAPlayer2(e.target.value)}
                  placeholder="Player 2"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <Label className="font-semibold">Team B</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={teamBPlayer1}
                  onChange={(e) => setTeamBPlayer1(e.target.value)}
                  placeholder="Player 1"
                />
                <Input
                  value={teamBPlayer2}
                  onChange={(e) => setTeamBPlayer2(e.target.value)}
                  placeholder="Player 2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rules Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy size={20} className="text-primary" />
              How to Play Umbriago
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-4">
            <div>
              <p className="font-semibold text-foreground mb-1">Overview</p>
              <p>A 2v2 team game where points are won across 4 categories on every hole. The team with the most points at the end wins.</p>
            </div>
            
            <div>
              <p className="font-semibold text-foreground mb-1">4 Ways to Win Points Each Hole</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><strong>Team Low:</strong> Team with the lowest combined score wins 1 point</li>
                <li><strong>Individual Low:</strong> Team of the player with the lowest score wins 1 point</li>
                <li><strong>Closest to Pin:</strong> Team of the player closest to the pin on their approach wins 1 point</li>
                <li><strong>Birdie or Better:</strong> If only one team makes birdie (or better), they win 1 point</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-1">Umbriago Sweep (Bonus!)</p>
              <p>Win all 4 categories on a single hole? Your points are <strong>doubled</strong> (4 → 8 points)!</p>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-1">Doubles & Double Backs</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><strong>Double:</strong> Before a hole, the losing team can call "Double" to multiply that hole's points by 2</li>
                <li><strong>Double Back:</strong> The other team can respond with "Double Back" to multiply by 4 instead</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-1">The Roll</p>
              <p>If you're behind, you can call a "Roll" to cut the point difference in half and keep fighting!</p>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleStartGame} disabled={loading} className="w-full" size="lg">
          {loading ? "Starting..." : "Start Umbriago"}
        </Button>
      </div>
    </div>
  );
}
