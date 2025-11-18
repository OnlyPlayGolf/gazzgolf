import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function TW9WindowsInfo() {
  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="text-primary" />
            About TW's 9 Windows Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Overview</h3>
            <p className="text-muted-foreground">
              Inspired by Tiger Woods' legendary shot-making ability, this drill tests your 
              capacity to control both trajectory and shape with precision. Hit shots through 
              all 9 "windows" - every combination of trajectory and shape.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">The 9 Windows</h3>
            <p className="text-muted-foreground mb-2">Every combination of:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-4">
              <li><strong>Trajectory:</strong> Low, Middle, High</li>
              <li><strong>Shape:</strong> Fade, Straight, Draw</li>
            </ul>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div className="p-2 border rounded bg-muted">Low Fade</div>
              <div className="p-2 border rounded bg-muted">Low Straight</div>
              <div className="p-2 border rounded bg-muted">Low Draw</div>
              <div className="p-2 border rounded bg-muted">Mid Fade</div>
              <div className="p-2 border rounded bg-muted">Mid Straight</div>
              <div className="p-2 border rounded bg-muted">Mid Draw</div>
              <div className="p-2 border rounded bg-muted">High Fade</div>
              <div className="p-2 border rounded bg-muted">High Straight</div>
              <div className="p-2 border rounded bg-muted">High Draw</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Equipment</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-4">
              <li>7 iron only</li>
              <li>15-meter wide target area</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Rules</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-4">
              <li>Window order is randomized each session</li>
              <li>Each shot must land in the target AND match the required trajectory/shape</li>
              <li>After each shot, mark it as "Next Shot" (success) or "Try Again" (miss)</li>
              <li>Complete all 9 windows in as few shots as possible</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Scoring</h3>
            <p className="text-muted-foreground">
              Lower score is better. Your total shot count includes both successful shots 
              and misses. A perfect score is 9 shots (hitting each window on the first try).
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Tips</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-4">
              <li>Adjust ball position for trajectory control (back for low, forward for high)</li>
              <li>Use grip pressure and clubface angle for shape</li>
              <li>Focus on commitment to each shot type - half-hearted attempts won't work</li>
              <li>Practice the windows you struggle with most</li>
              <li>Visualize the shot before hitting it</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
