import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Dice5, RefreshCw } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string;
  name: string;
  location: string | null;
}

type TeamRotation = "none" | "every9" | "every6";

interface TeamCombination {
  teamA: [string, string];
  teamB: [string, string];
}

// Generate all unique team combinations for 4 players
function generateTeamCombinations(players: string[]): TeamCombination[] {
  if (players.length !== 4) return [];
  const [a, b, c, d] = players;
  return [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] },
  ];
}

// Generate rotation schedule ensuring no repeated teams
function generateRotationSchedule(
  players: string[],
  rotation: TeamRotation,
  initialTeams: TeamCombination
): TeamCombination[] {
  if (rotation === "none") {
    return [initialTeams];
  }

  const allCombinations = generateTeamCombinations(players);
  const numSegments = rotation === "every9" ? 2 : 3;
  
  // Find the index of the initial combination
  const initialIndex = allCombinations.findIndex(
    c => c.teamA.sort().join() === initialTeams.teamA.sort().join()
  );

  // Shuffle remaining combinations
  const remaining = allCombinations.filter((_, i) => i !== initialIndex);
  const shuffled = [...remaining].sort(() => Math.random() - 0.5);

  const schedule: TeamCombination[] = [initialTeams];
  
  for (let i = 1; i < numSegments; i++) {
    if (shuffled.length > 0) {
      schedule.push(shuffled[i - 1]);
    }
  }

  return schedule;
}

export default function UmbriagioSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Course selection
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  
  // Team players
  const [teamAPlayer1, setTeamAPlayer1] = useState("");
  const [teamAPlayer2, setTeamAPlayer2] = useState("");
  const [teamBPlayer1, setTeamBPlayer1] = useState("");
  const [teamBPlayer2, setTeamBPlayer2] = useState("");
  
  // Game settings
  const [rollsPerTeam, setRollsPerTeam] = useState(1);
  const [teamRotation, setTeamRotation] = useState<TeamRotation>("none");

  // Load current user and courses on mount
  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Get current user's display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .single();
      
      const currentUserName = profile?.display_name || profile?.username || 'You';
      setTeamAPlayer1(currentUserName);
      
      // Load added players from sessionStorage
      const savedPlayers = sessionStorage.getItem('roundPlayers');
      if (savedPlayers) {
        const players = JSON.parse(savedPlayers);
        // Fill in team slots with added players
        if (players.length >= 1) setTeamAPlayer2(players[0].displayName || '');
        if (players.length >= 2) setTeamBPlayer1(players[1].displayName || '');
        if (players.length >= 3) setTeamBPlayer2(players[2].displayName || '');
      }
      
      // Check for course from sessionStorage first
      const savedCourse = sessionStorage.getItem('selectedCourse');
      
      // Fetch available courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, name, location')
        .order('name');
      
      if (coursesData) {
        setCourses(coursesData);
      }
      
      // Set course from sessionStorage if available
      if (savedCourse) {
        const course = JSON.parse(savedCourse);
        const matchingCourse = coursesData?.find(c => c.name === course.name);
        if (matchingCourse) {
          setSelectedCourseId(matchingCourse.id);
          return;
        }
      }
      
      // Otherwise get last used course from previous umbriago games
      const { data: lastGame } = await supabase
        .from('umbriago_games')
        .select('course_id')
        .eq('user_id', user.id)
        .not('course_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (lastGame?.course_id) {
        setSelectedCourseId(lastGame.course_id);
      } else if (coursesData && coursesData.length > 0) {
        setSelectedCourseId(coursesData[0].id);
      }
    };
    loadData();
  }, []);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

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

      // Generate rotation schedule if enabled
      const players = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
      const initialTeams: TeamCombination = {
        teamA: [teamAPlayer1, teamAPlayer2],
        teamB: [teamBPlayer1, teamBPlayer2]
      };
      
      const rotationSchedule = generateRotationSchedule(players, teamRotation, initialTeams);

      const { data: game, error } = await supabase
        .from("umbriago_games")
        .insert({
          user_id: user.id,
          course_name: selectedCourse?.name || "Umbriago Game",
          course_id: selectedCourseId || null,
          holes_played: 18,
          team_a_player_1: teamAPlayer1,
          team_a_player_2: teamAPlayer2,
          team_b_player_1: teamBPlayer1,
          team_b_player_2: teamBPlayer2,
          stake_per_point: 0,
          payout_mode: "difference",
          rolls_per_team: rollsPerTeam,
        })
        .select()
        .single();

      if (error) throw error;

      // Store rotation schedule in sessionStorage for gameplay
      if (teamRotation !== "none") {
        sessionStorage.setItem(`umbriago_rotation_${game.id}`, JSON.stringify({
          type: teamRotation,
          schedule: rotationSchedule
        }));
      }

      toast({ title: "Umbriago game started!" });
      navigate(`/umbriago/${game.id}/play`);
    } catch (error: any) {
      toast({ title: "Error creating game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getRotationPreview = () => {
    if (teamRotation === "none") return null;
    
    const players = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
    if (players.some(p => !p.trim())) return null;

    const initialTeams: TeamCombination = {
      teamA: [teamAPlayer1, teamAPlayer2],
      teamB: [teamBPlayer1, teamBPlayer2]
    };

    const schedule = generateRotationSchedule(players, teamRotation, initialTeams);
    const holesPerSegment = teamRotation === "every9" ? 9 : 6;

    return (
      <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Rotation Preview:</p>
        {schedule.map((combo, i) => (
          <div key={i} className="text-sm">
            <span className="font-medium">Holes {i * holesPerSegment + 1}-{(i + 1) * holesPerSegment}:</span>
            <span className="ml-2 text-blue-600">{combo.teamA.join(" & ")}</span>
            <span className="mx-1">vs</span>
            <span className="text-red-600">{combo.teamB.join(" & ")}</span>
          </div>
        ))}
      </div>
    );
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

        {/* Course Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin size={20} className="text-primary" />
              Course
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        {/* Game Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Dice5 size={20} className="text-primary" />
              Game Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Rolls per Team</Label>
              <Select value={rollsPerTeam.toString()} onValueChange={(v) => setRollsPerTeam(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No Rolls</SelectItem>
                  <SelectItem value="1">1 Roll</SelectItem>
                  <SelectItem value="2">2 Rolls</SelectItem>
                  <SelectItem value="3">3 Rolls</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A Roll halves your team's points and doubles the next hole
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <RefreshCw size={14} />
                Team Rotation
              </Label>
              <Select value={teamRotation} onValueChange={(v) => setTeamRotation(v as TeamRotation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Rotation (Fixed Teams)</SelectItem>
                  <SelectItem value="every9">Rotate Every 9 Holes</SelectItem>
                  <SelectItem value="every6">Rotate Every 6 Holes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {teamRotation === "none" && "Teams stay the same for all 18 holes"}
                {teamRotation === "every9" && "Teams shuffle randomly after 9 holes (2 different team combinations)"}
                {teamRotation === "every6" && "Teams shuffle randomly every 6 holes (3 different team combinations)"}
              </p>
              {getRotationPreview()}
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