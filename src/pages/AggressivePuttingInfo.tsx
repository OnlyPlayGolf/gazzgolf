import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function AggressivePuttingInfo() {
  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="text-primary" />
            About Aggressive Putting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Overview</h3>
            <p className="text-muted-foreground">
              The Aggressive Putting drill helps you become a more aggressive putter within 6 meters while still maintaining good speed control. The scoring system heavily rewards holed putts and penalizes cautious or overly aggressive putts.
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Tour Average:</strong> 12.28 putts
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">How It Works</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Choose any starting putt</li>
              <li>Distances cycle: 4m → 5m → 6m → repeat</li>
              <li>Reach 15 points in as few putts as possible</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Scoring System</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Holed putt = +3 points</li>
              <li>Good pace (within 3 ft past the hole) = +1 point</li>
              <li>Short putt = –3 points</li>
              <li>Long and missed return putt = –3 points</li>
              <li>Drill ends at 15 points</li>
              <li>Score = total putts taken</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
