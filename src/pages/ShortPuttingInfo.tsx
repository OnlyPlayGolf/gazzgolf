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
            <h3 className="font-medium text-foreground mb-2">Overview</h3>
            <p className="text-sm text-muted-foreground">
              This drill builds confidence and consistency on short putts by testing your ability to make consecutive putts from four different angles around the hole. Starting at 3 feet, the challenge increases as you move each tee marker progressively farther away. It simulates the pressure of must-make putts during a round while developing a solid putting routine.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">How It Works</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Set 4 tees around the hole at 12, 3, 6, and 9 o'clock</li>
              <li>• Start each tee at 3 feet</li>
              <li>• Every made putt: move that tee back 1 foot</li>
              <li>• After each putt, rotate to the next tee</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Scoring System</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• One miss ends the drill</li>
              <li>• Your score = total consecutive putts made</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Tips</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Commit fully to each read and your routine</li>
              <li>• Focus on starting the ball on your intended line</li>
              <li>• Focus on having consistent speed</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
