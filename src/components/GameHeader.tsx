import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameHeaderProps {
  gameTitle: string;
  courseName: string;
  pageTitle: string;
  /** Optional override for back button behavior */
  onBack?: () => void;
  /** Optional admin actions (currently not shown in UI) */
  isAdmin?: boolean;
  onFinish?: () => void;
  onSaveAndExit?: () => void;
  onDelete?: () => void | Promise<void>;
  gameName?: string;
  /** If true, back button is hidden (e.g., for pages that manage their own navigation) */
  hideBackButton?: boolean;
}

export function GameHeader({
  gameTitle,
  courseName,
  pageTitle,
  onBack,
  hideBackButton = false,
}: GameHeaderProps) {
  const navigate = useNavigate();

  const handleBackClick = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate(-1);
  };

  return (
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
          <h1 className="text-base font-semibold text-foreground">{pageTitle}</h1>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{gameTitle}</span>
            {" • "}
            {courseName}
          </p>
        </div>
      </div>
    </div>
  );
}
