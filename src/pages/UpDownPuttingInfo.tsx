import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function UpDownPuttingInfo() {
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
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Overview</h3>
            <p className="text-sm text-muted-foreground">
              This uphill-downhill putting drill sharpens your speed control and consistency across varying slopes. It trains you to manage pace and break from both directions.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">How It Works</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Two lines: one uphill and one downhill</li>
              <li>• Mark distances at 6 m, 8 m, and 10 m from the hole on both lines</li>
              <li>• Create a 3-foot "zone" short and long of the hole</li>
              <li>• Putt in sequence: 6 m up → 6 m down → 8 m up → 8 m down → 10 m up → 10 m down</li>
              <li>• Complete 3 rounds (18 putts total)</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Scoring System</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Holed → −1 (Birdie)</li>
              <li>• Missed inside 3 ft → 0 (Par)</li>
              <li>• Missed short/long outside zone → +1 (Bogey)</li>
              <li>• Goal: finish with the lowest total score possible</li>
              <li>• Tour benchmark: +0.64</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Tips</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Notice how much more the downhill putt breaks</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
