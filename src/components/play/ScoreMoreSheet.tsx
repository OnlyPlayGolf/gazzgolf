import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, MessageSquare } from "lucide-react";

interface ScoreMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holeNumber: number;
  par: number;
  playerName: string;
  comment: string;
  onCommentChange: (comment: string) => void;
  mulligansAllowed: number;
  mulligansUsed: number;
  mulliganUsedOnThisHole: boolean;
  onUseMulligan: () => void;
  onRemoveMulligan: () => void;
  onSave: () => void;
}

export function ScoreMoreSheet({
  open,
  onOpenChange,
  holeNumber,
  par,
  playerName,
  comment,
  onCommentChange,
  mulligansAllowed,
  mulligansUsed,
  mulliganUsedOnThisHole,
  onUseMulligan,
  onRemoveMulligan,
  onSave,
}: ScoreMoreSheetProps) {
  const mulligansRemaining = mulligansAllowed - mulligansUsed;
  const canUseMulligan = mulligansAllowed > 0 && mulligansRemaining > 0 && !mulliganUsedOnThisHole;

  const handleSave = () => {
    onSave();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh]">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center text-lg font-bold">
            Hole {holeNumber} | {playerName}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 pb-4">
          {/* Comment Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MessageSquare size={16} />
              Hole Comment
            </Label>
            <Textarea
              placeholder="Add a comment about this hole..."
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Mulligan Section */}
          {mulligansAllowed > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Mulligan</Label>
                <Badge variant="secondary">
                  {mulligansRemaining} of {mulligansAllowed} remaining
                </Badge>
              </div>

              {mulliganUsedOnThisHole ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onRemoveMulligan}
                >
                  Remove Mulligan from this Hole
                </Button>
              ) : (
                <Button
                  variant={canUseMulligan ? "default" : "secondary"}
                  className="w-full"
                  disabled={!canUseMulligan}
                  onClick={onUseMulligan}
                >
                  {canUseMulligan 
                    ? "Use Mulligan on this Hole" 
                    : mulligansRemaining === 0 
                      ? "No Mulligans Remaining" 
                      : "Mulligan Already Used"}
                </Button>
              )}
            </div>
          )}

          {/* Save Button */}
          <Button className="w-full" onClick={handleSave}>
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
