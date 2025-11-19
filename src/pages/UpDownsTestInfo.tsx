import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function UpDownsTestInfo() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-6 w-6" />
          18 Up & Downs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Complete 18 randomized short game stations testing your up and down ability from various lies and distances.
          </p>
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Stations:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Bunker shots: 10m (×2), 20m (×2)</li>
              <li>• Rough chips: 10m (×2), 20m (×2)</li>
              <li>• Fairway chips: 10m (×2), 15m (×4), 20m (×2), 30m (×2)</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Scoring:</h3>
            <p className="text-sm text-muted-foreground">
              Record how many shots it takes to hole out from each station. Your score is the total number of shots needed. Lower is better!
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">How to Play:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Stations are randomized each time you start the drill</li>
              <li>• Use the number pad to enter your score for each station</li>
              <li>• For scores above 9, tap numbers multiple times (e.g., tap 1 twice for 11)</li>
              <li>• Click "Next Shot" to confirm and move to the next station</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Note:</h3>
            <p className="text-sm text-muted-foreground">
              This drill can be done on the practice area or on the course (one station per hole).
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
