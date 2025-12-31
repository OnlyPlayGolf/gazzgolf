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
  
  // Copenhagen-specific: player's position (1, 2, or 3) and final score (e.g., "8-3-0")
  position?: number | null;
  copenhagenFinalScore?: string | null;
  
  // Match Play specific: W/L/T result and final score (e.g., "3 & 2")
  matchResult?: 'W' | 'L' | 'T' | null;
  matchFinalScore?: string | null;
  
  // Scramble-specific: team position and score to par (e.g., "-5")
  scramblePosition?: number | null;
  scrambleScoreToPar?: number | null;
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
  
  // Check if this is a match play format (including best ball match play)
  const isMatchPlay = round.gameType === 'match_play' || 
    (round.gameType === 'best_ball' && round.matchResult);
  
  // Check if this is a scramble with position data
  const isScramble = round.gameType === 'scramble' && round.scramblePosition;
  
  // Format position for Copenhagen games
  const formatPosition = (pos: number) => {
    if (pos === 1) return '1st';
    if (pos === 2) return '2nd';
    if (pos === 3) return '3rd';
    return `${pos}th`;
  };

  // Get color for match result
  const getMatchResultColor = (result: 'W' | 'L' | 'T') => {
    if (result === 'W') return 'text-emerald-600';
    if (result === 'L') return 'text-destructive';
    return 'text-muted-foreground';
  };
  
  // Format score to par
  const formatScoreToPar = (score: number) => {
    if (score === 0) return 'E';
    return score > 0 ? `+${score}` : `${score}`;
  };

  return (
    <Card 
      className={`cursor-pointer bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all ${className || ''}`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Left: Score, Position, or Match Result */}
          <div className="flex-shrink-0 w-14 text-center">
            {round.gameType === 'copenhagen' && round.position ? (
              <div className="flex flex-col items-center">
                <div className={`text-2xl font-bold ${round.position === 1 ? 'text-emerald-600' : 'text-foreground'}`}>
                  {formatPosition(round.position)}
                </div>
                {round.copenhagenFinalScore && (
                  <div className="text-xs text-muted-foreground">
                    {round.copenhagenFinalScore}
                  </div>
                )}
              </div>
            ) : isScramble ? (
              <div className="flex flex-col items-center">
                <div className={`text-2xl font-bold ${round.scramblePosition === 1 ? 'text-emerald-600' : 'text-foreground'}`}>
                  {formatPosition(round.scramblePosition!)}
                </div>
                {round.scrambleScoreToPar !== undefined && round.scrambleScoreToPar !== null && (
                  <div className="text-xs text-muted-foreground">
                    {formatScoreToPar(round.scrambleScoreToPar)}
                  </div>
                )}
              </div>
            ) : isMatchPlay && round.matchResult ? (
              <div className="flex flex-col items-center">
                <div className={`text-2xl font-bold ${getMatchResultColor(round.matchResult)}`}>
                  {round.matchResult}
                </div>
                {round.matchFinalScore && (
                  <div className="text-xs text-muted-foreground">
                    {round.matchFinalScore}
                  </div>
                )}
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
