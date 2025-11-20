import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function PGATour18Info() {
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
              Putt one ball at a time from the distances listed in the test. The distances reflect an average PGA Tour round, allowing you to compare your performance to Tour standards. This drill can be done on the putting green or in a practice round before a competition.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">How It Works</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Hit one putt from each designated distance</li>
              <li>• Vary the break and whether the putt is uphill or downhill</li>
              <li>• Treat it like a tournament: read the line, commit to your routine, and execute each putt</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Scoring System</h3>
            <p className="text-sm text-muted-foreground mb-2">
              You can compare your total putts to PGA Tour benchmarks:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Best PGA Tour: 28.5</li>
              <li>• Average PGA Tour: 29.2</li>
              <li>• Worst PGA Tour: 30.2</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Tips</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Always read the putt as if you're competing</li>
              <li>• Keep a consistent pre-shot routine</li>
              <li>• Focus on speed control, especially on downhill or big-breaking putts</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
