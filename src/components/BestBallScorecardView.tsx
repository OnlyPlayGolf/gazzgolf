import { useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScorecardTypeSelector, ScorecardType } from "@/components/ScorecardTypeSelector";
import { StrokePlayScorecardView } from "@/components/StrokePlayScorecardView";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface BestBallPlayer {
  odId?: string;
  id?: string;
  displayName: string;
  name?: string;
}

interface BestBallHole {
  hole_number: number;
  team_a_scores?: { playerId: string; playerName: string; grossScore: number }[];
  team_b_scores?: { playerId: string; playerName: string; grossScore: number }[];
  match_status_after?: number;
}

interface BestBallScorecardViewProps {
  roundName: string;
  courseName: string;
  datePlayed: string;
  playerCount: number;
  matchResult: string;
  resultText: string;
  teamAPlayers: BestBallPlayer[];
  teamBPlayers: BestBallPlayer[];
  holes: BestBallHole[];
  courseHoles: CourseHole[];
  strokePlayEnabled: boolean;
  onHeaderClick?: () => void;
  onScorecardClick?: () => void;
}

export function BestBallScorecardView({
  roundName,
  courseName,
  datePlayed,
  playerCount,
  matchResult,
  resultText,
  teamAPlayers,
  teamBPlayers,
  holes,
  courseHoles,
  strokePlayEnabled,
  onHeaderClick,
  onScorecardClick,
}: BestBallScorecardViewProps) {
  const [scorecardType, setScorecardType] = useState<ScorecardType>('primary');

  // Get color for match result - same logic as RoundCard
  const getMatchResultColor = (result: string) => {
    if (result === 'W') return 'text-emerald-600';
    if (result === 'L') return 'text-destructive';
    return 'text-muted-foreground';
  };

  // Split holes into front/back nine
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);
  const hasBackNine = backNine.length > 0;

  const frontNinePar = frontNine.reduce((sum, h) => sum + h.par, 0);
  const backNinePar = backNine.reduce((sum, h) => sum + h.par, 0);
  const totalPar = frontNinePar + backNinePar;

  // Get player scores for a specific hole and team
  const getPlayerScoresForHole = (holeNumber: number, team: 'A' | 'B') => {
    const hole = holes.find(h => h.hole_number === holeNumber);
    if (!hole) return [];
    return team === 'A' ? (hole.team_a_scores || []) : (hole.team_b_scores || []);
  };

  // Get match status after a specific hole
  const getMatchStatusAfterHole = (holeNumber: number) => {
    const hole = holes.find(h => h.hole_number === holeNumber);
    if (!hole || hole.match_status_after === undefined) {
      return { text: '', leadingTeam: null as 'A' | 'B' | null };
    }
    
    const status = hole.match_status_after;
    if (status === 0) {
      return { text: 'AS', leadingTeam: null };
    } else if (status > 0) {
      return { text: `${status}UP`, leadingTeam: 'A' };
    } else {
      return { text: `${Math.abs(status)}UP`, leadingTeam: 'B' };
    }
  };

  // Calculate player totals
  const getPlayerTotal = (player: BestBallPlayer, team: 'A' | 'B', holeList: CourseHole[]) => {
    return holeList.reduce((sum, h) => {
      const scores = getPlayerScoresForHole(h.hole_number, team);
      const playerId = player.odId || player.id;
      const playerName = player.displayName || player.name;
      const playerScore = scores.find(s => 
        (playerId && s.playerId === playerId) || 
        (playerName && s.playerName === playerName)
      );
      return sum + (playerScore?.grossScore || 0);
    }, 0);
  };

  // Handle format tab change - only update local state, don't navigate
  const handleFormatChange = (newType: ScorecardType) => {
    setScorecardType(newType);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Round Card Style Header - Matching Profile Round Cards */}
      <div 
        className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-b border-primary/20 p-4 cursor-pointer hover:bg-gradient-to-br hover:from-primary/10 hover:via-primary/15 hover:to-primary/10 transition-colors"
        onClick={onHeaderClick}
      >
        <div className="flex items-center gap-4">
          {/* Left: Match Result with status below */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className={`text-3xl font-bold ${getMatchResultColor(matchResult)}`}>
              {matchResult}
            </div>
            <div className="text-sm text-muted-foreground">
              {resultText}
            </div>
          </div>
          
          {/* Right: Round Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate text-foreground">
              {roundName || 'Best Ball Match Play'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <span className="truncate">{courseName}</span>
              <span>·</span>
              <span className="flex-shrink-0">{format(new Date(datePlayed), "MMM d")}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Best Ball Match Play · {playerCount} players
            </div>
          </div>
        </div>
      </div>

      {/* Scorecard Type Selector */}
      <div onClick={(e) => e.stopPropagation()}>
        <ScorecardTypeSelector
          primaryLabel="Best Ball"
          selectedType={scorecardType}
          onTypeChange={handleFormatChange}
          strokePlayEnabled={strokePlayEnabled}
        />
      </div>

      {/* Scorecard - Match Play style */}
      {courseHoles.length > 0 && scorecardType === 'primary' && (
        <div 
          className="px-4 pt-4 cursor-pointer"
          onClick={onScorecardClick}
        >
          <div className="border rounded-lg overflow-hidden">
            {/* Front 9 */}
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-primary">
                  <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                  {frontNine.map(hole => (
                    <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-white">
                      {hole.hole_number}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Out</TableHead>
                  <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                    {!hasBackNine ? 'Tot' : ''}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Par Row */}
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                  {frontNine.map(hole => (
                    <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                      {hole.par}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                    {frontNinePar}
                  </TableCell>
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                    {!hasBackNine ? totalPar : ''}
                  </TableCell>
                </TableRow>
                
                {/* Team A Players */}
                {teamAPlayers.map((player, playerIndex) => {
                  const frontTotal = getPlayerTotal(player, 'A', frontNine);
                  const fullTotal = getPlayerTotal(player, 'A', courseHoles);
                  
                  return (
                    <TableRow key={player.odId || player.id || playerIndex}>
                      <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 bg-background truncate">
                        {(player.displayName || player.name || '').split(' ')[0]}
                      </TableCell>
                      {frontNine.map(hole => {
                        const scores = getPlayerScoresForHole(hole.hole_number, 'A');
                        const playerId = player.odId || player.id;
                        const playerName = player.displayName || player.name;
                        const playerScore = scores.find(s => 
                          (playerId && s.playerId === playerId) || 
                          (playerName && s.playerName === playerName)
                        );
                        const score = playerScore?.grossScore;
                        return (
                          <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                            {score ? <ScorecardScoreCell score={score} par={hole.par} /> : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {frontTotal || ''}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {!hasBackNine ? (fullTotal || '') : ''}
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                {/* Match Status Row */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-muted/50">Score</TableCell>
                  {frontNine.map(hole => {
                    const { text, leadingTeam } = getMatchStatusAfterHole(hole.hole_number);
                    return (
                      <TableCell 
                        key={hole.hole_number} 
                        className={`text-center font-bold text-[10px] px-0 py-1 ${
                          leadingTeam === 'A' ? 'bg-blue-500 text-white' :
                          leadingTeam === 'B' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''
                        }`}
                      >
                        {text}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
                </TableRow>
                
                {/* Team B Players */}
                {teamBPlayers.map((player, playerIndex) => {
                  const frontTotal = getPlayerTotal(player, 'B', frontNine);
                  const fullTotal = getPlayerTotal(player, 'B', courseHoles);
                  
                  return (
                    <TableRow key={player.odId || player.id || playerIndex}>
                      <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 bg-background truncate">
                        {(player.displayName || player.name || '').split(' ')[0]}
                      </TableCell>
                      {frontNine.map(hole => {
                        const scores = getPlayerScoresForHole(hole.hole_number, 'B');
                        const playerId = player.odId || player.id;
                        const playerName = player.displayName || player.name;
                        const playerScore = scores.find(s => 
                          (playerId && s.playerId === playerId) || 
                          (playerName && s.playerName === playerName)
                        );
                        const score = playerScore?.grossScore;
                        return (
                          <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                            {score ? <ScorecardScoreCell score={score} par={hole.par} /> : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {frontTotal || ''}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {!hasBackNine ? (fullTotal || '') : ''}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Back 9 */}
            {hasBackNine && (
              <div className="border-t">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow className="bg-primary">
                      <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                        {backNine.map(hole => (
                          <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-white">
                            {hole.hole_number}
                          </TableHead>
                        ))}
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">In</TableHead>
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Tot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Par Row */}
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                      {backNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                          {hole.par}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {backNinePar}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {totalPar}
                      </TableCell>
                    </TableRow>
                    
                    {/* Team A Players */}
                    {teamAPlayers.map((player, playerIndex) => {
                      const backTotal = getPlayerTotal(player, 'A', backNine);
                      const fullTotal = getPlayerTotal(player, 'A', courseHoles);
                      
                      return (
                        <TableRow key={player.odId || player.id || playerIndex}>
                          <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 bg-background truncate">
                            {(player.displayName || player.name || '').split(' ')[0]}
                          </TableCell>
                          {backNine.map(hole => {
                            const scores = getPlayerScoresForHole(hole.hole_number, 'A');
                            const playerId = player.odId || player.id;
                            const playerName = player.displayName || player.name;
                            const playerScore = scores.find(s => 
                              (playerId && s.playerId === playerId) || 
                              (playerName && s.playerName === playerName)
                            );
                            const score = playerScore?.grossScore;
                            return (
                              <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                                {score ? <ScorecardScoreCell score={score} par={hole.par} /> : ''}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {backTotal || ''}
                          </TableCell>
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {fullTotal || ''}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    
                    {/* Match Status Row */}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-muted/50">Score</TableCell>
                      {backNine.map(hole => {
                        const { text, leadingTeam } = getMatchStatusAfterHole(hole.hole_number);
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className={`text-center font-bold text-[10px] px-0 py-1 ${
                              leadingTeam === 'A' ? 'bg-blue-500 text-white' :
                              leadingTeam === 'B' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''
                            }`}
                          >
                            {text}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
                    </TableRow>
                    
                    {/* Team B Players */}
                    {teamBPlayers.map((player, playerIndex) => {
                      const backTotal = getPlayerTotal(player, 'B', backNine);
                      const fullTotal = getPlayerTotal(player, 'B', courseHoles);
                      
                      return (
                        <TableRow key={player.odId || player.id || playerIndex}>
                          <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 bg-background truncate">
                            {(player.displayName || player.name || '').split(' ')[0]}
                          </TableCell>
                          {backNine.map(hole => {
                            const scores = getPlayerScoresForHole(hole.hole_number, 'B');
                            const playerId = player.odId || player.id;
                            const playerName = player.displayName || player.name;
                            const playerScore = scores.find(s => 
                              (playerId && s.playerId === playerId) || 
                              (playerName && s.playerName === playerName)
                            );
                            const score = playerScore?.grossScore;
                            return (
                              <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                                {score ? <ScorecardScoreCell score={score} par={hole.par} /> : ''}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {backTotal || ''}
                          </TableCell>
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {fullTotal || ''}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stroke Play Scorecard */}
      {courseHoles.length > 0 && scorecardType === 'stroke_play' && (
        <div 
          className="px-4 pt-4 cursor-pointer"
          onClick={onScorecardClick}
        >
          <StrokePlayScorecardView
            players={[
              ...teamAPlayers.map(p => {
                const playerName = p.displayName || p.name || '';
                return {
                  name: playerName,
                  scores: new Map(holes.flatMap(h => {
                    const scores = getPlayerScoresForHole(h.hole_number, 'A');
                    const playerId = p.odId || p.id;
                    const playerName = p.displayName || p.name;
                    const playerScore = scores.find(s => 
                      (playerId && s.playerId === playerId) || 
                      (playerName && s.playerName === playerName)
                    );
                    return playerScore ? [[h.hole_number, playerScore.grossScore]] : [];
                  })),
                  totalScore: holes.reduce((sum, h) => {
                    const scores = getPlayerScoresForHole(h.hole_number, 'A');
                    const playerId = p.odId || p.id;
                    const playerName = p.displayName || p.name;
                    const ps = scores.find(s => 
                      (playerId && s.playerId === playerId) || 
                      (playerName && s.playerName === playerName)
                    );
                    return sum + (ps?.grossScore || 0);
                  }, 0)
                };
              }),
              ...teamBPlayers.map(p => {
                const playerName = p.displayName || p.name || '';
                return {
                  name: playerName,
                  scores: new Map(holes.flatMap(h => {
                    const scores = getPlayerScoresForHole(h.hole_number, 'B');
                    const playerId = p.odId || p.id;
                    const playerName = p.displayName || p.name;
                    const playerScore = scores.find(s => 
                      (playerId && s.playerId === playerId) || 
                      (playerName && s.playerName === playerName)
                    );
                    return playerScore ? [[h.hole_number, playerScore.grossScore]] : [];
                  })),
                  totalScore: holes.reduce((sum, h) => {
                    const scores = getPlayerScoresForHole(h.hole_number, 'B');
                    const playerId = p.odId || p.id;
                    const playerName = p.displayName || p.name;
                    const ps = scores.find(s => 
                      (playerId && s.playerId === playerId) || 
                      (playerName && s.playerName === playerName)
                    );
                    return sum + (ps?.grossScore || 0);
                  }, 0)
                };
              })
            ]}
            courseHoles={courseHoles}
          />
        </div>
      )}
    </div>
  );
}
