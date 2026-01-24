import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function JasonDayLagInfo() {
  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="text-primary" />
            About Lag Putting Drill 8-20m
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Overview</h3>
            <p className="text-muted-foreground">
              Lag Putting Drill 8-20m is designed to improve your lag putting skills from long distances. 
              This drill focuses on distance control and getting the ball close to the hole from 8-20 meters.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">How It Works</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>18 putts total from randomized distances between 8-20 meters</li>
              <li>Each distance appears only once (no repeats)</li>
              <li>Can be practiced on the putting green or on the course</li>
              <li>Track your proximity to the hole for each putt</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Scoring System</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>Holed:</strong> +3 points</li>
              <li><strong>Within 0.6m (2 feet):</strong> +2 points</li>
              <li><strong>0.6m-1m (2-3 feet):</strong> +1 point</li>
              <li><strong>1-2 meters:</strong> 0 points</li>
              <li><strong>2-3 meters:</strong> -1 point</li>
              <li><strong>Outside 3 meters:</strong> -2 points</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Tips</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Focus on consistent tempo and rhythm</li>
              <li>Read the green carefully for each putt</li>
              <li>Prioritize getting the speed right over perfect line</li>
              <li>Try to hole at least one or two long putts per round</li>
              <li>Aim to minimize negative scores by avoiding 3-putt territory</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
