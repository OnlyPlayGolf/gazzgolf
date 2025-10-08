import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RoundSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courseName, setCourseName] = useState("");
  const [teeSet, setTeeSet] = useState("");
  const [holesPlayed, setHolesPlayed] = useState<9 | 18>(18);
  const [loading, setLoading] = useState(false);

  const handleStartRound = async () => {
    if (!courseName.trim()) {
      toast({
        title: "Course name required",
        description: "Please enter a course name",
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
            course_name: courseName,
            tee_set: teeSet,
            holes_played: holesPlayed,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Round started!",
        description: `Good luck at ${courseName}`,
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

  const teeOptions = ["White", "Yellow", "Blue", "Red", "Black"];

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/rounds")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2" size={20} />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Start New Round</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="course">Course Name</Label>
              <Input
                id="course"
                placeholder="Enter course name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tee Set</Label>
              <div className="flex flex-wrap gap-2">
                {teeOptions.map((tee) => (
                  <Button
                    key={tee}
                    variant={teeSet === tee ? "default" : "outline"}
                    onClick={() => setTeeSet(tee)}
                    className="flex-1 min-w-[80px]"
                  >
                    {tee}
                  </Button>
                ))}
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
              {loading ? "Starting..." : "Start Round"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RoundSetup;
