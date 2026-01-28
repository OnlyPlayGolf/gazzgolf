import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function TwentyOnePointsInfo() {
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
              21 Points is a competitive short-game drill for 2 or more players. Compete to be the first to reach 21 points or more. Points are awarded by order of closeness to the hole—closest gets the most, or -1 if you miss the green.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">How It Works</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Add 2 or more players and start the drill.</li>
              <li>• Play hole by hole: each player hits a short-game shot. The holed shot gets all 6 points; others earn points by order of closeness (closest 3, 2nd 2, 3rd 1, rest 0), or -1 if they miss the green.</li>
              <li>• Enter points for each player in order. After everyone has entered for that hole, the drill advances to the next hole.</li>
              <li>• The player who scored the most points on the previous hole picks the next hole/shot.</li>
              <li>• The first player to reach 21 points or more wins. The drill ends automatically and the result is saved.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Scoring</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Assign points based on order of closeness to the hole. Each group can agree on their own scoring; the scale below is a general scoring.
            </p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Holed → all 6 points (nothing to the rest)</li>
              <li>• Closest → 3 points</li>
              <li>• 2nd Closest → 2 points</li>
              <li>• 3rd Closest → 1 point</li>
              <li>• Rest → 0 points</li>
              <li>• Missed Green → -1 point</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
