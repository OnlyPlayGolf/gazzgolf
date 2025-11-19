import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function EightBallInfo() {
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
              This short game circuit builds consistency and precision across all key areas - chipping, pitching, lob shots, and bunker play. It's designed to replicate the variety of short game shots you face during a round and to feel game-like, you never hit the same shot twice in a row, keeping every shot purposeful and challenging.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">How It Works</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• 8 stations featuring different short game scenarios</li>
              <li>• Perform the circuit 5 times, for a total of 40 shots</li>
              <li>• Measure and record proximity to the hole after every shot</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Stations (8)</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Chip – 10 m</li>
              <li>• Chip – 30 m</li>
              <li>• Pitch – 20 m</li>
              <li>• Pitch – 40 m</li>
              <li>• Lob – 15 m</li>
              <li>• Lob – 25 m</li>
              <li>• Bunker – 10 m</li>
              <li>• Bunker – 20 m</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Scoring System</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Holed → +3 points</li>
              <li>• Within 0.6 m (2 ft) → +2 points</li>
              <li>• 0.6–1 m (2–3 ft) → +1 point</li>
              <li>• 1–2 m → 0 points</li>
              <li>• 2–3 m → −1 point</li>
              <li>• Outside 3 m → −2 points</li>
              <li>• Goal: achieve your highest total score over all 5 rounds</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
