import { UmbriagioGame, UmbriagioHole } from "@/types/umbriago";
import { normalizeUmbriagioPoints } from "@/utils/umbriagioScoring";
import { UmbriagioSharedScorecard } from "@/components/UmbriagioSharedScorecard";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface UmbriagioScorecardProps {
  game: UmbriagioGame;
  holes: UmbriagioHole[];
  courseHoles: CourseHole[];
  currentUserTeam?: 'A' | 'B' | null;
}

export function UmbriagioScorecard({ 
  game, 
  holes, 
  courseHoles,
  currentUserTeam 
}: UmbriagioScorecardProps) {
  const { normalizedA, normalizedB } = normalizeUmbriagioPoints(
    game.team_a_total_points, 
    game.team_b_total_points
  );

  // Determine win/loss/tie for each team
  const getResult = (team: 'A' | 'B'): 'W' | 'L' | 'T' | null => {
    if (!game.is_finished) return null;
    if (game.winning_team === 'TIE') return 'T';
    if (game.winning_team === team) return 'W';
    if (game.winning_team) return 'L';
    return null;
  };

  const teamAResult = getResult('A');
  const teamBResult = getResult('B');

  // Determine which side to show result based on user's team
  // If user is on Team A, show result on left side
  // If user is on Team B, show result on right side
  const showLeftResult = currentUserTeam === 'A';
  const showRightResult = currentUserTeam === 'B';

  const getResultBadge = (result: 'W' | 'L' | 'T' | null) => {
    if (!result) return null;
    const bgClass = result === 'W' ? 'bg-green-500' : result === 'L' ? 'bg-red-500' : 'bg-muted';
    const textClass = result === 'T' ? 'text-muted-foreground' : 'text-white';
    return (
      <span className={`${bgClass} ${textClass} text-xs font-bold px-1.5 py-0.5 rounded`}>
        {result}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Match Score Display with VS */}
      <div className="flex items-center justify-center gap-4 py-3">
        <div className="flex items-center gap-2">
          {showLeftResult && getResultBadge(teamAResult)}
          <div className="text-center">
            <p className="text-3xl font-bold">{normalizedA}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[80px]" title={game.team_a_name}>
              {game.team_a_name.length > 10 ? game.team_a_name.slice(0, 9) + '…' : game.team_a_name}
            </p>
          </div>
        </div>
        <span className="text-lg font-bold text-muted-foreground">VS</span>
        <div className="flex items-center gap-2">
          <div className="text-center">
            <p className="text-3xl font-bold">{normalizedB}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[80px]" title={game.team_b_name}>
              {game.team_b_name.length > 10 ? game.team_b_name.slice(0, 9) + '…' : game.team_b_name}
            </p>
          </div>
          {showRightResult && getResultBadge(teamBResult)}
        </div>
      </div>

      {/* Shared Scorecard */}
      <UmbriagioSharedScorecard
        game={game}
        holes={holes}
        courseHoles={courseHoles}
      />
    </div>
  );
}
