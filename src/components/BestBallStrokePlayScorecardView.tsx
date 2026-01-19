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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";
import { RoundCard, RoundCardData } from "@/components/RoundCard";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface BestBallPlayer {
  id: string;
  name: string;
}

interface HoleScoreData {
  teamAScores: { playerId: string; playerName: string; grossScore: number }[];
  teamBScores: { playerId: string; playerName: string; grossScore: number }[];
  teamABestGross?: number | null;
  teamBBestGross?: number | null;
}

type ScorecardTab = 'best_ball' | 'stroke_play';

interface BestBallStrokePlayScorecardViewProps {
  roundName: string;
  courseName: string;
  datePlayed: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: BestBallPlayer[];
  teamBPlayers: BestBallPlayer[];
  holeScores: Record<number, HoleScoreData>;
  courseHoles: CourseHole[];
  userTeam: 'A' | 'B';
  userTeamTotalScore: number;
  userTeamScoreToPar: number;
  onRoundCardClick?: () => void;
  onScorecardClick?: () => void;
}

export function BestBallStrokePlayScorecardView({
  roundName,
  courseName,
  datePlayed,
  teamAName,
  teamBName,
  teamAPlayers,
  teamBPlayers,
  holeScores,
  courseHoles,
  userTeam,
  userTeamTotalScore,
  userTeamScoreToPar,
  onRoundCardClick,
  onScorecardClick,
}: BestBallStrokePlayScorecardViewProps) {
  const [scorecardTab, setScorecardTab] = useState<ScorecardTab>('best_ball');

  const allPlayers = [
    ...teamAPlayers.map(p => ({ ...p, team: 'A' as const })),
    ...teamBPlayers.map(p => ({ ...p, team: 'B' as const })),
  ];

  // Split holes into front/back nine
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);
  const hasBackNine = backNine.length > 0;

  const frontNinePar = frontNine.reduce((sum, h) => sum + h.par, 0);
  const backNinePar = backNine.reduce((sum, h) => sum + h.par, 0);
  const totalPar = frontNinePar + backNinePar;

  // Get player scores for a specific hole and team
  const getPlayerScoresForHole = (holeNumber: number, team: 'A' | 'B') => {
    const hole = holeScores[holeNumber];
    if (!hole) return [];
    return team === 'A' ? (hole.teamAScores || []) : (hole.teamBScores || []);
  };

  // Get team best ball total for a set of holes
  const getTeamBestBallTotal = (team: 'A' | 'B', holeList: CourseHole[]) => {
    return holeList.reduce((sum, h) => {
      const scores = getPlayerScoresForHole(h.hole_number, team);
      const validScores = scores.filter(s => s.grossScore > 0).map(s => s.grossScore);
      if (validScores.length === 0) return sum;
      return sum + Math.min(...validScores);
    }, 0);
  };

  // Build RoundCard data
  const roundCardData: RoundCardData = {
    id: '',
    round_name: roundName || 'Best Ball',
    course_name: courseName,
    date: datePlayed,
    score: 0,
    playerCount: teamAPlayers.length + teamBPlayers.length,
    gameMode: 'Best Ball',
    gameType: 'best_ball',
    bestBallTotalScore: userTeamTotalScore > 0 ? userTeamTotalScore : null,
    bestBallScoreToPar: userTeamTotalScore > 0 ? userTeamScoreToPar : null,
  };

  // Render Best Ball scorecard (team best scores per hole)
  const renderBestBallScorecard = () => (
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
          
          {/* Team A Best Ball Row */}
          <TableRow>
            <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 bg-background truncate">
              {teamAName}
            </TableCell>
            {frontNine.map(hole => {
              const scores = getPlayerScoresForHole(hole.hole_number, 'A');
              const validScores = scores.filter(s => s.grossScore > 0).map(s => s.grossScore);
              const bestScore = validScores.length > 0 ? Math.min(...validScores) : null;
              return (
                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                  {bestScore ? <ScorecardScoreCell score={bestScore} par={hole.par} /> : ''}
                </TableCell>
              );
            })}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {getTeamBestBallTotal('A', frontNine) || ''}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {!hasBackNine ? (getTeamBestBallTotal('A', courseHoles) || '') : ''}
            </TableCell>
          </TableRow>
          
          {/* Team B Best Ball Row */}
          <TableRow>
            <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 bg-background truncate">
              {teamBName}
            </TableCell>
            {frontNine.map(hole => {
              const scores = getPlayerScoresForHole(hole.hole_number, 'B');
              const validScores = scores.filter(s => s.grossScore > 0).map(s => s.grossScore);
              const bestScore = validScores.length > 0 ? Math.min(...validScores) : null;
              return (
                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                  {bestScore ? <ScorecardScoreCell score={bestScore} par={hole.par} /> : ''}
                </TableCell>
              );
            })}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {getTeamBestBallTotal('B', frontNine) || ''}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {!hasBackNine ? (getTeamBestBallTotal('B', courseHoles) || '') : ''}
            </TableCell>
          </TableRow>
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
              
              {/* Team A Best Ball Row */}
              <TableRow>
                <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 bg-background truncate">
                  {teamAName}
                </TableCell>
                {backNine.map(hole => {
                  const scores = getPlayerScoresForHole(hole.hole_number, 'A');
                  const validScores = scores.filter(s => s.grossScore > 0).map(s => s.grossScore);
                  const bestScore = validScores.length > 0 ? Math.min(...validScores) : null;
                  return (
                    <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                      {bestScore ? <ScorecardScoreCell score={bestScore} par={hole.par} /> : ''}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {getTeamBestBallTotal('A', backNine) || ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {getTeamBestBallTotal('A', courseHoles) || ''}
                </TableCell>
              </TableRow>
              
              {/* Team B Best Ball Row */}
              <TableRow>
                <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 bg-background truncate">
                  {teamBName}
                </TableCell>
                {backNine.map(hole => {
                  const scores = getPlayerScoresForHole(hole.hole_number, 'B');
                  const validScores = scores.filter(s => s.grossScore > 0).map(s => s.grossScore);
                  const bestScore = validScores.length > 0 ? Math.min(...validScores) : null;
                  return (
                    <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                      {bestScore ? <ScorecardScoreCell score={bestScore} par={hole.par} /> : ''}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {getTeamBestBallTotal('B', backNine) || ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {getTeamBestBallTotal('B', courseHoles) || ''}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  // Render Stroke Play scorecard (individual player scores)
  const renderStrokePlayScorecard = () => (
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
          
          {/* Player Rows */}
          {allPlayers.map((player, playerIndex) => {
            const team = player.team;
            const frontTotal = frontNine.reduce((sum, h) => {
              const scores = getPlayerScoresForHole(h.hole_number, team);
              const playerScore = scores.find(s => s.playerId === player.id || s.playerName === player.name);
              return sum + (playerScore?.grossScore || 0);
            }, 0);
            const fullTotal = courseHoles.reduce((sum, h) => {
              const scores = getPlayerScoresForHole(h.hole_number, team);
              const playerScore = scores.find(s => s.playerId === player.id || s.playerName === player.name);
              return sum + (playerScore?.grossScore || 0);
            }, 0);
            
            return (
              <TableRow key={player.id || playerIndex}>
                <TableCell className={`font-medium text-[10px] px-0.5 py-1 bg-background truncate ${team === 'A' ? 'text-blue-600' : 'text-red-600'}`}>
                  {player.name.split(' ')[0]}
                </TableCell>
                {frontNine.map(hole => {
                  const scores = getPlayerScoresForHole(hole.hole_number, team);
                  const playerScore = scores.find(s => s.playerId === player.id || s.playerName === player.name);
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
              
              {/* Player Rows */}
              {allPlayers.map((player, playerIndex) => {
                const team = player.team;
                const backTotal = backNine.reduce((sum, h) => {
                  const scores = getPlayerScoresForHole(h.hole_number, team);
                  const playerScore = scores.find(s => s.playerId === player.id || s.playerName === player.name);
                  return sum + (playerScore?.grossScore || 0);
                }, 0);
                const fullTotal = courseHoles.reduce((sum, h) => {
                  const scores = getPlayerScoresForHole(h.hole_number, team);
                  const playerScore = scores.find(s => s.playerId === player.id || s.playerName === player.name);
                  return sum + (playerScore?.grossScore || 0);
                }, 0);
                
                return (
                  <TableRow key={player.id || playerIndex}>
                    <TableCell className={`font-medium text-[10px] px-0.5 py-1 bg-background truncate ${team === 'A' ? 'text-blue-600' : 'text-red-600'}`}>
                      {player.name.split(' ')[0]}
                    </TableCell>
                    {backNine.map(hole => {
                      const scores = getPlayerScoresForHole(hole.hole_number, team);
                      const playerScore = scores.find(s => s.playerId === player.id || s.playerName === player.name);
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
  );

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* RoundCard at the top - clickable to navigate */}
      <div 
        className="cursor-pointer"
        onClick={onRoundCardClick}
      >
        <RoundCard round={roundCardData} disabled className="border-0 shadow-none" />
      </div>

      {/* Format Switcher Tabs - NOT clickable for navigation */}
      <div 
        className="px-4 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <Tabs value={scorecardTab} onValueChange={(v) => setScorecardTab(v as ScorecardTab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="best_ball" className="text-xs">
              Best Ball
            </TabsTrigger>
            <TabsTrigger value="stroke_play" className="text-xs">
              Stroke Play
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Scorecard Content - clickable to navigate */}
      {courseHoles.length > 0 && (
        <div 
          className="px-4 pt-4 pb-4 cursor-pointer"
          onClick={onScorecardClick}
        >
          {scorecardTab === 'best_ball' ? renderBestBallScorecard() : renderStrokePlayScorecard()}
        </div>
      )}
    </div>
  );
}
