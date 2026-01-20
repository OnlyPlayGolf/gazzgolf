import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function DriverControlInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-6 w-6" />
          About Driver Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Overview</h3>
          <p className="text-sm text-muted-foreground">
            The Driver Control drill tests your driving accuracy over 14 shots. The fairway is set to 30 meters wide, simulating realistic on-course conditions. Ideal for both range sessions and one-shot-per-hole on-course practice.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">How It Works</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
            <li>Hit 14 total drives</li>
            <li>Each shot has a predefined point outcome for: Fairway Hit, Miss Left, or Miss Right</li>
            <li>Left and right misses have randomized penalties (0, –1, or –2 points) to keep the drill challenging and unpredictable</li>
            <li>After each shot, record whether you hit the fairway or missed</li>
          </ul>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Scoring System</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
            <li><strong>Fairway Hit (FIR):</strong> +1 point</li>
            <li><strong>Miss Left:</strong> 0 / –1 / –2 points (randomized each shot)</li>
            <li><strong>Miss Right:</strong> 0 / –1 / –2 points (randomized each shot)</li>
          </ul>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Bonus Streak</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
            <li>After 3 consecutive fairways, you enter bonus mode</li>
            <li>Every additional FIR earns +1 bonus point until you miss</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
