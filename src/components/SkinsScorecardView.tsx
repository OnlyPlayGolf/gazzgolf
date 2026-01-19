import { useState } from "react";
import { format } from "date-fns";
import { ScorecardTypeSelector, ScorecardType } from "@/components/ScorecardTypeSelector";
import { StrokePlayScorecardView } from "@/components/StrokePlayScorecardView";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SkinsPlayer {
  id?: string;
  odId?: string;
  name: string;
  displayName?: string;
  handicap?: number | null;
}

interface SkinsHole {
  id: string;
  game_id: string;
  hole_number: number;
  par: number;
  player_scores: Record<string, number>;
  winner_player: string | null;
  skins_available: number;
  is_carryover: boolean;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface SkinsScorecardViewProps {
  roundName: string;
  courseName: string;
  datePlayed: string;
  playerCount: number;
  position: number; // User's position (1st, 2nd, etc.)
  skinsWon: number; // User's skins won
  players: SkinsPlayer[];
  holes: SkinsHole[];
  courseHoles: CourseHole[];
  strokePlayEnabled: boolean;
  onHeaderClick?: () => void;
  onScorecardClick?: () => void;
}

export function SkinsScorecardView({
  roundName,
  courseName,
  datePlayed,
  playerCount,
  position,
  skinsWon,
  players,
  holes,
  courseHoles,
  strokePlayEnabled,
  onHeaderClick,
  onScorecardClick,
}: SkinsScorecardViewProps) {
  const [scorecardType, setScorecardType] = useState<ScorecardType>('primary');

  // Format position for display (1st, 2nd, 3rd)
  const formatPosition = (pos: number) => {
    if (pos === 1) return '1st';
    if (pos === 2) return '2nd';
    if (pos === 3) return '3rd';
    return `${pos}th`;
  };

  const getPlayerId = (player: SkinsPlayer) => {
    return player.odId || player.id || player.name;
  };

  const getPlayerName = (player: SkinsPlayer) => {
    return player.displayName || player.name || "Player";
  };

  const getPlayerSkinCount = (player: SkinsPlayer): number => {
    const playerId = getPlayerId(player);
    return holes
      .filter(h => h.winner_player === playerId)
      .reduce((sum, h) => sum + h.skins_available, 0);
  };

  // Sort players by skin count for display
  const sortedPlayers = [...players].sort((a, b) => 
    getPlayerSkinCount(b) - getPlayerSkinCount(a)
  );

  // Build course holes from skins holes if not provided
  const effectiveCourseHoles: CourseHole[] = courseHoles.length > 0 
    ? courseHoles 
    : holes.map(h => ({ hole_number: h.hole_number, par: h.par, stroke_index: 0 }));

  // Prepare stroke play data
  const strokePlayPlayers = players.map(player => {
    const playerId = getPlayerId(player);
    const scores = new Map<number, number>();
    let total = 0;
    
    holes.forEach(hole => {
      const score = hole.player_scores[playerId];
      if (score && score > 0) {
        scores.set(hole.hole_number, score);
        total += score;
      }
    });
    
    return { name: getPlayerName(player), scores, totalScore: total };
  });

  // Truncate name helper
  const truncateName = (name: string, maxLength: number = 8) => {
    if (name.length <= maxLength) return name;
    return name.slice(0, maxLength - 1) + "…";
  };

  const renderSkinsScorecard = () => {
    const frontNine = effectiveCourseHoles.filter(h => h.hole_number <= 9);
    const backNine = effectiveCourseHoles.filter(h => h.hole_number > 9);
    const hasBackNine = backNine.length > 0;

    const renderNine = (nineHoles: CourseHole[], isBackNine: boolean = false) => {
      if (nineHoles.length === 0) return null;

      const nineLabel = isBackNine ? 'In' : 'Out';

      return (
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-primary">
              <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
              {nineHoles.map(hole => (
                <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                  {hole.hole_number}
                </TableHead>
              ))}
              <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">{nineLabel}</TableHead>
              <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                {isBackNine ? 'Tot' : (hasBackNine ? '' : 'Tot')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Par row */}
            <TableRow>
              <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
              {nineHoles.map(hole => (
                <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                  {hole.par}
                </TableCell>
              ))}
              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                {nineHoles.reduce((sum, h) => sum + h.par, 0)}
              </TableCell>
              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                {isBackNine ? effectiveCourseHoles.reduce((sum, h) => sum + h.par, 0) : (hasBackNine ? '' : nineHoles.reduce((sum, h) => sum + h.par, 0))}
              </TableCell>
            </TableRow>

            {/* Player rows */}
            {sortedPlayers.map((player, index) => {
              const playerId = getPlayerId(player);
              
              // Calculate skins won for this nine
              let nineSkins = 0;
              nineHoles.forEach(hole => {
                const holeData = holes.find(h => h.hole_number === hole.hole_number);
                if (holeData && holeData.winner_player === playerId) {
                  nineSkins += holeData.skins_available;
                }
              });

              const totalSkins = getPlayerSkinCount(player);

              return (
                <TableRow key={index}>
                  <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">
                    {truncateName(getPlayerName(player).split(' ')[0])}
                  </TableCell>
                  {nineHoles.map(hole => {
                    const holeData = holes.find(h => h.hole_number === hole.hole_number);
                    const isWinner = holeData?.winner_player === playerId;
                    const hasWinner = holeData?.winner_player !== null;
                    const isCarryover = !hasWinner;
                    
                    let cellValue: string;
                    if (isWinner) {
                      cellValue = String(holeData?.skins_available || 1);
                    } else if (isCarryover) {
                      cellValue = '-';
                    } else {
                      cellValue = '0';
                    }
                    
                    return (
                      <TableCell 
                        key={hole.hole_number} 
                        className="text-center font-bold text-[10px] px-0 py-1"
                      >
                        {cellValue}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                    {nineSkins}
                  </TableCell>
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                    {(isBackNine || !hasBackNine) ? totalSkins : ''}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      );
    };

    return (
      <div className="border rounded-lg overflow-hidden">
        {renderNine(frontNine, false)}
        {hasBackNine && (
          <div className="border-t">
            {renderNine(backNine, true)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Round Card Style Header - Matching Profile Round Cards */}
      <div 
        className={`bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-b border-primary/20 p-4 ${onHeaderClick ? 'cursor-pointer hover:bg-gradient-to-br hover:from-primary/10 hover:via-primary/15 hover:to-primary/10 transition-colors' : ''}`}
        onClick={onHeaderClick}
      >
        <div className="flex items-center gap-4">
          {/* Left: Position and Skins Won - Matching Profile RoundCard */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className={`text-2xl font-bold ${position === 1 ? 'text-emerald-600' : 'text-foreground'}`}>
              {formatPosition(position)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {skinsWon} SKIN{skinsWon !== 1 ? 'S' : ''}
            </div>
          </div>
          
          {/* Right: Round Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate text-foreground">
              {roundName || 'Skins'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <span className="truncate">{courseName}</span>
              <span>·</span>
              <span className="flex-shrink-0">{format(new Date(datePlayed), "MMM d")}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span>Skins</span>
              <span>·</span>
              <span>{playerCount} players</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scorecard Type Selector */}
      <ScorecardTypeSelector
        primaryLabel="Skins"
        selectedType={scorecardType}
        onTypeChange={setScorecardType}
        strokePlayEnabled={strokePlayEnabled}
      />

      {/* Scorecard */}
      {effectiveCourseHoles.length > 0 && (
        <div 
          className={`px-4 pt-3 pb-4 ${onScorecardClick ? 'cursor-pointer' : ''}`}
          onClick={onScorecardClick}
        >
          {scorecardType === 'stroke_play' ? (
            <StrokePlayScorecardView
              players={strokePlayPlayers}
              courseHoles={effectiveCourseHoles}
              showNetRow={false}
            />
          ) : (
            renderSkinsScorecard()
          )}
        </div>
      )}
    </div>
  );
}
