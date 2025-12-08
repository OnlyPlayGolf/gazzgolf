import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Settings } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string;
  name: string;
  location: string | null;
}

interface Player {
  userId: string;
  displayName: string;
  teeColor: string;
}

export default function StrokePlaySetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Course from sessionStorage
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedHoles, setSelectedHoles] = useState<"18" | "front9" | "back9">("18");
  const [teeColor, setTeeColor] = useState("");
  
  // Players
  const [currentUserName, setCurrentUserName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Game settings
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [gimmesEnabled, setGimmesEnabled] = useState(false);

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
      
      setCurrentUserName(profile?.display_name || profile?.username || 'You');
      
      // Load course from sessionStorage
      const savedCourse = sessionStorage.getItem('selectedCourse');
      if (savedCourse) {
        setSelectedCourse(JSON.parse(savedCourse));
      }
      
      // Load holes selection
      const savedHoles = sessionStorage.getItem('selectedHoles');
      if (savedHoles) {
        setSelectedHoles(savedHoles as "18" | "front9" | "back9");
      }
      
      // Load tee color
      const savedTee = sessionStorage.getItem('userTeeColor');
      if (savedTee) {
        setTeeColor(savedTee);
      }
      
      // Load added players
      const savedPlayers = sessionStorage.getItem('roundPlayers');
      if (savedPlayers) {
        setPlayers(JSON.parse(savedPlayers));
      }
      
      // Load stroke play settings
      const savedSettings = sessionStorage.getItem('strokePlaySettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
        setHandicapEnabled(settings.handicapEnabled || false);
        setGimmesEnabled(settings.gimmesEnabled || false);
      }
    };
    loadData();
  }, []);

  const getHolesPlayed = (): number => {
    switch (selectedHoles) {
      case "front9":
      case "back9":
        return 9;
      default:
        return 18;
    }
  };

  const handleStartRound = async () => {
    if (!selectedCourse) {
      toast({ title: "Course required", description: "Please go back and select a course", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: round, error } = await supabase
        .from("rounds")
        .insert({
          user_id: user.id,
          course_name: selectedCourse.name,
          tee_set: teeColor,
          holes_played: getHolesPlayed(),
          origin: 'play',
          date_played: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;

      // Add current user as first player
      const playersToAdd = [{
        round_id: round.id,
        user_id: user.id,
        tee_color: teeColor
      }];

      // Add selected friends
      players.forEach((player) => {
        playersToAdd.push({
          round_id: round.id,
          user_id: player.userId,
          tee_color: player.teeColor
        });
      });

      const { error: playersError } = await supabase
        .from('round_players')
        .insert(playersToAdd);

      if (playersError) {
        console.error("Error adding players:", playersError);
      }

      // Save stroke play settings to sessionStorage for use during round
      sessionStorage.setItem('strokePlaySettings', JSON.stringify({
        mulligansPerPlayer,
        handicapEnabled,
        gimmesEnabled,
      }));

      // Clear setup sessionStorage
      sessionStorage.removeItem('roundPlayers');
      sessionStorage.removeItem('userTeeColor');
      sessionStorage.removeItem('selectedCourse');
      sessionStorage.removeItem('selectedHoles');
      sessionStorage.removeItem('roundName');
      sessionStorage.removeItem('datePlayer');

      toast({ title: "Round started!", description: `Good luck at ${selectedCourse.name}` });
      navigate(`/rounds/${round.id}/track`);
    } catch (error: any) {
      toast({ title: "Error creating round", description: error.message, variant: "destructive" });
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
          <h1 className="text-2xl font-bold text-foreground">Stroke Play Setup</h1>
        </div>

        {/* Course Info */}
        {selectedCourse && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin size={20} className="text-primary" />
                Course
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="font-semibold">{selectedCourse.name}</div>
                {selectedCourse.location && (
                  <div className="text-sm text-muted-foreground">{selectedCourse.location}</div>
                )}
                <div className="text-sm text-muted-foreground mt-1">
                  {selectedHoles === "18" ? "18 holes" : selectedHoles === "front9" ? "Front 9" : "Back 9"}
                  {teeColor && ` • ${teeColor} tees`}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Players */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users size={20} className="text-primary" />
              Players
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg border bg-primary/5 border-primary/20">
              <div className="font-medium">{currentUserName}</div>
              <div className="text-sm text-muted-foreground">{teeColor || "No tee selected"}</div>
            </div>
            {players.map((player, index) => (
              <div key={index} className="p-3 rounded-lg border bg-muted/30">
                <div className="font-medium">{player.displayName}</div>
                <div className="text-sm text-muted-foreground">{player.teeColor}</div>
              </div>
            ))}
            {players.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No additional players added
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
            {/* Handicap toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="handicap">Use Handicaps</Label>
                <p className="text-xs text-muted-foreground">
                  Apply player handicaps to scoring
                </p>
              </div>
              <Switch
                id="handicap"
                checked={handicapEnabled}
                onCheckedChange={setHandicapEnabled}
              />
            </div>

            {/* Mulligans per player */}
            <div className="space-y-2">
              <Label htmlFor="mulligans">Mulligans per Player</Label>
              <Select 
                value={mulligansPerPlayer.toString()} 
                onValueChange={(value) => setMulligansPerPlayer(parseInt(value))}
              >
                <SelectTrigger id="mulligans">
                  <SelectValue placeholder="Select mulligans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 (No mulligans)</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="9">9 (1 per hole on 9)</SelectItem>
                  <SelectItem value="18">18 (1 per hole on 18)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Number of allowed do-overs per player
              </p>
            </div>

            {/* Gimmes toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="gimmes">Allow Gimmes</Label>
                <p className="text-xs text-muted-foreground">
                  Short putts can be conceded
                </p>
              </div>
              <Switch
                id="gimmes"
                checked={gimmesEnabled}
                onCheckedChange={setGimmesEnabled}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleStartRound} disabled={loading || !selectedCourse} className="w-full" size="lg">
          {loading ? "Starting..." : "Start Round"}
        </Button>
      </div>
    </div>
  );
}
