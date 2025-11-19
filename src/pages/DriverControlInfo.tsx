import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function DriverControlInfo() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20 space-y-4 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-6 w-6" />
              About Driver Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Overview</h3>
              <p className="text-sm text-muted-foreground">
                The Driver Control drill tests your accuracy off the tee with 14 shots. 
                Perfect for range sessions or on-course practice (one shot per hole). 
                The fairway is 30 meters wide, simulating real playing conditions.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Scoring System</h3>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li><strong>Fairway Hit:</strong> +1 point</li>
                <li><strong>Miss Left:</strong> 0, -1, or -2 points (randomized per shot)</li>
                <li><strong>Miss Right:</strong> 0, -1, or -2 points (randomized per shot)</li>
              </ul>
              <p className="text-sm text-muted-foreground italic mt-2">
                Each shot has a unique point structure, keeping you focused and engaged throughout the drill.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Bonus Streak Mechanic</h3>
              <p className="text-sm text-muted-foreground">
                Consistency is rewarded! After hitting 3 consecutive fairways, you'll enter bonus territory.
                Each additional fairway hit earns you +1 bonus point on top of the base point, until you miss.
              </p>
              <div className="bg-muted/50 p-3 rounded-lg mt-2">
                <p className="text-sm font-semibold mb-1">Example:</p>
                <p className="text-sm text-muted-foreground">
                  Shot 1: FIR (+1) → Shot 2: FIR (+1) → Shot 3: FIR (+1)<br/>
                  Shot 4: FIR (+1 base +1 bonus = +2) → Shot 5: FIR (+1 +1 = +2)<br/>
                  Shot 6: Miss Left (-1) → Bonus streak resets
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Tips</h3>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Focus on hitting the center of the fairway to build your streak</li>
                <li>Don't let negative points discourage you - stay committed to your routine</li>
                <li>Use this drill to develop consistency rather than chasing distance</li>
                <li>Track your progress over time to see improvement in fairway accuracy</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
