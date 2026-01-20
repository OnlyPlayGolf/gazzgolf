import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, TrendingUp } from "lucide-react";

export default function ShotShapeMasterInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="text-primary" size={20} />
          Shot Shape Master
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Overview</h3>
          <p className="text-sm text-muted-foreground">
            The Shot Shape Master drill tests your ability to execute required shot shapes under pressure. Designed around 14 tee shots that mirror a typical 18-hole round, using PGA Tour fairway widths and dispersion data.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Fairway width: 30 meters.</strong>
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">How It Works</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
            <li>Hit 14 total shots</li>
            <li>Shot distribution: 7 draws and 7 fades</li>
            <li>Club mix: 9 Drivers, 2 Fairway Woods, 3 Hybrids/Utility Irons</li>
            <li>Each shot tells you which shape and which club to use</li>
            <li>After each shot, record whether you:
              <ul className="list-disc list-inside pl-4 mt-1">
                <li>Hit the required shape, and</li>
                <li>Found the fairway</li>
              </ul>
            </li>
          </ul>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Scoring System</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
            <li><strong>3 Points:</strong> Correct shape and fairway hit</li>
            <li><strong>2 Points:</strong> Wrong shape but fairway hit</li>
            <li><strong>1 Point:</strong> Correct shape but missed fairway by ≤10m</li>
            <li><strong>0 Points:</strong> Missed fairway by &gt;10m (regardless of shape)</li>
          </ul>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Bonus Streak System</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
            <li>Hit 3 consecutive 3-pointers to activate a bonus streak</li>
            <li>During the streak, each additional 3-pointer earns +1 bonus point until you miss</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
