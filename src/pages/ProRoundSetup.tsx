import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, ChevronsUpDown, TrendingUp, ClipboardList, Camera, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StatsRoundsHistory } from "@/components/StatsRoundsHistory";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { RoundTypeSelector, RoundType } from "@/components/RoundTypeSelector";
import { getDefaultTeeFromPreferences } from "@/utils/teeSystem";
import { format } from "date-fns";
import { TopNavBar } from "@/components/TopNavBar";

type StatsMode = "strokes_gained" | "basic_stats";

interface Course {
  id: string;
  name: string;
  location: string | null;
  tee_names: Record<string, string> | null;
}

interface AvailableTee {
  key: string;
  name: string;
}

const ProRoundSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [statsMode, setStatsMode] = useState<StatsMode | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [teeSet, setTeeSet] = useState("");
  const [holesPlayed, setHolesPlayed] = useState<9 | 18>(18);
  const [startingHole, setStartingHole] = useState<1 | 10>(1);
  const [loading, setLoading] = useState(false);
  const [availableTees, setAvailableTees] = useState<AvailableTee[]>([]);
  const [roundType, setRoundType] = useState<RoundType>("fun_practice");
  const [courseSearchOpen, setCourseSearchOpen] = useState(false);
  const [roundName, setRoundName] = useState("");
  const [datePlayed, setDatePlayed] = useState(new Date().toISOString().split("T")[0]);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, location, tee_names")
        .order("name");
      
      if (!error && data) {
        setCourses(data.map(c => ({
          ...c,
          tee_names: c.tee_names as Record<string, string> | null
        })));
      }
    };
    fetchCourses();
  }, []);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // Fetch available tees when course changes
  useEffect(() => {
    const fetchAvailableTees = async () => {
      if (!selectedCourseId) {
        setAvailableTees([]);
        setTeeSet("");
        return;
      }

      // Get course holes to see which tees have distance data
      const { data: holes, error } = await supabase
        .from("course_holes")
        .select("black_distance, white_distance, silver_distance, gold_distance, yellow_distance, blue_distance, red_distance, orange_distance")
        .eq("course_id", selectedCourseId)
        .limit(1);

      if (error || !holes || holes.length === 0) {
        // Fallback to default tees if no hole data
        const defaultTees = [
          { key: "white", name: "White" },
          { key: "yellow", name: "Yellow" },
          { key: "blue", name: "Blue" },
          { key: "red", name: "Red" },
        ];
        setAvailableTees(defaultTees);
        return;
      }

      const hole = holes[0];
      const teeMapping: { key: string; distanceKey: keyof typeof hole; defaultName: string }[] = [
        { key: "black", distanceKey: "black_distance", defaultName: "Black" },
        { key: "white", distanceKey: "white_distance", defaultName: "White" },
        { key: "silver", distanceKey: "silver_distance", defaultName: "Silver" },
        { key: "gold", distanceKey: "gold_distance", defaultName: "Gold" },
        { key: "yellow", distanceKey: "yellow_distance", defaultName: "Yellow" },
        { key: "blue", distanceKey: "blue_distance", defaultName: "Blue" },
        { key: "red", distanceKey: "red_distance", defaultName: "Red" },
        { key: "orange", distanceKey: "orange_distance", defaultName: "Orange" },
      ];

      const course = courses.find(c => c.id === selectedCourseId);
      const teeNames = course?.tee_names || {};

      const available: AvailableTee[] = [];
      for (const tee of teeMapping) {
        if (hole[tee.distanceKey] !== null) {
          available.push({
            key: tee.key,
            name: teeNames[tee.key] || tee.defaultName,
          });
        }
      }

      // If no tees have data, show defaults
      if (available.length === 0) {
        const defaultTees = [
          { key: "white", name: teeNames["white"] || "White" },
          { key: "yellow", name: teeNames["yellow"] || "Yellow" },
          { key: "blue", name: teeNames["blue"] || "Blue" },
          { key: "red", name: teeNames["red"] || "Red" },
        ];
        setAvailableTees(defaultTees);
      } else {
        setAvailableTees(available);
      }

      // Set default tee based on user preference
      const prefTee = getDefaultTeeFromPreferences();
      // Map difficulty-based preference to available color-based tees
      const difficultyToColorMap: Record<string, string[]> = {
        "longest": ["black", "gold"],
        "long": ["blue", "white"],
        "medium": ["white", "yellow"],
        "short": ["yellow", "red"],
        "shortest": ["red", "orange"],
      };
      const preferredColors = difficultyToColorMap[prefTee] || ["blue", "white"];
      const teesToCheck = available.length > 0 ? available : [
        { key: "white", name: "White" },
        { key: "yellow", name: "Yellow" },
        { key: "blue", name: "Blue" },
        { key: "red", name: "Red" },
      ];
      const matchedTee = teesToCheck.find(t => preferredColors.includes(t.key));
      if (matchedTee) {
        setTeeSet(matchedTee.key);
      } else if (teesToCheck.length > 0) {
        // Fallback to first available
        setTeeSet(teesToCheck[0].key);
      }
    };

    fetchAvailableTees();
  }, [selectedCourseId, courses]);

  const handleStartRound = async () => {
    if (!statsMode) {
      toast({
        title: "Select stats mode",
        description: "Choose Strokes Gained or Basic Stats",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCourseId) {
      toast({
        title: "Course required",
        description: "Please select a course",
        variant: "destructive",
      });
      return;
    }

    // Tee set only required for Strokes Gained mode
    if (statsMode === "strokes_gained" && !teeSet) {
      toast({
        title: "Tee set required",
        description: "Please select a tee set for Strokes Gained tracking",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get the display name for the selected tee
      const selectedTeeDisplay = availableTees.find(t => t.key === teeSet)?.name || teeSet;

      const { data: round, error } = await supabase
        .from("rounds")
        .insert([
          {
            user_id: user.id,
            course_name: selectedCourse?.name || "",
            round_name: roundName.trim() || null,
            date_played: datePlayed,
            tee_set: selectedTeeDisplay || null,
            holes_played: holesPlayed,
            starting_hole: startingHole,
            origin: statsMode === "strokes_gained" ? 'pro_stats' : 'basic_stats',
            round_type: roundType,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Store course_id in sessionStorage for the tracker to use
      sessionStorage.setItem('proStatsCourseId', selectedCourseId);
      sessionStorage.setItem('proStatsTeeSet', teeSet);
      sessionStorage.setItem('statsMode', statsMode);

      const modeName = statsMode === "strokes_gained" ? "Strokes Gained" : "Basic Stats";
      toast({
        title: `${modeName} round started!`,
        description: `Good luck at ${selectedCourse?.name}`,
      });

      // Navigate to appropriate tracker
      if (statsMode === "strokes_gained") {
        navigate(`/rounds/${round.id}/pro-track`);
      } else {
        navigate(`/rounds/${round.id}/basic-track`);
      }
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

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Add Stats</h1>
          <p className="text-muted-foreground text-sm">Create a stats round and start entering your scorecard</p>
        </div>

        <Button
          variant="ghost"
          onClick={() => navigate("/practice")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2" size={20} />
          Back
        </Button>

        {/* Scan Scorecard Option */}
        <Card className="mb-6 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Scan Paper Scorecard
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Take a photo of your scorecard to automatically import scores
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate("/scorecard-scanner")}
              >
                Scan Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Mode Selector */}
        <div className={cn("mb-6", statsMode && "mb-0")}>
          <Label className="text-lg font-semibold mb-3 block">Choose Stats Mode</Label>
          <div className="grid grid-cols-2 gap-4">
            <Card 
              className={cn(
                "cursor-pointer transition-all",
                statsMode === "strokes_gained" 
                  ? "border-primary ring-2 ring-primary" 
                  : "hover:border-primary/50"
              )}
              onClick={() => setStatsMode("strokes_gained")}
            >
              <CardContent className="p-4 text-center">
                <TrendingUp className="mx-auto mb-2 text-primary" size={32} />
                <h3 className="font-semibold">Strokes Gained</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Track exact distances for detailed SG analysis
                </p>
              </CardContent>
            </Card>

            <Card 
              className={cn(
                "cursor-pointer transition-all",
                statsMode === "basic_stats" 
                  ? "border-primary ring-2 ring-primary" 
                  : "hover:border-primary/50"
              )}
              onClick={() => setStatsMode("basic_stats")}
            >
              <CardContent className="p-4 text-center">
                <ClipboardList className="mx-auto mb-2 text-primary" size={32} />
                <h3 className="font-semibold">Basic Stats</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Track fairways, GIR, putts & chips
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {statsMode && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>
                {statsMode === "strokes_gained" ? "Strokes Gained" : "Basic Stats"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {statsMode === "strokes_gained" 
                  ? "Track exact distances and get detailed strokes gained analysis"
                  : "Quick entry for fairways, greens in regulation, and putting"
                }
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Round Name & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Round Name</Label>
                  <Input
                    value={roundName}
                    onChange={(e) => setRoundName(e.target.value)}
                    placeholder="Round name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {format(new Date(datePlayed + 'T12:00:00'), "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={new Date(datePlayed + 'T12:00:00')}
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            setDatePlayed(`${year}-${month}-${day}`);
                            setDatePopoverOpen(false);
                          }
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Course</Label>
                <Popover open={courseSearchOpen} onOpenChange={setCourseSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={courseSearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedCourseId
                        ? courses.find((course) => course.id === selectedCourseId)?.name
                        : "Select a course..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search courses..." />
                      <CommandList>
                        <CommandEmpty>No course found.</CommandEmpty>
                        <CommandGroup>
                          {courses.map((course) => (
                            <CommandItem
                              key={course.id}
                              value={course.name}
                              onSelect={() => {
                                setSelectedCourseId(course.id);
                                setCourseSearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCourseId === course.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {course.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Tee Set - only for Strokes Gained */}
              {statsMode === "strokes_gained" && (
                <div className="space-y-2">
                  <Label>Tee Set</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableTees.length > 0 ? (
                      availableTees.map((tee) => (
                        <Button
                          key={tee.key}
                          variant={teeSet === tee.key ? "default" : "outline"}
                          onClick={() => setTeeSet(tee.key)}
                          className="flex-1 min-w-[80px]"
                        >
                          {tee.name}
                        </Button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Select a course first</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Holes</Label>
                <div className="flex gap-2">
                  <Button
                    variant={holesPlayed === 18 ? "default" : "outline"}
                    onClick={() => {
                      setHolesPlayed(18);
                      setStartingHole(1);
                    }}
                    className="flex-1"
                  >
                    Full 18
                  </Button>
                  <Button
                    variant={holesPlayed === 9 && startingHole === 1 ? "default" : "outline"}
                    onClick={() => {
                      setHolesPlayed(9);
                      setStartingHole(1);
                    }}
                    className="flex-1"
                  >
                    Front 9
                  </Button>
                  <Button
                    variant={holesPlayed === 9 && startingHole === 10 ? "default" : "outline"}
                    onClick={() => {
                      setHolesPlayed(9);
                      setStartingHole(10);
                    }}
                    className="flex-1"
                  >
                    Back 9
                  </Button>
                </div>
              </div>

              <RoundTypeSelector value={roundType} onChange={setRoundType} />

              <Button
                onClick={handleStartRound}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? "Starting..." : "Enter Stats"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full mt-6 mb-6 bg-green-500 hover:bg-green-600 text-white"
          onClick={() => navigate('/statistics')}
        >
          View All Statistics
        </Button>

        <StatsRoundsHistory />
      </div>
    </div>
  );
};

export default ProRoundSetup;
