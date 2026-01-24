import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hammer } from "lucide-react";

export default function WedgesProgressionInfo() {
  return (
    <div className="p-4 pb-24">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hammer className="text-primary" />
            Wedge Ladder 60-120m
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Overview</h3>
            <p className="text-sm text-muted-foreground">
              This drill tests your distance control across 13 different distances from 60 to 120 meters. 
              You must hit each distance within 3 meters to advance to the next one.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">How it works</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Start at 60 meters</li>
              <li>• Hit a shot and record your actual distance</li>
              <li>• If within 3 meters of target, advance to next distance (65m)</li>
              <li>• If outside 3 meters, retry the same distance</li>
              <li>• Continue through all 13 distances: 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Scoring</h3>
            <p className="text-sm text-muted-foreground">
              Your score is the total number of shots needed to complete all distances. 
              A perfect score would be 13 shots (one per distance).
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Lower score is better.</strong>
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Tips</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Focus on consistent tempo and technique</li>
              <li>• Know your yardages for different clubs and swings</li>
              <li>• Account for wind and elevation</li>
              <li>• Don't rush - take time between shots to refocus</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
