import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameHeaderProps {
  gameTitle: string;
  courseName: string;
  pageTitle: string;
  /** If true, back button is hidden (e.g., for pages that manage their own navigation) */
  hideBackButton?: boolean;
}

export function GameHeader({
  gameTitle,
  courseName,
  pageTitle,
  hideBackButton = false,
}: GameHeaderProps) {
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate('/');
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
