import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TopNavBar } from "@/components/TopNavBar";
import { Target, TrendingUp } from "lucide-react";

export default function ShotShapeMasterInfo() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="text-primary" size={20} />
              Shot Shape Master
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium text-foreground mb-2">Overview</h3>
              <p className="text-sm text-muted-foreground">
                The Shot Shape Master drill tests your ability to execute required shot shapes under pressure. 
                Based on 14 tee shots from an 18-hole round with average fairway and dispersion numbers from PGA Tour data.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Fairway width: 30 meters
              </p>
            </div>

            <div>
              <h3 className="font-medium text-foreground mb-2">Drill Structure</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Total: 14 shots (7 draws, 7 fades)
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Club distribution: 9 Drivers, 2 Fairway Woods, 3 Hybrid/Utility Irons
              </p>
              <p className="text-sm text-muted-foreground">
                Each shot will specify the required shot shape (draw or fade) and club. Record whether you achieved 
                the required shape and whether you found the fairway.
              </p>
            </div>

            <div className="p-3 bg-muted/50 rounded-md">
              <h3 className="font-medium text-foreground mb-2">Scoring System</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>
                  <span className="font-medium text-green-600">3 Points:</span> Correct shot shape AND hit fairway
                </li>
                <li>
                  <span className="font-medium text-blue-600">2 Points:</span> Wrong shot shape BUT hit fairway
                </li>
                <li>
                  <span className="font-medium text-yellow-600">1 Point:</span> Correct shot shape BUT missed fairway by 10m or less
                </li>
                <li>
                  <span className="font-medium text-muted-foreground">0 Points:</span> Missed fairway by more than 10m (regardless of shot shape)
                </li>
              </ul>
            </div>

            <div className="p-3 bg-primary/10 rounded-md">
              <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                Bonus Streak System
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                After hitting 3 consecutive 3-pointers (correct shape + fairway), you activate a bonus streak!
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
                <li>• Was the miss less than 10 meters off the fairway?</li>
                <li>• Commit fully to each shot shape decision</li>
                <li>• Focus on tempo and balance for consistency</li>
                <li>• Use alignment aids to help with target lines</li>
                <li>• Track which shapes work best for you</li>
              </ul>
            </div>

            <div className="p-3 bg-muted/50 rounded-md">
              <h3 className="font-medium text-foreground mb-2">Target Scores</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <span className="font-medium text-foreground">36+ points:</span> Tour-level performance</li>
                <li>• <span className="font-medium text-foreground">28-35 points:</span> Excellent shot making</li>
                <li>• <span className="font-medium text-foreground">21-27 points:</span> Solid control</li>
                <li>• <span className="font-medium text-foreground">&lt;21 points:</span> Keep practicing fundamentals</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
