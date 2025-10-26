import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, MapPin, Users, ChevronRight } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const [roundName, setRoundName] = useState(`Round ${new Date().toLocaleDateString()}`);
  const [datePlayer, setDatePlayed] = useState(new Date().toISOString().split('T')[0]);
  const [teeColor, setTeeColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableTees, setAvailableTees] = useState<string[]>([]);

  useEffect(() => {
    fetchCourses();
  }, []);

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
        .limit(1)
        .single();

      if (error) throw error;

      const tees: string[] = [];
      if (data.white_distance) tees.push("White");
      if (data.yellow_distance) tees.push("Yellow");
      if (data.blue_distance) tees.push("Blue");
      if (data.red_distance) tees.push("Red");
      if (data.orange_distance) tees.push("Orange");

      setAvailableTees(tees);
      if (tees.length > 0 && !teeColor) {
        setTeeColor(tees[0]);
      }
    } catch (error: any) {
      console.error("Error fetching tees:", error);
      setAvailableTees(["White", "Yellow", "Blue", "Red", "Black"]);
    }
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
            date_played: datePlayer,
          },
        ])
        .select()
        .single();

      if (error) throw error;

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

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-6">
        {/* Course Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="text-primary" size={20} />
              Select Course
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedCourse ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {filteredCourses.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredCourses.map((course) => (
                      <button
                        key={course.id}
                        onClick={() => handleCourseSelect(course)}
                        className="w-full p-4 rounded-lg border-2 border-border hover:border-primary/50 text-left transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold group-hover:text-primary transition-colors">
                              {course.name}
                            </div>
                            <div className="text-sm text-muted-foreground">{course.location}</div>
                          </div>
                          <ChevronRight className="text-muted-foreground group-hover:text-primary transition-colors" size={20} />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">No courses found</p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{selectedCourse.name}</div>
                      <div className="text-sm text-muted-foreground">{selectedCourse.location}</div>
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

                <div className="space-y-3">
                  <Label className="text-base font-semibold">How many holes are you playing?</Label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedHoles("18")}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        selectedHoles === "18"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-semibold">Full 18</div>
                      <div className="text-sm text-muted-foreground">Play all 18 holes</div>
                    </button>
                    <button
                      onClick={() => setSelectedHoles("front9")}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        selectedHoles === "front9"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-semibold">Front 9</div>
                      <div className="text-sm text-muted-foreground">Play holes 1-9</div>
                    </button>
                    <button
                      onClick={() => setSelectedHoles("back9")}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        selectedHoles === "back9"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-semibold">Back 9</div>
                      <div className="text-sm text-muted-foreground">Play holes 10-18</div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Game Setup */}
        {selectedCourse && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="text-primary" size={20} />
                Game Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="round-name">Round Name</Label>
                  <Input
                    id="round-name"
                    value={roundName}
                    onChange={(e) => setRoundName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-1">
                    <Calendar size={14} />
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={datePlayer}
                    onChange={(e) => setDatePlayed(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tee-color">Tee Color</Label>
                <Select value={teeColor} onValueChange={setTeeColor}>
                  <SelectTrigger id="tee-color">
                    <SelectValue placeholder="Select tee color" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTees.map((tee) => (
                      <SelectItem key={tee} value={tee}>
                        {tee}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Game Format</Label>
                <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                  <div className="font-semibold">Stroke Play</div>
                  <div className="text-sm text-muted-foreground">Standard scoring format</div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleStartRound}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? "Starting..." : "Start Round"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
