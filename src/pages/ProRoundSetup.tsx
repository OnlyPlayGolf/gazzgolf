import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProStatsAverages } from "@/components/ProStatsAverages";
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [teeSet, setTeeSet] = useState("");
  const [holesPlayed, setHolesPlayed] = useState<9 | 18>(18);
  const [loading, setLoading] = useState(false);
  const [availableTees, setAvailableTees] = useState<AvailableTee[]>([]);

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
        .select("white_distance, yellow_distance, blue_distance, red_distance, orange_distance")
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
        { key: "white", distanceKey: "white_distance", defaultName: "White" },
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

      // Reset tee selection when course changes
      setTeeSet("");
    };

    fetchAvailableTees();
  }, [selectedCourseId, courses]);

  const handleStartRound = async () => {
    if (!selectedCourseId) {
      toast({
        title: "Course required",
        description: "Please select a course",
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
            tee_set: selectedTeeDisplay,
            holes_played: holesPlayed,
            origin: 'pro_stats',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Store course_id in sessionStorage for the tracker to use
      sessionStorage.setItem('proStatsCourseId', selectedCourseId);
      sessionStorage.setItem('proStatsTeeSet', teeSet);

      toast({
        title: "Pro Round started!",
        description: `Good luck tracking strokes gained at ${selectedCourse?.name}`,
      });

      navigate(`/rounds/${round.id}/pro-track`);
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
      <div className="p-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/practice")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2" size={20} />
          Back
        </Button>

        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Start Pro Round (Strokes Gained)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Track exact distances and get detailed strokes gained analysis
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Course</Label>
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
            </div>

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

            <div className="space-y-2">
              <Label>Number of Holes</Label>
              <div className="flex gap-4">
                <Button
                  variant={holesPlayed === 9 ? "default" : "outline"}
                  onClick={() => setHolesPlayed(9)}
                  className="flex-1"
                >
                  9 Holes
                </Button>
                <Button
                  variant={holesPlayed === 18 ? "default" : "outline"}
                  onClick={() => setHolesPlayed(18)}
                  className="flex-1"
                >
                  18 Holes
                </Button>
              </div>
            </div>

            <Button
              onClick={handleStartRound}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Starting..." : "Start Pro Round"}
            </Button>
          </CardContent>
        </Card>

        <ProStatsAverages />
      </div>
    </div>
  );
};

export default ProRoundSetup;
