import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TopNavBar } from "@/components/TopNavBar";
import { Target, TrendingUp } from "lucide-react";

export default function ApproachControlInfo() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="text-primary" size={20} />
              Approach Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium text-foreground mb-2">Overview</h3>
              <p className="text-sm text-muted-foreground">
                The Approach Control drill tests your precision and control with approach shots from 130-180 meters. 
                Based on PGA Tour data for average approach shot accuracy and proximity to the hole.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-foreground mb-2">Drill Structure</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Total: 14 randomized shots between 130-180 meters
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Side distribution: 7 shots left of target, 7 shots right of target
              </p>
              <p className="text-sm text-muted-foreground">
                Each shot will specify the distance and which side of the target to aim for. Record your proximity 
                to the target and whether you landed on the correct side.
              </p>
            </div>

            <div className="p-3 bg-muted/50 rounded-md">
              <h3 className="font-medium text-foreground mb-2">Scoring System</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>
                  <span className="font-medium text-green-600">3 Points:</span> Correct side AND inside 10 meters
                </li>
                <li>
                  <span className="font-medium text-blue-600">2 Points:</span> Wrong side BUT inside 5 meters
                </li>
                <li>
                  <span className="font-medium text-yellow-600">1 Point:</span> Correct side AND inside 15 meters
                </li>
                <li>
                  <span className="font-medium text-muted-foreground">0 Points:</span> Correct side BUT outside 15 meters
                </li>
                <li>
                  <span className="font-medium text-destructive">-1 Point:</span> Wrong side AND outside 5 meters
                </li>
              </ul>
            </div>

            <div className="p-3 bg-primary/10 rounded-md">
              <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                Bonus Streak System
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                After hitting 3 consecutive 3-pointers (correct side + inside 10m), you activate a bonus streak!
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                During an active streak, every 3-pointer earns an additional +1 bonus point until you miss a 3-pointer.
              </p>
              <div className="mt-3 p-2 bg-background/50 rounded">
                <p className="text-xs font-mono text-muted-foreground">
                  Example:<br />
                  Shot 1: 3 pts → Shot 2: 3 pts → Shot 3: 3 pts<br />
                  <span className="text-primary">→ Bonus activated!</span><br />
                  Shot 4: 3 pts + 1 bonus = 4 pts<br />
                  Shot 5: 3 pts + 1 bonus = 4 pts<br />
                  Shot 6: 2 pts → <span className="text-destructive">Streak ends</span>
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-foreground mb-2">Tips for Success</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Focus on ball striking quality and tempo</li>
                <li>• Pay attention to wind conditions</li>
                <li>• Commit to your club selection</li>
              </ul>
            </div>

            <div className="p-3 bg-muted/50 rounded-md">
              <h3 className="font-medium text-foreground mb-2">Target Scores</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <span className="font-medium text-foreground">36+ points:</span> Tour-level precision</li>
                <li>• <span className="font-medium text-foreground">28-35 points:</span> Excellent approach play</li>
                <li>• <span className="font-medium text-foreground">21-27 points:</span> Solid control</li>
                <li>• <span className="font-medium text-foreground">&lt;21 points:</span> Keep working on consistency</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
