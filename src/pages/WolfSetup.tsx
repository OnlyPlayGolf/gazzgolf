import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Settings, Shuffle } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { shuffleArray } from "@/utils/wolfScoring";

interface Course {
  id: string;
  name: string;
  location: string | null;
}

export default function WolfSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Course selection
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  
  // Players (3-5)
  const [players, setPlayers] = useState<string[]>(["", "", "", "", ""]);
  const [shuffled, setShuffled] = useState(false);
  
  // Game settings
  const [loneWolfWinPoints, setLoneWolfWinPoints] = useState(3);
  const [loneWolfLossPoints, setLoneWolfLossPoints] = useState(1);
  const [teamWinPoints, setTeamWinPoints] = useState(1);
  const [wolfPosition, setWolfPosition] = useState<'first' | 'last'>('last');

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
      const newPlayers = [...players];
      newPlayers[0] = currentUserName;
      
      // Load added players from sessionStorage
      const savedPlayers = sessionStorage.getItem('roundPlayers');
      if (savedPlayers) {
        const parsedPlayers = JSON.parse(savedPlayers);
        for (let i = 0; i < parsedPlayers.length && i < 4; i++) {
          newPlayers[i + 1] = parsedPlayers[i].displayName || '';
        }
      }
      
      setPlayers(newPlayers);
      
      // Check for course from sessionStorage
      const savedCourse = sessionStorage.getItem('selectedCourse');
      
      // Fetch available courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, name, location')
        .order('name');
      
      if (coursesData) {
        setCourses(coursesData);
      }
      
      if (savedCourse) {
        const course = JSON.parse(savedCourse);
        const matchingCourse = coursesData?.find(c => c.name === course.name);
        if (matchingCourse) {
          setSelectedCourseId(matchingCourse.id);
          return;
        }
      }
      
      if (coursesData && coursesData.length > 0) {
        setSelectedCourseId(coursesData[0].id);
      }
    };
    loadData();
  }, []);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  
  const updatePlayer = (index: number, value: string) => {
    const newPlayers = [...players];
    newPlayers[index] = value;
    setPlayers(newPlayers);
    setShuffled(false);
  };
  
  const handleShuffle = () => {
    // Get non-empty players
    const nonEmptyPlayers = players.filter(p => p.trim() !== '');
    if (nonEmptyPlayers.length < 3) {
      toast({ title: "Need at least 3 players to shuffle", variant: "destructive" });
      return;
    }
    
    const shuffledPlayers = shuffleArray(nonEmptyPlayers);
    
    // Pad back to 5 slots
    while (shuffledPlayers.length < 5) {
      shuffledPlayers.push('');
    }
    
    setPlayers(shuffledPlayers);
    setShuffled(true);
    toast({ title: "Player order randomized!" });
  };
  
  const getValidPlayerCount = () => {
    return players.filter(p => p.trim() !== '').length;
  };

  const handleStartGame = async () => {
    const validPlayers = players.filter(p => p.trim() !== '');
    
    if (validPlayers.length < 3) {
      toast({ title: "At least 3 players required", variant: "destructive" });
      return;
    }
    
    if (!shuffled) {
      toast({ title: "Please shuffle the player order first", variant: "destructive" });
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
        .from("wolf_games" as any)
        .insert({
          user_id: user.id,
          course_name: selectedCourse?.name || "Wolf Game",
          course_id: selectedCourseId || null,
          holes_played: 18,
          player_1: players[0],
          player_2: players[1],
          player_3: players[2],
          player_4: players[3] || null,
          player_5: players[4] || null,
          lone_wolf_win_points: loneWolfWinPoints,
          lone_wolf_loss_points: loneWolfLossPoints,
          team_win_points: teamWinPoints,
          wolf_position: wolfPosition,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Wolf game started!" });
      navigate(`/wolf/${(game as any).id}/play`);
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
          <h1 className="text-2xl font-bold text-foreground">Wolf Setup</h1>
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

        {/* Players */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users size={20} className="text-primary" />
              Players (3-5)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter player names. The order will be randomized for tee-off order.
            </p>
            
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="w-6 text-sm font-medium text-muted-foreground">
                  {shuffled ? `${index + 1}.` : '-'}
                </span>
                <Input
                  value={players[index]}
                  onChange={(e) => updatePlayer(index, e.target.value)}
                  placeholder={index < 3 ? `Player ${index + 1} (required)` : `Player ${index + 1} (optional)`}
                />
              </div>
            ))}
            
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={handleShuffle}
            >
              <Shuffle size={18} className="mr-2" />
              {shuffled ? 'Reshuffle Order' : 'Randomize Tee-Off Order'}
            </Button>
            
            {shuffled && (
              <p className="text-sm text-green-600 text-center">
                ✓ Order randomized! Player 1 tees off first on Hole 1.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Game Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings size={20} className="text-primary" />
              Game Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Wolf Position</Label>
              <Select value={wolfPosition} onValueChange={(v) => setWolfPosition(v as 'first' | 'last')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last">Wolf tees off Last</SelectItem>
                  <SelectItem value="first">Wolf tees off First</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines whether the Wolf hits first or last on each hole
              </p>
            </div>
            
            <div className="border-t pt-4 mt-4">
              <Label className="text-base font-semibold">Points Settings</Label>
            </div>
            
            <div className="space-y-2">
              <Label>Lone Wolf Win Points</Label>
              <Select value={loneWolfWinPoints.toString()} onValueChange={(v) => setLoneWolfWinPoints(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} points</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Points the Lone Wolf earns when winning solo
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Lone Wolf Loss Points (per opponent)</Label>
              <Select value={loneWolfLossPoints.toString()} onValueChange={(v) => setLoneWolfLossPoints(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} points</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Points each opponent earns when Lone Wolf loses
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Team Win Points (per player)</Label>
              <Select value={teamWinPoints.toString()} onValueChange={(v) => setTeamWinPoints(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} points</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Points each winning team member earns in 2v2 or 2v1 matchups
              </p>
            </div>
          </CardContent>
        </Card>

        <Button 
          onClick={handleStartGame} 
          disabled={loading || getValidPlayerCount() < 3 || !shuffled} 
          className="w-full" 
          size="lg"
        >
          {loading ? "Starting..." : "Start Wolf Game"}
        </Button>
      </div>
    </div>
  );
}
