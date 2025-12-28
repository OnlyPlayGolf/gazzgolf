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
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Overview</h3>
            <p className="text-sm text-muted-foreground">
              The Aggressive Putting drill helps you become a more aggressive putter within 6 meters while still maintaining good speed control. The scoring system heavily rewards holed putts and penalizes cautious or overly aggressive putts.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Tour Average:</strong> 12.28 putts
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">How It Works</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Distances cycle: 4m → 5m → 6m → repeat</li>
              <li>• Choose a different spot for every putt. You may not putt twice from the same position</li>
              <li>• Reach 15 points in as few putts as possible</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Scoring System</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Holed putt = +3 points</li>
              <li>• Good pace (within 3 ft past the hole) = +1 point</li>
              <li>• Long but made return putt (3+ ft past) = 0 points</li>
              <li>• Short putt = –3 points</li>
              <li>• Long and missed return putt = –3 points</li>
              <li>• 4-putt or worse = –5 points</li>
              <li>• Drill ends at 15 points</li>
              <li>• Score = total putts taken</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
