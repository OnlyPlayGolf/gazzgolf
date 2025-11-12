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
          <div>
            <h3 className="font-medium text-foreground mb-2">About This Drill</h3>
            <p className="text-sm text-muted-foreground">
              Master distance control and speed consistency on both uphill and downhill putts. This comprehensive drill helps you develop feel for slopes and varying green speeds.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Drill Structure</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Hit 3 putts from each marker in this order:
            </p>
            <p className="text-sm text-muted-foreground font-mono mb-2">
              6m up → 6m down → 8m up → 8m down → 10m up → 10m down
            </p>
            <p className="text-sm text-muted-foreground">
              Complete 3 rounds. Total: 18 putts
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Scoring</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Holed putt = Birdie (-1)</li>
              <li>• Inside 3 feet = Par (0)</li>
              <li>• Outside 3 feet = Bogey (+1)</li>
              <li>• Tour average: +0.64</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
