import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, X, Trash2 } from "lucide-react";

interface RoundActionsSectionProps {
  onFinish?: () => void;
  onSaveAndExit?: () => void;
  onDelete: () => void;
  finishLabel?: string;
  showFinish?: boolean;
  showSaveAndExit?: boolean;
}

export function RoundActionsSection({
  onFinish,
  onSaveAndExit,
  onDelete,
  finishLabel = "Finish Game",
  showFinish = true,
  showSaveAndExit = true,
}: RoundActionsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Round Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showFinish && onFinish && (
          <Button onClick={onFinish} className="w-full" variant="default">
            <Save size={16} className="mr-2" />
            {finishLabel}
          </Button>
        )}

        {showSaveAndExit && onSaveAndExit && (
          <Button onClick={onSaveAndExit} className="w-full" variant="outline">
            <X size={16} className="mr-2" />
            Save & Exit
          </Button>
        )}

        <Button onClick={onDelete} className="w-full" variant="destructive">
          <Trash2 size={16} className="mr-2" />
          Delete Game
        </Button>
      </CardContent>
    </Card>
  );
}
