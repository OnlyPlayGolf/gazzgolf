import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Flag, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DeleteGameDialog } from "@/components/settings/DeleteGameDialog";

interface GameHeaderProps {
  gameTitle: string;
  courseName: string;
  pageTitle: string;
  /** Optional override for back button behavior */
  onBack?: () => void;
  /** If true, user is admin/creator and gets action sheet on back */
  isAdmin?: boolean;
  /** If true, back button is hidden (e.g., for pages that manage their own navigation) */
  hideBackButton?: boolean;
  /** Called when admin taps "Finish Game" */
  onFinish?: () => void;
  /** Called when admin taps "Save & Exit" */
  onSaveAndExit?: () => void;
  /** Called when admin confirms "Delete Game" */
  onDelete?: () => void;
  /** Game name for delete dialog (e.g., "Best Ball Game", "Round") */
  gameName?: string;
}

export function GameHeader({
  gameTitle,
  courseName,
  pageTitle,
  onBack,
  isAdmin = false,
  hideBackButton = false,
  onFinish,
  onSaveAndExit,
  onDelete,
  gameName = "game",
}: GameHeaderProps) {
  const navigate = useNavigate();
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleBackClick = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (isAdmin && onFinish && onSaveAndExit && onDelete) {
      // Admin: show action sheet
      setShowActionSheet(true);
    } else {
      // Spectator/Participant: go back to previous page
      navigate(-1);
    }
  };

  const handleFinish = () => {
    setShowActionSheet(false);
    onFinish?.();
  };

  const handleSaveAndExit = () => {
    setShowActionSheet(false);
    onSaveAndExit?.();
  };

  const handleDeleteClick = () => {
    setShowActionSheet(false);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete?.();
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        {/* Grey header bar */}
        <div className="bg-muted/50 px-4 py-3 relative flex items-center justify-center min-h-[60px]">
          {/* Back button - left side */}
          {!hideBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackClick}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-foreground hover:bg-muted"
            >
              <ChevronLeft size={24} />
            </Button>
          )}
          
          {/* Centered title and course */}
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">{gameTitle}</h1>
            <p className="text-sm text-muted-foreground">{courseName}</p>
          </div>
        </div>
      </div>

      {/* Admin Action Sheet */}
      <Sheet open={showActionSheet} onOpenChange={setShowActionSheet}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader className="pb-4">
            <SheetTitle>What would you like to do?</SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            <Button onClick={handleFinish} className="w-full" variant="default">
              <Flag size={16} className="mr-2" />
              Finish Game
            </Button>
            <Button onClick={handleSaveAndExit} className="w-full" variant="outline">
              <Save size={16} className="mr-2" />
              Save & Exit
            </Button>
            <Button onClick={handleDeleteClick} className="w-full" variant="destructive">
              <Trash2 size={16} className="mr-2" />
              Delete Game
            </Button>
            <Button 
              onClick={() => setShowActionSheet(false)} 
              className="w-full" 
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <DeleteGameDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleConfirmDelete}
        gameName={gameName}
        deleting={deleting}
      />
    </>
  );
}
