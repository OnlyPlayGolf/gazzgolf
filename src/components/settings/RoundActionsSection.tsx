import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, LogOut, Trash2, Flag } from "lucide-react";

interface RoundActionsSectionProps {
  isAdmin: boolean;
  onFinish: () => void;
  onSaveAndExit: () => void;
  onDelete?: () => void;
  onLeave?: () => void;
  finishLabel?: string;
}

export function RoundActionsSection({
  isAdmin,
  onFinish,
  onSaveAndExit,
  onDelete,
  onLeave,
  finishLabel = "Finish Game",
}: RoundActionsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          {isAdmin ? "Game Admin" : "Participant"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={onFinish} className="w-full" variant="default">
          <Flag size={16} className="mr-2" />
          {finishLabel}
        </Button>

        <Button onClick={onSaveAndExit} className="w-full" variant="outline">
          <Save size={16} className="mr-2" />
          Save & Exit
        </Button>

        {isAdmin && onDelete && (
          <Button onClick={onDelete} className="w-full" variant="destructive">
            <Trash2 size={16} className="mr-2" />
            Delete Game
          </Button>
        )}

        {!isAdmin && onLeave && (
          <Button onClick={onLeave} className="w-full" variant="destructive">
            <LogOut size={16} className="mr-2" />
            Leave Game
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
