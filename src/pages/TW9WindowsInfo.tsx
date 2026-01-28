import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function TW9WindowsInfo() {
  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="text-primary" />
            About 9 Windows Shot Shape
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Overview</h3>
            <p className="text-sm text-muted-foreground">
              Inspired by Tiger Woods' legendary shot-making, this drill challenges your ability to control trajectory and shape with precision. You must hit all nine combinations — the full "window" matrix.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">How It Works</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
              <li>Windows are randomized each session</li>
              <li>Each window combines a trajectory (Low / Mid / High) with a shape (Fade / Straight / Draw)</li>
              <li>Use a 7-iron only</li>
              <li>Your shot must land in a 15-meter target area and match the required trajectory + shape</li>
              <li>After each attempt, mark the shot as <strong>Next Shot</strong> (success) or <strong>Try Again</strong> (miss)</li>
              <li>Complete all 9 windows in as few shots as possible</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">The 9 Windows</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
              <li><strong>High:</strong> Fade, Straight, Draw</li>
              <li><strong>Mid:</strong> Fade, Straight, Draw</li>
              <li><strong>Low:</strong> Fade, Straight, Draw</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Scoring System</h3>
            <p className="text-sm text-muted-foreground">
              Your score is the total number of shots it takes to complete all 9 windows, including both successful shots and misses.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>A perfect score: 9 shots.</strong>
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Tips</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
              <li>Move ball position to adjust trajectory (back = low, forward = high)</li>
              <li>Commit fully to each window - indecision leads to misses</li>
              <li>Visualize the exact flight before swinging</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
