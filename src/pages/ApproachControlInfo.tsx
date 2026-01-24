import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function ApproachControlInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="text-primary" size={20} />
          Approach Control 130-180m
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Overview</h3>
          <p className="text-sm text-muted-foreground">
            The Approach Control drill tests your precision and control on approach shots from 130–180 meters. Shot assignments are based on PGA Tour approach-shot accuracy and proximity data.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">How It Works</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Complete 14 randomized shots between 130–180 meters</li>
            <li>• You'll receive a distance and a required side of the target for each shot</li>
            <li>• Side distribution: 7 shots left, 7 shots right</li>
            <li>• After each shot, record proximity and whether you finished on the correct side</li>
          </ul>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Scoring System</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <span className="font-medium">3 Points:</span> Correct side and inside 10 meters</li>
            <li>• <span className="font-medium">2 Points:</span> Wrong side but inside 5 meters</li>
            <li>• <span className="font-medium">1 Point:</span> Correct side and inside 15 meters</li>
            <li>• <span className="font-medium">0 Points:</span> Correct side but outside 15 meters</li>
            <li>• <span className="font-medium">–1 Point:</span> Wrong side and outside 5 meters</li>
          </ul>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Bonus Streak System</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Hitting 3 consecutive 3-pointers activates a bonus streak</li>
            <li>• While active, each additional 3-pointer earns +1 bonus point until a miss ends the streak</li>
          </ul>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Tips</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Factor in wind, lie, and trajectory</li>
            <li>• Commit fully to your club and start line</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
