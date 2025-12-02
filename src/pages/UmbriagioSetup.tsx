import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, DollarSign, Trophy } from "lucide-react";
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
  
  // Game setup state
  const [courseName, setCourseName] = useState("");
  const [holesPlayed, setHolesPlayed] = useState<9 | 18>(18);
  const [teeSet, setTeeSet] = useState("Yellow");
  
  // Team players
  const [teamAPlayer1, setTeamAPlayer1] = useState("");
  const [teamAPlayer2, setTeamAPlayer2] = useState("");
  const [teamBPlayer1, setTeamBPlayer1] = useState("");
  const [teamBPlayer2, setTeamBPlayer2] = useState("");
  
  // Game settings
  const [stakePerPoint, setStakePerPoint] = useState(10);
  const [payoutMode, setPayoutMode] = useState<'difference' | 'total'>('difference');

  const handleStartGame = async () => {
    if (!courseName.trim()) {
      toast({ title: "Course name required", variant: "destructive" });
      return;
    }
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
          course_name: courseName,
          tee_set: teeSet,
          holes_played: holesPlayed,
          team_a_player_1: teamAPlayer1,
          team_a_player_2: teamAPlayer2,
          team_b_player_1: teamBPlayer1,
          team_b_player_2: teamBPlayer2,
          stake_per_point: stakePerPoint,
          payout_mode: payoutMode,
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

        {/* Course Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Course & Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Course Name</Label>
              <Input
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="Enter course name"
              />
            </div>
            <div className="space-y-2">
              <Label>Holes</Label>
              <div className="flex gap-2">
                <Button
                  variant={holesPlayed === 18 ? "default" : "outline"}
                  onClick={() => setHolesPlayed(18)}
                  className="flex-1"
                >
                  18 Holes
                </Button>
                <Button
                  variant={holesPlayed === 9 ? "default" : "outline"}
                  onClick={() => setHolesPlayed(9)}
                  className="flex-1"
                >
                  9 Holes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Stakes & Payout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign size={20} className="text-primary" />
              Stakes & Payout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Stake Per Point</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={stakePerPoint}
                  onChange={(e) => setStakePerPoint(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-muted-foreground">SEK</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payout Mode</Label>
              <div className="space-y-2">
                <button
                  onClick={() => setPayoutMode('difference')}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    payoutMode === 'difference'
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold">Point Difference</div>
                  <div className="text-sm text-muted-foreground">
                    Payout = |point difference| × stake
                  </div>
                </button>
                <button
                  onClick={() => setPayoutMode('total')}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    payoutMode === 'total'
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold">Total Points</div>
                  <div className="text-sm text-muted-foreground">
                    Payout = winning team's total × stake
                  </div>
                </button>
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
