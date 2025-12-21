import { Trophy, Plus, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RoundCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holesPlayed: number;
  plannedHoles: number;
  onFinishRound: () => void;
  onContinuePlaying: () => void;
  onGoBack: () => void;
}

export function RoundCompletionDialog({
  open,
  onOpenChange,
  holesPlayed,
  plannedHoles,
  onFinishRound,
  onContinuePlaying,
  onGoBack,
}: RoundCompletionDialogProps) {
  const isExtraHoles = holesPlayed > plannedHoles;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[hsl(120,20%,90%)] flex items-center justify-center">
            <Trophy className="w-8 h-8 text-[hsl(120,20%,35%)]" />
          </div>
          <DialogTitle className="text-xl">
            {isExtraHoles ? "Extra Holes Complete!" : "Round Complete!"}
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {isExtraHoles 
              ? `You've played ${holesPlayed} holes (${holesPlayed - plannedHoles} extra). What would you like to do?`
              : `You've completed all ${holesPlayed} holes. What would you like to do?`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 mt-4">
          <Button
            onClick={onFinishRound}
            className="w-full bg-[hsl(120,20%,35%)] hover:bg-[hsl(120,20%,30%)] text-white h-14 text-base"
          >
            <Trophy className="w-5 h-5 mr-2" />
            Finish Round
          </Button>
          
          <Button
            onClick={onContinuePlaying}
            variant="outline"
            className="w-full h-14 text-base border-[hsl(120,20%,70%)] text-[hsl(120,20%,35%)] hover:bg-[hsl(120,20%,95%)]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Continue Playing
          </Button>
          
          <Button
            onClick={onGoBack}
            variant="ghost"
            className="w-full h-12 text-base text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Go Back
          </Button>
        </div>
        
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            <strong>Finish Round:</strong> Saves and finalizes scores, updates stats
            <br />
            <strong>Continue Playing:</strong> Add extra or playoff holes
            <br />
            <strong>Go Back:</strong> Return to edit scores
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
