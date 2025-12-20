import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

interface CourseScorecardProps {
  courseId: string;
  selectedTee?: string;
  selectedHoles?: "18" | "front9" | "back9";
}

const TEE_COLUMN_MAP: Record<string, keyof CourseHole> = {
  shortest: "red_distance",
  short: "yellow_distance",
  medium: "white_distance",
  long: "blue_distance",
  longest: "orange_distance",
};

export function CourseScorecard({ courseId, selectedTee = "medium", selectedHoles = "18" }: CourseScorecardProps) {
  const [holes, setHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (courseId) {
      fetchCourseHoles();
    }
  }, [courseId]);

  const fetchCourseHoles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("course_holes")
        .select("*")
        .eq("course_id", courseId)
        .order("hole_number");

      if (error) throw error;
      setHoles(data || []);
    } catch (error) {
      console.error("Error fetching course holes:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredHoles = () => {
    if (selectedHoles === "front9") return holes.filter(h => h.hole_number <= 9);
    if (selectedHoles === "back9") return holes.filter(h => h.hole_number > 9);
    return holes;
  };

  const getDistance = (hole: CourseHole) => {
    const column = TEE_COLUMN_MAP[selectedTee] || "white_distance";
    return (hole as any)[column] || null;
  };

  const filteredHoles = getFilteredHoles();
  const totalPar = filteredHoles.reduce((sum, h) => sum + h.par, 0);
  const totalDistance = filteredHoles.reduce((sum, h) => sum + (getDistance(h) || 0), 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="animate-pulse flex justify-center">
            <div className="h-4 bg-muted rounded w-32"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (holes.length === 0) {
    return null;
  }

  // Split into front 9 and back 9
  const front9 = filteredHoles.filter(h => h.hole_number <= 9);
  const back9 = filteredHoles.filter(h => h.hole_number > 9);

  const renderHoleRow = (holesData: CourseHole[], label: string) => {
    if (holesData.length === 0) return null;
    
    const subtotalPar = holesData.reduce((sum, h) => sum + h.par, 0);
    const subtotalDist = holesData.reduce((sum, h) => sum + (getDistance(h) || 0), 0);

    return (
      <div className="space-y-1">
        {/* Hole numbers */}
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `48px repeat(${holesData.length}, 1fr) 48px` }}>
          <div className="text-[10px] font-medium text-muted-foreground px-1 py-1">Hole</div>
          {holesData.map(hole => (
            <div key={hole.hole_number} className="text-center text-xs font-semibold py-1 bg-muted/50 rounded-t">
              {hole.hole_number}
            </div>
          ))}
          <div className="text-center text-[10px] font-medium text-muted-foreground py-1">{label}</div>
        </div>

        {/* Par */}
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `48px repeat(${holesData.length}, 1fr) 48px` }}>
          <div className="text-[10px] font-medium text-muted-foreground px-1">Par</div>
          {holesData.map(hole => (
            <div key={hole.hole_number} className="text-center text-xs py-0.5">
              {hole.par}
            </div>
          ))}
          <div className="text-center text-xs font-semibold">{subtotalPar}</div>
        </div>

        {/* Distance */}
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `48px repeat(${holesData.length}, 1fr) 48px` }}>
          <div className="text-[10px] font-medium text-muted-foreground px-1">Dist</div>
          {holesData.map(hole => {
            const dist = getDistance(hole);
            return (
              <div key={hole.hole_number} className="text-center text-[10px] text-muted-foreground py-0.5">
                {dist || "-"}
              </div>
            );
          })}
          <div className="text-center text-[10px] font-semibold text-muted-foreground">{subtotalDist}</div>
        </div>

        {/* Stroke Index */}
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `48px repeat(${holesData.length}, 1fr) 48px` }}>
          <div className="text-[10px] font-medium text-muted-foreground px-1">HCP</div>
          {holesData.map(hole => (
            <div key={hole.hole_number} className="text-center text-[10px] text-muted-foreground py-0.5 bg-muted/30 rounded-b">
              {hole.stroke_index}
            </div>
          ))}
          <div></div>
        </div>
      </div>
    );
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Scorecard
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Par {totalPar} • {totalDistance}m
                </span>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4 overflow-x-auto">
            {front9.length > 0 && renderHoleRow(front9, "OUT")}
            {back9.length > 0 && renderHoleRow(back9, "IN")}
            
            {/* Total */}
            {selectedHoles === "18" && front9.length > 0 && back9.length > 0 && (
              <div className="flex justify-end gap-4 pt-2 border-t text-xs">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold">Par {totalPar}</span>
                <span className="font-semibold text-muted-foreground">{totalDistance}m</span>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
