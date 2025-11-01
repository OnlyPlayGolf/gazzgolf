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
            <h3 className="font-medium text-foreground mb-2">About This Drill</h3>
            <p className="text-sm text-muted-foreground">
              A comprehensive short game drill that tests your skills across 8 different stations covering chipping, pitching, lob shots, and bunker play.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Structure</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• 8 stations with different short game challenges</li>
              <li>• Complete all 8 stations in each round</li>
              <li>• Perform 5 rounds total (40 shots)</li>
              <li>• Score points based on proximity to the hole</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Scoring</h3>
            <p className="text-sm text-muted-foreground">
              Points are awarded based on how close you finish to the hole, with holed shots receiving maximum points. Track your progress and aim to improve your total score with each session.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
