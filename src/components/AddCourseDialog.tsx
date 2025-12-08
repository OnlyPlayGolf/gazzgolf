import { useState } from "react";
import { Plus, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string;
  name: string;
  location: string;
}

interface HoleData {
  hole_number: number;
  par: number;
  distance: number;
  stroke_index: number;
}

interface AddCourseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseAdded: (course: Course) => void;
}

export function AddCourseDialog({ isOpen, onClose, onCourseAdded }: AddCourseDialogProps) {
  const { toast } = useToast();
  const [courseName, setCourseName] = useState("");
  const [courseLocation, setCourseLocation] = useState("");
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [teeColor, setTeeColor] = useState("White");
  const [holes, setHoles] = useState<HoleData[]>(() => 
    Array.from({ length: 18 }, (_, i) => ({
      hole_number: i + 1,
      par: 4,
      distance: 0,
      stroke_index: i + 1
    }))
  );
  const [saving, setSaving] = useState(false);

  const updateHole = (index: number, field: keyof HoleData, value: number) => {
    setHoles(prev => prev.map((hole, i) => 
      i === index ? { ...hole, [field]: value } : hole
    ));
  };

  const calculateTotalPar = () => {
    return holes.slice(0, holeCount).reduce((sum, h) => sum + h.par, 0);
  };

  const calculateTotalDistance = () => {
    return holes.slice(0, holeCount).reduce((sum, h) => sum + h.distance, 0);
  };

  const handleSave = async () => {
    if (!courseName.trim()) {
      toast({
        title: "Course name required",
        description: "Please enter a course name",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      // Create the course
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .insert({
          name: courseName.trim(),
          location: courseLocation.trim() || null
        })
        .select()
        .single();

      if (courseError) throw courseError;

      // Prepare hole data with the selected tee color
      const teeColorKey = `${teeColor.toLowerCase()}_distance` as 
        "white_distance" | "yellow_distance" | "blue_distance" | "red_distance" | "orange_distance";

      const holesData = holes.slice(0, holeCount).map(hole => ({
        course_id: courseData.id,
        hole_number: hole.hole_number,
        par: hole.par,
        stroke_index: hole.stroke_index,
        [teeColorKey]: hole.distance || null
      }));

      const { error: holesError } = await supabase
        .from("course_holes")
        .insert(holesData);

      if (holesError) throw holesError;

      toast({
        title: "Course created!",
        description: `${courseName} has been added successfully`
      });

      onCourseAdded({
        id: courseData.id,
        name: courseData.name,
        location: courseData.location || ""
      });

      // Reset form
      setCourseName("");
      setCourseLocation("");
      setHoles(Array.from({ length: 18 }, (_, i) => ({
        hole_number: i + 1,
        par: 4,
        distance: 0,
        stroke_index: i + 1
      })));
    } catch (error: any) {
      console.error("Error creating course:", error);
      toast({
        title: "Error creating course",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const teeColors = ["White", "Yellow", "Blue", "Red", "Orange"];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Add New Course
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            {/* Course Info */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="course-name">Course Name *</Label>
                <Input
                  id="course-name"
                  placeholder="e.g. Pebble Beach Golf Links"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="course-location">Location</Label>
                <Input
                  id="course-location"
                  placeholder="e.g. California, USA"
                  value={courseLocation}
                  onChange={(e) => setCourseLocation(e.target.value)}
                />
              </div>
            </div>

            {/* Hole Count Selection */}
            <div className="space-y-2">
              <Label>Number of Holes</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setHoleCount(9)}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    holeCount === 9
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  9 Holes
                </button>
                <button
                  onClick={() => setHoleCount(18)}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    holeCount === 18
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  18 Holes
                </button>
              </div>
            </div>

            {/* Tee Color Selection */}
            <div className="space-y-2">
              <Label>Tee Color for Distances</Label>
              <div className="flex flex-wrap gap-2">
                {teeColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setTeeColor(color)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      teeColor === color
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            {/* Scorecard Header */}
            <div className="pt-2">
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-2">
                <span>Hole</span>
                <span>Par</span>
                <span>Distance (m)</span>
                <span>HCP</span>
              </div>
            </div>

            {/* Scorecard Entries */}
            <div className="space-y-2">
              {holes.slice(0, holeCount).map((hole, index) => (
                <div key={index} className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-center font-semibold text-sm bg-muted rounded-lg py-2">
                    {hole.hole_number}
                  </div>
                  <select
                    value={hole.par}
                    onChange={(e) => updateHole(index, "par", parseInt(e.target.value))}
                    className="h-10 rounded-lg border bg-background px-2 text-sm"
                  >
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                  <Input
                    type="number"
                    placeholder="0"
                    value={hole.distance || ""}
                    onChange={(e) => updateHole(index, "distance", parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={18}
                    value={hole.stroke_index}
                    onChange={(e) => updateHole(index, "stroke_index", parseInt(e.target.value) || 1)}
                    className="h-10 text-sm"
                  />
                </div>
              ))}

              {/* Totals Row */}
              <div className="grid grid-cols-4 gap-2 items-center pt-2 border-t">
                <div className="text-center font-bold text-sm">Total</div>
                <div className="text-center font-bold text-sm">{calculateTotalPar()}</div>
                <div className="text-center font-bold text-sm">{calculateTotalDistance()}m</div>
                <div></div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t shrink-0 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Saving..." : "Add Course"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
