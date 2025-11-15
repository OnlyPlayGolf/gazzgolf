import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function AggressivePuttingInfo() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <BookOpen size={20} className="text-primary" />
            Drill Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Putt distances cycle: 4m → 5m → 6m → repeat</li>
            <li>• Holed putt = +3 points</li>
            <li>• Good pace (within 3ft past hole) = +1 point</li>
            <li>• Short putt = -3 points</li>
            <li>• Long and missed return putt = -3 points</li>
            <li>• Drill ends at 15 points</li>
            <li>• Score = total putts taken</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground">About This Drill</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The Aggressive Putting drill helps you become a more aggressive putter within 6 meters while still maintaining good speed control. 
            The scoring system heavily rewards holed putts and penalizes cautious or overly aggressive putts.
          </p>
          <p className="font-medium text-foreground">
            Tour Average: 12.28 putts
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
