import { useState, useEffect } from "react";
import { Info, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, MapPin, Users, ChevronRight, Plus } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AISetupAssistant } from "@/components/AISetupAssistant";
import { GameConfiguration } from "@/types/gameConfig";

type HoleCount = "18" | "front9" | "back9";

interface Course {
  id: string;
  name: string;
  location: string;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
  white_distance: number | null;
  yellow_distance: number | null;
  blue_distance: number | null;
  red_distance: number | null;
  orange_distance: number | null;
}

export default function RoundsPlay() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedHoles, setSelectedHoles] = useState<HoleCount>("18");
  const [roundName, setRoundName] = useState("");
  const [datePlayer, setDatePlayed] = useState(new Date().toISOString().split('T')[0]);
  const [teeColor, setTeeColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableTees, setAvailableTees] = useState<string[]>([]);
  const [selectedPlayersCount, setSelectedPlayersCount] = useState(0);
  const [gameFormat, setGameFormat] = useState<"stroke_play" | "umbriago" | "wolf">("stroke_play");
  const [strokePlaySettings, setStrokePlaySettings] = useState({
    mulligansPerPlayer: 0,
    handicapEnabled: false,
    gimmesEnabled: false,
  });
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [courseHoles, setCourseHoles] = useState<{ holeNumber: number; par: number; strokeIndex: number }[]>([]);

  useEffect(() => {
    fetchCourses();
    fetchRoundCount();
    
    // Check for saved players on mount
    const savedPlayers = sessionStorage.getItem('roundPlayers');
    const savedTee = sessionStorage.getItem('userTeeColor');
    if (savedPlayers) {
      const players = JSON.parse(savedPlayers);
      setSelectedPlayersCount(players.length);
    }
    if (savedTee) {
      setTeeColor(savedTee);
    }

    // Restore game setup state
    const savedCourse = sessionStorage.getItem('selectedCourse');
    const savedHoles = sessionStorage.getItem('selectedHoles');
    const savedRoundName = sessionStorage.getItem('roundName');
    const savedDate = sessionStorage.getItem('datePlayer');
    
    if (savedCourse) {
      setSelectedCourse(JSON.parse(savedCourse));
    }
    if (savedHoles) {
      setSelectedHoles(savedHoles as HoleCount);
    }
    if (savedRoundName) {
      setRoundName(savedRoundName);
    }
    if (savedDate) {
      setDatePlayed(savedDate);
    }

    // Restore stroke play settings
    const savedStrokePlaySettings = sessionStorage.getItem('strokePlaySettings');
    if (savedStrokePlaySettings) {
      setStrokePlaySettings(JSON.parse(savedStrokePlaySettings));
    }
  }, []);

  const fetchRoundCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from("rounds")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (error) throw error;
      
      // Only set default if no saved round name exists
      const savedRoundName = sessionStorage.getItem('roundName');
      if (!savedRoundName) {
        setRoundName(`Round ${(count || 0) + 1}`);
      }
    } catch (error: any) {
      console.error("Error fetching round count:", error);
      setRoundName("Round 1");
    }
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = courses.filter((course) =>
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCourses(filtered);
    } else {
      setFilteredCourses(courses);
    }
  }, [searchQuery, courses]);

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseTees(selectedCourse.id);
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("name");

      if (error) throw error;
      setCourses(data || []);
      setFilteredCourses(data || []);
    } catch (error: any) {
      console.error("Error fetching courses:", error);
    }
  };

  const fetchCourseTees = async (courseId: string) => {
    try {
      const { data, error } = await supabase
        .from("course_holes")
        .select("*")
        .eq("course_id", courseId)
        .order("hole_number");

      if (error) throw error;

      if (data && data.length > 0) {
        const firstHole = data[0];
        const tees: string[] = [];
        if (firstHole.white_distance) tees.push("White");
        if (firstHole.yellow_distance) tees.push("Yellow");
        if (firstHole.blue_distance) tees.push("Blue");
        if (firstHole.red_distance) tees.push("Red");
        if (firstHole.orange_distance) tees.push("Orange");

        setAvailableTees(tees);
        if (tees.length > 0 && !teeColor) {
          setTeeColor(tees[0]);
        }

        // Store course holes for AI assistant
        setCourseHoles(data.map(h => ({
          holeNumber: h.hole_number,
          par: h.par,
          strokeIndex: h.stroke_index
        })));
      }
    } catch (error: any) {
      console.error("Error fetching tees:", error);
      setAvailableTees(["White", "Yellow", "Blue", "Red", "Black"]);
    }
  };

  const handleApplyAIConfig = (config: GameConfiguration) => {
    // Apply game format
    if (config.baseFormat === 'stroke_play' || config.baseFormat === 'stableford') {
      setGameFormat('stroke_play');
    } else if (config.baseFormat === 'umbriago') {
      setGameFormat('umbriago');
    } else if (config.baseFormat === 'wolf') {
      setGameFormat('wolf');
    }

    // Apply stroke play settings
    setStrokePlaySettings({
      mulligansPerPlayer: config.mulligansPerPlayer || 0,
      handicapEnabled: config.useHandicaps,
      gimmesEnabled: config.gimmesEnabled || false,
    });

    // Store AI config for downstream pages
    sessionStorage.setItem('aiGameConfig', JSON.stringify(config));
    
    toast({
      title: "AI Configuration Applied",
      description: `${config.baseFormat.replace('_', ' ')} with ${config.totalHoles} holes configured!`,
    });
  };


  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
    setSearchQuery("");
  };

  const getHolesPlayed = (holeCount: HoleCount): number => {
    switch (holeCount) {
      case "front9":
        return 9;
      case "back9":
        return 9;
      default:
        return 18;
    }
  };

  const handleStartRound = async () => {
    if (!selectedCourse) {
      toast({
        title: "Course required",
        description: "Please select a course",
        variant: "destructive",
      });
      return;
    }

    if (!teeColor) {
      toast({
        title: "Tee color required",
        description: "Please select a tee color",
        variant: "destructive",
      });
      return;
    }

    // Save course to sessionStorage for all game formats
    sessionStorage.setItem('selectedCourse', JSON.stringify(selectedCourse));
    sessionStorage.setItem('selectedHoles', selectedHoles);

    // If Stroke Play is selected, navigate to Stroke Play setup
    if (gameFormat === "stroke_play") {
      navigate('/stroke-play/setup');
      return;
    }

    // If Umbriago is selected, navigate to Umbriago setup
    if (gameFormat === "umbriago") {
      navigate('/umbriago/setup');
      return;
    }

    // If Wolf is selected, navigate to Wolf setup
    if (gameFormat === "wolf") {
      navigate('/wolf/setup');
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
        .insert([
          {
            user_id: user.id,
            course_name: selectedCourse.name,
            tee_set: teeColor,
            holes_played: getHolesPlayed(selectedHoles),
            origin: 'play',
            date_played: datePlayer,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Get saved players from sessionStorage
      const savedPlayers = sessionStorage.getItem('roundPlayers');
      const savedTee = sessionStorage.getItem('userTeeColor');
      
      // Add current user as first player with their tee
      const playersToAdd = [{
        round_id: round.id,
        user_id: user.id,
        tee_color: savedTee || teeColor
      }];

      // Add selected friends with their tees
      if (savedPlayers) {
        const players = JSON.parse(savedPlayers);
        players.forEach((player: any) => {
          playersToAdd.push({
            round_id: round.id,
            user_id: player.userId,
            tee_color: player.teeColor
          });
        });
      }

      const { error: playersError } = await supabase
        .from('round_players')
        .insert(playersToAdd);

      if (playersError) {
        console.error("Error adding players:", playersError);
        // Continue anyway since the round was created
      }

      // Clear sessionStorage
      sessionStorage.removeItem('roundPlayers');
      sessionStorage.removeItem('userTeeColor');
      sessionStorage.removeItem('selectedCourse');
      sessionStorage.removeItem('selectedHoles');
      sessionStorage.removeItem('roundName');
      sessionStorage.removeItem('datePlayer');

      toast({
        title: "Round started!",
        description: `Good luck at ${selectedCourse.name}`,
      });

      navigate(`/rounds/${round.id}/track`);
    } catch (error: any) {
      toast({
        title: "Error creating round",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openPlayersPage = () => {
    // Save game setup state before navigating
    if (selectedCourse) {
      sessionStorage.setItem('selectedCourse', JSON.stringify(selectedCourse));
    }
    sessionStorage.setItem('selectedHoles', selectedHoles);
    sessionStorage.setItem('roundName', roundName);
    sessionStorage.setItem('datePlayer', datePlayer);
    
    const tees = availableTees.length > 0 ? availableTees : ["White", "Yellow", "Blue", "Red"];
    navigate(`/rounds/manage-players?tees=${tees.join(',')}`);
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-6">
        {/* Game Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="text-primary" size={20} />
              Game Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Course Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin size={16} />
                Course
              </Label>
              {!selectedCourse ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder="Search courses..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {filteredCourses.length > 0 && searchQuery && (
                    <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
                      {filteredCourses.slice(0, 5).map((course) => (
                        <button
                          key={course.id}
                          onClick={() => handleCourseSelect(course)}
                          className="w-full p-2 rounded-md hover:bg-muted text-left text-sm"
                        >
                          <div className="font-medium">{course.name}</div>
                          <div className="text-xs text-muted-foreground">{course.location}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg border-2 border-primary bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{selectedCourse.name}</div>
                      <div className="text-xs text-muted-foreground">{selectedCourse.location}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCourse(null);
                        setTeeColor("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Holes Selection */}
            <div className="space-y-2">
              <Label>Holes</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedHoles("18")}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    selectedHoles === "18"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold text-sm">Full 18</div>
                </button>
                <button
                  onClick={() => setSelectedHoles("front9")}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    selectedHoles === "front9"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold text-sm">Front 9</div>
                </button>
                <button
                  onClick={() => setSelectedHoles("back9")}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    selectedHoles === "back9"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold text-sm">Back 9</div>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="round-name">Round Name</Label>
              <Input
                id="round-name"
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tee-color">Tee Color</Label>
              <Select value={teeColor} onValueChange={setTeeColor}>
                <SelectTrigger id="tee-color">
                  <SelectValue placeholder="Select tee color" />
                </SelectTrigger>
                <SelectContent>
                  {availableTees.length > 0 ? (
                    availableTees.map((tee) => (
                      <SelectItem key={tee} value={tee}>
                        {tee}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="White">White</SelectItem>
                      <SelectItem value="Yellow">Yellow</SelectItem>
                      <SelectItem value="Blue">Blue</SelectItem>
                      <SelectItem value="Red">Red</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Player Management */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Players</Label>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={openPlayersPage}
              >
                <Plus className="w-4 h-4" />
                Add Players
                {selectedPlayersCount > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    +{selectedPlayersCount} player{selectedPlayersCount !== 1 ? 's' : ''}
                  </span>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Game Format</Label>
              <div className="space-y-2">
                <div className="relative">
                  <button
                    onClick={() => setGameFormat("stroke_play")}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all pr-12 ${
                      gameFormat === "stroke_play"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="font-semibold text-sm">Stroke Play</div>
                    <div className="text-xs text-muted-foreground">
                      Standard scoring format
                      {(strokePlaySettings.mulligansPerPlayer > 0 || strokePlaySettings.handicapEnabled || strokePlaySettings.gimmesEnabled) && (
                        <span className="ml-1 text-primary">
                          ({[
                            strokePlaySettings.mulligansPerPlayer > 0 ? `${strokePlaySettings.mulligansPerPlayer} mulligan${strokePlaySettings.mulligansPerPlayer !== 1 ? 's' : ''}` : '',
                            strokePlaySettings.handicapEnabled ? 'HCP' : '',
                            strokePlaySettings.gimmesEnabled ? 'Gimmes' : ''
                          ].filter(Boolean).join(', ')})
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/stroke-play/settings');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted transition-colors"
                  >
                    <Info size={18} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setGameFormat("umbriago")}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all pr-12 ${
                      gameFormat === "umbriago"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="font-semibold text-sm">Umbriago</div>
                    <div className="text-xs text-muted-foreground">2v2 team game without handicap</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/umbriago/how-to-play');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted transition-colors"
                  >
                    <Info size={18} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setGameFormat("wolf")}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all pr-12 ${
                      gameFormat === "wolf"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="font-semibold text-sm">🐺 Wolf</div>
                    <div className="text-xs text-muted-foreground">3-5 players, Wolf picks partner or goes solo</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/wolf/how-to-play');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted transition-colors"
                  >
                    <Info size={18} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleStartRound}
                disabled={loading || !selectedCourse}
                className="w-full"
                size="lg"
              >
                {loading ? "Starting..." : "Start Round"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Assistant Floating Button */}
      <Button
        onClick={() => setShowAIAssistant(true)}
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg"
        size="icon"
      >
        <Sparkles className="w-6 h-6" />
      </Button>

      {/* AI Setup Assistant */}
      <AISetupAssistant
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        courseInfo={selectedCourse ? {
          courseName: selectedCourse.name,
          availableTees,
          defaultHoles: getHolesPlayed(selectedHoles),
          courseHoles,
        } : undefined}
        onApplyConfig={handleApplyAIConfig}
      />
    </div>
  );
}
