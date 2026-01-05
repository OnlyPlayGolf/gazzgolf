import { Camera, Edit3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AddCourseMethodDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScanScorecard: () => void;
  onManualEntry: () => void;
}

export function AddCourseMethodDialog({ 
  isOpen, 
  onClose, 
  onScanScorecard, 
  onManualEntry 
}: AddCourseMethodDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add New Course</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <Button
            variant="outline"
            className="w-full h-20 flex-col gap-2 hover:border-primary hover:bg-primary/5"
            onClick={onScanScorecard}
          >
            <Camera className="w-8 h-8 text-primary" />
            <div className="text-center">
              <p className="font-medium">Scan Scorecard</p>
              <p className="text-xs text-muted-foreground">Take or upload a photo</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full h-20 flex-col gap-2 hover:border-primary hover:bg-primary/5"
            onClick={onManualEntry}
          >
            <Edit3 className="w-8 h-8 text-primary" />
            <div className="text-center">
              <p className="font-medium">Manual Entry</p>
              <p className="text-xs text-muted-foreground">Enter details manually</p>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
