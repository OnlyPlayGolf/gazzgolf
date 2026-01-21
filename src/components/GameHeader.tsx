import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

export function GameHeader({
  gameTitle,
  courseName,
  pageTitle,
  onBack,
  isAdmin = false,
  hideBackButton = false,
}: GameHeaderProps) {
  const navigate = useNavigate();

  const handleBackClick = () => {
    if (onBack) {
      onBack();
      return;
    }
    // Default: go back to previous page
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
          <h1 className="text-xl font-bold text-foreground">{gameTitle}</h1>
          <p className="text-sm text-muted-foreground">{courseName}</p>
        </div>
      </div>
    </div>
  );
}
