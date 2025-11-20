import { Card, CardContent } from "@/components/ui/card";

export default function EasyChipInfo() {
  return (
    <div className="space-y-4 pb-4">
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div>
            <h3 className="font-medium text-foreground mb-2">Overview</h3>
            <p className="text-sm text-muted-foreground">
              The Easy Chip Drill helps you build consistency on one of the most important short-game shots, the simple chip shots. The goal is simple: see how many chips in a row you can land inside one wedge length from the hole.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">How It Works</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Hit chips from 10 meters from a fairway lie</li>
              <li>• After each shot, check if the ball finishes within one wedge length of the hole</li>
              <li>• Count your consecutive makes</li>
              <li>• One miss resets the streak</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Scoring System</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Inside one wedge length: +1 streak</li>
              <li>• Miss: streak ends</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
