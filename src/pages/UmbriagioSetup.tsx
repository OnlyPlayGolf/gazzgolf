import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin } from "lucide-react";
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

        <Button onClick={handleStartGame} disabled={loading} className="w-full" size="lg">
          {loading ? "Starting..." : "Start Umbriago"}
        </Button>
      </div>
    </div>
  );
}
