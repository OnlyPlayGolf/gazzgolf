import { Card, CardContent } from "@/components/ui/card";

export default function EasyChipInfo() {
  return (
    <div className="space-y-4 pb-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Overview</h3>
            <p className="text-sm text-muted-foreground">
              The Easy Chip Drill helps you build consistency on one of the most important short-game shots, the simple chip shots. The goal is simple: see how many chips in a row you can land inside one wedge length from the hole.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">How It Works</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Hit chips from 10 meters from a fairway lie</li>
              <li>• After each shot, check if the ball finishes within one wedge length of the hole</li>
              <li>• Count your consecutive makes</li>
              <li>• One miss resets the streak</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Scoring System</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Inside one wedge length: +1 streak</li>
              <li>• Miss: streak ends</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
