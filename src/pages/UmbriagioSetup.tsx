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
              Quick Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>4 Categories per hole:</strong> Team Low, Individual Low, Closest to Pin, Birdie/Eagle</p>
            <p><strong>Umbriago Sweep:</strong> Win all 4 = points doubled (4→8)</p>
            <p><strong>Double:</strong> Losing team can call Double (×2)</p>
            <p><strong>Double Back:</strong> Other team can reply (×4)</p>
            <p><strong>Roll:</strong> Halves point difference, doubles stake</p>
          </CardContent>
        </Card>

        <Button onClick={handleStartGame} disabled={loading} className="w-full" size="lg">
          {loading ? "Starting..." : "Start Umbriago"}
        </Button>
      </div>
    </div>
  );
}
