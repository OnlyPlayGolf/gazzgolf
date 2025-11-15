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
          <div>
            <h3 className="font-medium text-foreground mb-2">About This Drill</h3>
            <p className="text-sm text-muted-foreground">
              A wedge distance control drill featuring 2 laps of 9 different distances from 40-80 meters. Focus on hitting precise distances from the fairway to improve your scoring game.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Structure</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• 9 different distances from 40-80 meters</li>
              <li>• One shot per distance</li>
              <li>• Complete 2 laps (18 total shots)</li>
              <li>• All shots from fairway lie</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Scoring</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Within 2m: 3 points</li>
              <li>• Within 3m: 2 points</li>
              <li>• Within 4m: 1 point</li>
              <li>• More than 4m off: 0 points</li>
              <li>• Missed green: -1 point</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
