import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

const distances = [
  { hole: 1, distance: "1.5m (5ft)" },
  { hole: 2, distance: "12m" },
  { hole: 3, distance: "0.6m (2ft)" },
  { hole: 4, distance: "4m" },
  { hole: 5, distance: "1.2m (4ft)" },
  { hole: 6, distance: "16m" },
  { hole: 7, distance: "8m" },
  { hole: 8, distance: "3m" },
  { hole: 9, distance: "6m" },
  { hole: 10, distance: "9m" },
  { hole: 11, distance: "0.9m (3ft)" },
  { hole: 12, distance: "7m" },
  { hole: 13, distance: "2.1m (7ft)" },
  { hole: 14, distance: "3.5m" },
  { hole: 15, distance: "10m" },
  { hole: 16, distance: "1.8m (6ft)" },
  { hole: 17, distance: "5m" },
  { hole: 18, distance: "2.4m (8ft)" },
];

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
          <div>
            <h3 className="font-medium text-foreground mb-2">About This Drill</h3>
            <p className="text-sm text-muted-foreground">
              Practice putting from tournament-style distances across 18 holes. This drill simulates
              the putting challenges you'll face on a PGA Tour course, helping you develop consistency
              under pressure and build confidence in your putting stroke.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Hole Distances</h3>
            <div className="grid grid-cols-2 gap-2">
              {distances.map((hole) => (
                <div key={hole.hole} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">Hole {hole.hole}:</span>
                  <span className="font-medium">{hole.distance}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Scoring</h3>
            <p className="text-sm text-muted-foreground">
              Record your total number of putts for all 18 holes. Lower scores are better.
              Challenge yourself to beat your personal best!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
