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
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Overview</h3>
            <p className="text-sm text-muted-foreground">
              Complete 18 randomized short-game stations designed to test your up-and-down ability from a variety of lies and distances.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">How It Works</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• You'll complete 18 total stations, each assigned a lie and distance</li>
              <li>• Stations are randomized every time you start the drill</li>
              <li>• After each shot, record how many strokes it took you to hole out</li>
              <li>• Your final score is the total number of shots across all stations</li>
              <li>• Place the ball in the fairway and bunker. Knee high drop in the rough.</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Stations</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Bunker shots: 10m (×2), 20m (×2)</li>
              <li>• Rough chips: 10m (×2), 20m (×2)</li>
              <li>• Fairway chips: 10m (×2), 15m (×4), 20m (×2), 30m (×2)</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Scoring System</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Record the number of strokes needed to finish each station</li>
              <li>• Your total score = sum of all 18 stations</li>
              <li>• Lower is better</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
