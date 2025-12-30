import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Users } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getGameRoute } from "@/utils/unifiedRoundsLoader";

type GameType = 'round' | 'copenhagen' | 'skins' | 'best_ball' | 'scramble' | 'wolf' | 'umbriago' | 'match_play';

export interface RoundCardData {
  id: string;
  round_name?: string | null;
  course_name: string;
  date: string;
  score: number;
  playerCount: number;
  gameMode: string;
  gameType?: GameType;

  // Optional metadata (used by some pages)
  holesPlayed?: number;
  teeSet?: string | null;
  totalScore?: number | null;
  totalPar?: number | null;
  ownerUserId?: string;
  
  // Copenhagen-specific: player's position (1, 2, or 3)
  position?: number | null;
}

interface RoundCardProps {
  round: RoundCardData;
  className?: string;
  onClick?: () => void;
}

export function RoundCard({ round, className, onClick }: RoundCardProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatScore = (score: number) => {
    if (score === 0) return 'E';
    return score > 0 ? `+${score}` : `${score}`;
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      const gameType = round.gameType || 'round';
      navigate(getGameRoute(gameType, round.id, location.pathname));
    }
  };

  // Only show score for regular stroke play rounds
  const showScore = round.gameType === 'round' || !round.gameType;
  
  // Format position for Copenhagen games
  const formatPosition = (pos: number) => {
    if (pos === 1) return '1st';
    if (pos === 2) return '2nd';
    if (pos === 3) return '3rd';
    return `${pos}th`;
  };

  return (
    <Card 
      className={`cursor-pointer bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all ${className || ''}`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Left: Score or Position */}
          <div className="flex-shrink-0 w-14 text-center">
            {round.gameType === 'copenhagen' && round.position ? (
              <div className={`text-2xl font-bold ${round.position === 1 ? 'text-emerald-600' : 'text-foreground'}`}>
                {formatPosition(round.position)}
              </div>
            ) : showScore ? (
              <div className={`text-2xl font-bold ${round.score <= 0 ? 'text-emerald-600' : 'text-foreground'}`}>
                {formatScore(round.score)}
              </div>
            ) : (
              <div className="text-sm font-medium text-muted-foreground">
                —
              </div>
            )}
          </div>
          
          {/* Middle: Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {round.round_name || 'Round'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <span className="truncate">{round.course_name}</span>
              <span>·</span>
              <span className="flex-shrink-0">{formatDate(round.date)}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <span>{round.gameMode}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Users size={12} />
                {round.playerCount}
              </span>
            </div>
          </div>
          
          {/* Right: Chevron */}
          <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
