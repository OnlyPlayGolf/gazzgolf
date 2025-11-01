import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function ShortPuttingInfo() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <BookOpen size={20} className="text-primary" />
            Drill Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium text-foreground mb-2">About This Drill</h3>
            <p className="text-sm text-muted-foreground">
              Test your short putting accuracy with this pressure-packed drill. Build confidence in those crucial short putts that can make or break your score.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Setup</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Place 4 tees around the hole at 12, 3, 6, and 9 o'clock positions</li>
              <li>• Each tee starts 4 feet away from the hole</li>
              <li>• Every successful putt: move that tee back 1 foot</li>
              <li>• Rotate to the next position after each putt</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Rules</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• One miss ends the test</li>
              <li>• Your score is the number of consecutive putts made</li>
              <li>• Challenge yourself to beat your personal best!</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
