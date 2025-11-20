import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function Wedges2LapsInfo() {
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
              A wedge distance-control challenge featuring two laps of nine distances between 40–80 meters. Designed to sharpen your precision from the fairway and improve your scoring game.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">How It Works</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
              <li>Hit one shot from each of the 9 distances (40–80 meters)</li>
              <li>Complete 2 laps for a total of 18 shots</li>
              <li>All shots are played from a fairway lie</li>
              <li>After each shot, record your proximity to the hole</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Scoring System</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
              <li><strong>Inside 2m:</strong> 3 points</li>
              <li><strong>Inside 3m:</strong> 2 points</li>
              <li><strong>Inside 4m:</strong> 1 point</li>
              <li><strong>Outside 4m:</strong> 0 points</li>
              <li><strong>Missed green:</strong> –1 point</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
