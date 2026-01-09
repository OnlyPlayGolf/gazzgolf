import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Send, Trophy, Target, MoreHorizontal, Pencil, Trash2, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { RoundCard, RoundCardData } from "./RoundCard";
import { getGameRoute } from "@/utils/unifiedRoundsLoader";

// Parse drill result from post content
const parseDrillResult = (content: string) => {
  // Extended format with resultId: [DRILL_RESULT]title|score|unit|isPB|resultId[/DRILL_RESULT]
  const extendedMatch = content?.match(/\[DRILL_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/DRILL_RESULT\]/);
  if (extendedMatch) {
    return {
      drillTitle: extendedMatch[1],
      score: extendedMatch[2],
      unit: extendedMatch[3],
      isPersonalBest: extendedMatch[4] === 'true',
      resultId: extendedMatch[5],
      textContent: content.replace(/\[DRILL_RESULT\].+?\[\/DRILL_RESULT\]/, '').trim()
    };
  }
  // Original format without resultId
  const match = content?.match(/\[DRILL_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\[\/DRILL_RESULT\]/);
  if (match) {
    return {
      drillTitle: match[1],
      score: match[2],
      unit: match[3],
      isPersonalBest: match[4] === 'true',
      resultId: null,
      textContent: content.replace(/\[DRILL_RESULT\].+?\[\/DRILL_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Parse round result from post content
const parseRoundResult = (content: string) => {
  // Extended format with roundId: [ROUND_RESULT]name|course|score|vspar|holes|roundId[/ROUND_RESULT]
  const extendedMatch = content?.match(/\[ROUND_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/ROUND_RESULT\]/);
  if (extendedMatch) {
    return {
      roundName: extendedMatch[1],
      courseName: extendedMatch[2],
      score: parseInt(extendedMatch[3]),
      scoreVsPar: parseInt(extendedMatch[4]),
      holesPlayed: parseInt(extendedMatch[5]),
      roundId: extendedMatch[6],
      textContent: content.replace(/\[ROUND_RESULT\].+?\[\/ROUND_RESULT\]/, '').trim()
    };
  }
  // Original format without roundId
  const match = content?.match(/\[ROUND_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/ROUND_RESULT\]/);
  if (match) {
    return {
      roundName: match[1],
      courseName: match[2],
      score: parseInt(match[3]),
      scoreVsPar: parseInt(match[4]),
      holesPlayed: parseInt(match[5]),
      roundId: null,
      textContent: content.replace(/\[ROUND_RESULT\].+?\[\/ROUND_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Parse Umbriago result from post content
const parseUmbriagioResult = (content: string) => {
  // Extended format with gameId
  const extendedMatch = content?.match(/\[UMBRIAGO_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/UMBRIAGO_RESULT\]/);
  if (extendedMatch) {
    return {
      courseName: extendedMatch[1],
      teamAPoints: parseInt(extendedMatch[2]),
      teamBPoints: parseInt(extendedMatch[3]),
      winningTeam: extendedMatch[4] as 'A' | 'B' | 'TIE' | 'null',
      teamAPlayers: extendedMatch[5],
      teamBPlayers: extendedMatch[6],
      gameId: extendedMatch[7],
      textContent: content.replace(/\[UMBRIAGO_RESULT\].+?\[\/UMBRIAGO_RESULT\]/, '').trim()
    };
  }
  // Original format without gameId
  const match = content?.match(/\[UMBRIAGO_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/UMBRIAGO_RESULT\]/);
  if (match) {
    return {
      courseName: match[1],
      teamAPoints: parseInt(match[2]),
      teamBPoints: parseInt(match[3]),
      winningTeam: match[4] as 'A' | 'B' | 'TIE' | 'null',
      teamAPlayers: match[5],
      teamBPlayers: match[6],
      gameId: null,
      textContent: content.replace(/\[UMBRIAGO_RESULT\].+?\[\/UMBRIAGO_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Parse game result from post content (for Best Ball, Match Play, Skins, etc.)
const parseGameResult = (content: string) => {
  // New format with roundName: [GAME_RESULT]gameType|courseName|roundName|winner|resultText|additionalInfo|gameId[/GAME_RESULT]
  const newMatch = content?.match(/\[GAME_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/GAME_RESULT\]/);
  if (newMatch) {
    return {
      gameType: newMatch[1],
      courseName: newMatch[2],
      roundName: newMatch[3] || null,
      winner: newMatch[4] || null,
      resultText: newMatch[5] || null,
      additionalInfo: newMatch[6] || null,
      gameId: newMatch[7] || null,
      textContent: content.replace(/\[GAME_RESULT\].+?\[\/GAME_RESULT\]/, '').trim()
    };
  }
  // Old format without roundName (for backwards compatibility)
  const oldMatch = content?.match(/\[GAME_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/GAME_RESULT\]/);
  if (oldMatch) {
    return {
      gameType: oldMatch[1],
      courseName: oldMatch[2],
      roundName: null,
      winner: oldMatch[3] || null,
      resultText: oldMatch[4] || null,
      additionalInfo: oldMatch[5] || null,
      gameId: oldMatch[6] || null,
      textContent: content.replace(/\[GAME_RESULT\].+?\[\/GAME_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Drill Result Card Component - matches RoundCard layout
const DrillResultCard = ({ drillTitle, score, unit, isPersonalBest, date, onClick }: { 
  drillTitle: string; 
  score: string; 
  unit: string; 
  isPersonalBest: boolean;
  date?: string;
  onClick?: () => void;
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card 
      className="cursor-pointer bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Left: Score */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className="text-2xl font-bold text-primary">{score}</div>
            <div className="text-xs text-muted-foreground">{unit}</div>
          </div>
          
          {/* Middle: Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{drillTitle}</h3>
              {isPersonalBest && (
                <span className="flex items-center gap-1 text-xs text-amber-600 flex-shrink-0">
                  <Trophy className="h-3 w-3" />
                  PB
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Target className="h-3 w-3" />
              <span>Drill Result</span>
              {date && (
                <>
                  <span>·</span>
                  <span>{formatDate(date)}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Right: Chevron */}
          <ChevronRight size={20} className="text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
        </div>
      </CardContent>
    </Card>
  );
};

// Helper to convert game type string to RoundCard gameType
const getGameTypeForCard = (gameType: string): RoundCardData['gameType'] => {
  const typeMap: Record<string, RoundCardData['gameType']> = {
    'Best Ball': 'best_ball',
    'Match Play': 'match_play',
    'Skins': 'skins',
    'Wolf': 'wolf',
    'Copenhagen': 'copenhagen',
    'Scramble': 'scramble',
    'Umbriago': 'umbriago',
  };
  return typeMap[gameType] || 'round';
};

// Helper to get database table name from game type
const getTableFromGameType = (gameType: string): string => {
  const tableMap: Record<string, string> = {
    'Best Ball': 'best_ball_games',
    'Match Play': 'match_play_games',
    'Skins': 'skins_games',
    'Wolf': 'wolf_games',
    'Copenhagen': 'copenhagen_games',
    'Scramble': 'scramble_games',
    'Umbriago': 'umbriago_games',
  };
  return tableMap[gameType] || '';
};

// Component that fetches game data and renders RoundCard
const GameResultCardFromDB = ({
  gameType,
  gameId,
  resultUserId,
  fallbackCourseName,
  fallbackRoundName,
}: {
  gameType: string;
  gameId: string;
  resultUserId: string;
  fallbackCourseName: string;
  fallbackRoundName: string | null;
}) => {
  const navigate = useNavigate();
  const [gameData, setGameData] = useState<RoundCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGameData = async () => {
      const tableName = getTableFromGameType(gameType);
      if (!tableName || !gameId) {
        setLoading(false);
        return;
      }

      const selectFields = (() => {
        if (tableName === "match_play_games") {
          return "id, course_name, round_name, date_played, holes_played, winner_player, final_result, is_finished, player_1, player_2";
        }
        if (tableName === "best_ball_games") {
          return "id, course_name, round_name, date_played, holes_played, game_type, winner_team, final_result, is_finished, team_a_players, team_b_players";
        }
        if (tableName === "copenhagen_games") {
          return "id, course_name, round_name, date_played, holes_played, player_1, player_2, player_3, player_1_total_points, player_2_total_points, player_3_total_points";
        }
        if (tableName === "scramble_games") {
          return "id, course_name, round_name, date_played, holes_played, teams, winning_team";
        }
        if (tableName === "umbriago_games") {
          return "id, course_name, round_name, date_played, holes_played, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2, team_a_total_points, team_b_total_points, is_finished";
        }
        if (tableName === "wolf_games") {
          return "id, course_name, round_name, date_played, holes_played, player_1, player_2, player_3, player_4, player_5, player_6, player_1_points, player_2_points, player_3_points, player_4_points, player_5_points, player_6_points, is_finished";
        }
        return "id, course_name, round_name, date_played, holes_played";
      })();

      try {
        // First fetch the game data
        const [{ data, error }, { data: resultUserProfile }] = await Promise.all([
          supabase
            .from(tableName as any)
            .select(selectFields)
            .eq("id", gameId)
            .single(),
          supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", resultUserId)
            .maybeSingle(),
        ]);

        if (error || !data) {
          setLoading(false);
          return;
        }

        // Fetch scramble holes if needed
        let scrambleHoles: any[] = [];
        if (tableName === "scramble_games") {
          const { data: holesData } = await supabase
            .from("scramble_holes")
            .select("game_id, par, team_scores")
            .eq("game_id", gameId);
          scrambleHoles = holesData || [];
        }

        const participantNamesRaw = [
          resultUserProfile?.display_name,
          resultUserProfile?.username,
        ]
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim());

        const participantNames = Array.from(new Set(participantNamesRaw));

        const extractPlayerNames = (playersJson: any): string[] => {
          if (!Array.isArray(playersJson)) return [];
          return playersJson
            .map((p) => {
              if (typeof p === "string") return p;
              if (p && typeof p === "object" && typeof p.name === "string") return p.name;
              return null;
            })
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .map((v) => v.trim());
        };

        const computeMatchPlayOutcome = (): {
          matchResult: RoundCardData["matchResult"];
          matchFinalScore: string | null;
        } => {
          // Default (not match play / can't determine)
          let matchResult: RoundCardData["matchResult"] = null;
          let matchFinalScore: string | null = null;

          if (tableName === "match_play_games") {
            const g = data as any;
            if (!g?.is_finished) return { matchResult, matchFinalScore };

            const userIsPlayer1 = participantNames.includes(g.player_1);
            const userIsPlayer2 = participantNames.includes(g.player_2);
            if (!userIsPlayer1 && !userIsPlayer2) return { matchResult, matchFinalScore };

            if (!g.winner_player) {
              matchResult = "T";
              matchFinalScore = null;
              return { matchResult, matchFinalScore };
            }

            matchResult = participantNames.includes(g.winner_player) ? "W" : "L";
            matchFinalScore = g.final_result ?? null;
            return { matchResult, matchFinalScore };
          }

          if (tableName === "best_ball_games") {
            const g = data as any;
            if (g?.game_type !== "match_play") return { matchResult, matchFinalScore };
            if (!g?.is_finished) return { matchResult, matchFinalScore };

            const teamAPlayers = extractPlayerNames(g.team_a_players);
            const teamBPlayers = extractPlayerNames(g.team_b_players);

            const isOnTeamA = participantNames.some((n) => teamAPlayers.includes(n));
            const isOnTeamB = participantNames.some((n) => teamBPlayers.includes(n));

            const userTeam = isOnTeamA ? "A" : isOnTeamB ? "B" : null;
            if (!userTeam) return { matchResult, matchFinalScore };

            if (!g.winner_team) {
              matchResult = "T";
              matchFinalScore = null;
              return { matchResult, matchFinalScore };
            }

            matchResult = g.winner_team === userTeam ? "W" : "L";
            matchFinalScore = g.final_result ?? null;
            return { matchResult, matchFinalScore };
          }

          return { matchResult, matchFinalScore };
        };

        const { matchResult, matchFinalScore } = computeMatchPlayOutcome();

        // Compute Copenhagen position and final score
        const computeCopenhagenData = (): { position: number | null; copenhagenFinalScore: string | null } => {
          if (tableName !== "copenhagen_games") return { position: null, copenhagenFinalScore: null };
          
          const g = data as any;
          const rawPoints = [
            { player: 1, pts: g.player_1_total_points || 0, name: g.player_1 },
            { player: 2, pts: g.player_2_total_points || 0, name: g.player_2 },
            { player: 3, pts: g.player_3_total_points || 0, name: g.player_3 },
          ];
          
          // Normalize points (subtract minimum so lowest is 0)
          const minPts = Math.min(...rawPoints.map(p => p.pts));
          const normalizedPoints = rawPoints.map(p => ({ ...p, pts: p.pts - minPts }));
          
          // Sort by points descending for position calculation
          const sortedPoints = [...normalizedPoints].sort((a, b) => b.pts - a.pts);
          
          // Find which player the result user is
          let userPlayerIndex: number | null = null;
          if (participantNames.some(n => n === g.player_1)) userPlayerIndex = 1;
          else if (participantNames.some(n => n === g.player_2)) userPlayerIndex = 2;
          else if (participantNames.some(n => n === g.player_3)) userPlayerIndex = 3;
          
          let position: number | null = null;
          if (userPlayerIndex) {
            position = sortedPoints.findIndex((p) => p.player === userPlayerIndex) + 1;
          }
          
          // Create final score string (e.g., "8-3-0") from sorted normalized points
          const copenhagenFinalScore = sortedPoints.map(p => p.pts).join('-');
          
          return { position, copenhagenFinalScore };
        };

        const { position, copenhagenFinalScore } = computeCopenhagenData();

        // Compute Scramble position and score to par
        const computeScrambleData = (): { scramblePosition: number | null; scrambleScoreToPar: number | null } => {
          if (tableName !== "scramble_games") return { scramblePosition: null, scrambleScoreToPar: null };
          
          const g = data as any;
          const teams = Array.isArray(g.teams) ? g.teams : [];
          
          // Find which team the user is on
          let userTeamId: string | null = null;
          for (const team of teams) {
            const players = Array.isArray(team.players) ? team.players : [];
            for (const p of players) {
              const pName = typeof p === "string" ? p : p?.name;
              if (pName && participantNames.includes(pName)) {
                userTeamId = team.id;
                break;
              }
            }
            if (userTeamId) break;
          }
          
          // If not found, default to first team
          if (!userTeamId && teams.length > 0) {
            userTeamId = teams[0].id;
          }
          
          // Calculate team scores from holes
          const teamTotals: Record<string, { score: number; par: number }> = {};
          
          for (const hole of scrambleHoles) {
            const teamScores = hole.team_scores || {};
            for (const [teamId, score] of Object.entries(teamScores)) {
              if (!teamTotals[teamId]) {
                teamTotals[teamId] = { score: 0, par: 0 };
              }
              teamTotals[teamId].score += score as number;
              teamTotals[teamId].par += hole.par;
            }
          }
          
          // Calculate score to par for each team and sort for position
          const teamResults = Object.entries(teamTotals).map(([teamId, teamData]) => ({
            teamId,
            scoreToPar: teamData.score - teamData.par,
          })).sort((a, b) => a.scoreToPar - b.scoreToPar); // Lower is better
          
          // Find user's position and score
          let scramblePosition: number | null = null;
          let scrambleScoreToPar: number | null = null;
          
          if (userTeamId) {
            const userTeamIndex = teamResults.findIndex(t => t.teamId === userTeamId);
            if (userTeamIndex !== -1) {
              scramblePosition = userTeamIndex + 1;
              scrambleScoreToPar = teamResults[userTeamIndex].scoreToPar;
            }
          }
          
          return { scramblePosition, scrambleScoreToPar };
        };

        const { scramblePosition, scrambleScoreToPar } = computeScrambleData();

        // Compute Umbriago position and score
        const computeUmbriagioData = () => {
          if (tableName !== "umbriago_games") return { umbriagioPosition: null, umbriagioFinalScore: null };
          const umbriagioData = data as any;
          if (!umbriagioData.is_finished) return { umbriagioPosition: null, umbriagioFinalScore: null };
          
          const teamAPoints = umbriagioData.team_a_total_points || 0;
          const teamBPoints = umbriagioData.team_b_total_points || 0;
          
          // Normalize points
          const minPoints = Math.min(teamAPoints, teamBPoints);
          const normalizedA = teamAPoints - minPoints;
          const normalizedB = teamBPoints - minPoints;
          const umbriagioFinalScore = `${normalizedA}-${normalizedB}`;
          
          // Determine user's result (W/L/T)
          let umbriagioResult: 'W' | 'L' | 'T' | null = null;
          const userInTeamA = participantNames.includes(umbriagioData.team_a_player_1) || 
                              participantNames.includes(umbriagioData.team_a_player_2);
          const userInTeamB = participantNames.includes(umbriagioData.team_b_player_1) || 
                              participantNames.includes(umbriagioData.team_b_player_2);
          
          if (teamAPoints === teamBPoints) {
            umbriagioResult = 'T';
          } else if (userInTeamA && !userInTeamB) {
            umbriagioResult = teamAPoints > teamBPoints ? 'W' : 'L';
          } else if (userInTeamB && !userInTeamA) {
            umbriagioResult = teamBPoints > teamAPoints ? 'W' : 'L';
          } else {
            umbriagioResult = teamAPoints > teamBPoints ? 'W' : 'L';
          }
          
          return { umbriagioResult, umbriagioFinalScore };
        };
        
        const { umbriagioResult, umbriagioFinalScore } = computeUmbriagioData();

        // Compute Wolf position and final score
        const computeWolfData = (): { wolfPosition: number | null; wolfFinalScore: string | null } => {
          if (tableName !== "wolf_games") return { wolfPosition: null, wolfFinalScore: null };
          
          const g = data as any;
          if (!g.is_finished) return { wolfPosition: null, wolfFinalScore: null };
          
          // Get all players with their points
          const players = [
            { index: 1, name: g.player_1, pts: g.player_1_points || 0 },
            { index: 2, name: g.player_2, pts: g.player_2_points || 0 },
            { index: 3, name: g.player_3, pts: g.player_3_points || 0 },
          ];
          if (g.player_4) players.push({ index: 4, name: g.player_4, pts: g.player_4_points || 0 });
          if (g.player_5) players.push({ index: 5, name: g.player_5, pts: g.player_5_points || 0 });
          if (g.player_6) players.push({ index: 6, name: g.player_6, pts: g.player_6_points || 0 });
          
          // Normalize points (subtract minimum so lowest is 0)
          const minPts = Math.min(...players.map(p => p.pts));
          const normalizedPlayers = players.map(p => ({ ...p, pts: p.pts - minPts }));
          
          // Sort by points descending
          const sortedPlayers = [...normalizedPlayers].sort((a, b) => b.pts - a.pts);
          
          // Find user's position
          let userPlayerIndex: number | null = null;
          for (const p of players) {
            if (participantNames.includes(p.name)) {
              userPlayerIndex = p.index;
              break;
            }
          }
          
          let wolfPosition: number | null = null;
          if (userPlayerIndex) {
            wolfPosition = sortedPlayers.findIndex(p => p.index === userPlayerIndex) + 1;
          }
          
          // Create final score string (e.g., "8-5-3-0")
          const wolfFinalScore = sortedPlayers.map(p => p.pts).join('-');
          
          return { wolfPosition, wolfFinalScore };
        };

        const { wolfPosition, wolfFinalScore } = computeWolfData();

        const gameRecord = data as unknown as {
          id: string;
          course_name: string;
          round_name: string | null;
          date_played: string;
          holes_played: number;
        };

        // Calculate player count based on game type
        let playerCount = 2;
        if (gameType === "Copenhagen") playerCount = 3;
        else if (gameType === "Wolf") playerCount = 4;
        else if (gameType === "Umbriago") playerCount = 4;
        else if (gameType === "Best Ball" || gameType === "Scramble") playerCount = 4;

        setGameData({
          id: gameRecord.id,
          round_name: gameRecord.round_name,
          course_name: gameRecord.course_name,
          date: gameRecord.date_played,
          score: 0,
          playerCount,
          gameMode: gameType,
          gameType: getGameTypeForCard(gameType),
          holesPlayed: gameRecord.holes_played,
          matchResult,
          matchFinalScore,
          position,
          copenhagenFinalScore,
          scramblePosition,
          scrambleScoreToPar,
          umbriagioResult,
          umbriagioFinalScore,
          wolfPosition,
          wolfFinalScore,
        });
      } catch (err) {
        console.error("Error fetching game data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, [gameType, gameId, resultUserId]);

  const handleClick = () => {
    if (gameId) {
      const gameTypeLower = gameType.toLowerCase().replace(/\s+/g, "-");
      const routeMap: Record<string, string> = {
        "best-ball": "best-ball",
        "match-play": "match-play",
        skins: "skins",
        wolf: "wolf",
        copenhagen: "copenhagen",
        scramble: "scramble",
        umbriago: "umbriago",
      };
      const route = routeMap[gameTypeLower] || gameTypeLower;
      navigate(`/${route}/${gameId}/summary`);
    } else {
      toast.error("Game details not found");
    }
  };

  if (loading) {
    return (
      <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-border">
        <CardContent className="p-4">
          <div className="animate-pulse flex items-center gap-4">
            <div className="w-14 h-8 bg-muted rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use fetched data or fallback
  const roundData: RoundCardData = gameData || {
    id: gameId,
    round_name: fallbackRoundName,
    course_name: fallbackCourseName,
    date: new Date().toISOString(),
    score: 0,
    playerCount: 2,
    gameMode: gameType,
    gameType: getGameTypeForCard(gameType),
  };

  return <RoundCard round={roundData} onClick={handleClick} />;
};

interface FeedPostProps {
  post: any;
  currentUserId: string;
  onPostDeleted?: () => void;
}

export const FeedPost = ({ post, currentUserId, onPostDeleted }: FeedPostProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostContent, setEditPostContent] = useState("");
  const [isSavingPost, setIsSavingPost] = useState(false);

  const isOwnPost = post.user_id === currentUserId;

  const handleProfileClick = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (error) throw error;

      toast.success("Post deleted");
      onPostDeleted?.();
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditPost = () => {
    // Extract just the text content (without special result tags)
    const drillResult = parseDrillResult(post.content);
    const roundResult = parseRoundResult(post.content);
    const umbriagioResult = parseUmbriagioResult(post.content);
    const gameResult = parseGameResult(post.content);
    
    let textContent = post.content || "";
    if (drillResult) textContent = drillResult.textContent;
    else if (roundResult) textContent = roundResult.textContent;
    else if (umbriagioResult) textContent = umbriagioResult.textContent;
    else if (gameResult) textContent = gameResult.textContent;
    
    setEditPostContent(textContent);
    setIsEditingPost(true);
  };

  const handleSavePost = async () => {
    setIsSavingPost(true);
    try {
      // Preserve special result tags if they exist
      let newContent = editPostContent.trim();
      
      const drillMatch = post.content?.match(/\[DRILL_RESULT\].+?\[\/DRILL_RESULT\]/);
      const roundMatch = post.content?.match(/\[ROUND_RESULT\].+?\[\/ROUND_RESULT\]/);
      const umbriagioMatch = post.content?.match(/\[UMBRIAGO_RESULT\].+?\[\/UMBRIAGO_RESULT\]/);
      const gameMatch = post.content?.match(/\[GAME_RESULT\].+?\[\/GAME_RESULT\]/);
      
      if (drillMatch) {
        newContent = newContent ? `${newContent}\n${drillMatch[0]}` : drillMatch[0];
      } else if (roundMatch) {
        newContent = newContent ? `${newContent}\n${roundMatch[0]}` : roundMatch[0];
      } else if (umbriagioMatch) {
        newContent = newContent ? `${newContent}\n${umbriagioMatch[0]}` : umbriagioMatch[0];
      } else if (gameMatch) {
        newContent = newContent ? `${newContent}\n${gameMatch[0]}` : gameMatch[0];
      }

      const { error } = await supabase
        .from("posts")
        .update({ content: newContent || null })
        .eq("id", post.id)
        .eq("user_id", currentUserId);

      if (error) throw error;

      // Update local state
      post.content = newContent || null;
      setIsEditingPost(false);
      toast.success("Post updated");
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Failed to update post");
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleCancelEditPost = () => {
    setIsEditingPost(false);
    setEditPostContent("");
  };

  useEffect(() => {
    loadLikes();
    loadComments();
  }, [post.id]);

  const loadLikes = async () => {
    const { data: likes } = await supabase
      .from("post_likes")
      .select("*")
      .eq("post_id", post.id);

    if (likes) {
      setLikeCount(likes.length);
      setLiked(likes.some((like) => like.user_id === currentUserId));
    }
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("post_comments")
      .select(`
        *,
        profiles:user_id (
          display_name,
          username,
          avatar_url
        )
      `)
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });

    if (data) {
      setComments(data);
    }
  };

  const handleLike = async () => {
    try {
      if (liked) {
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
        setLiked(false);
        setLikeCount((prev) => prev - 1);
      } else {
        await supabase
          .from("post_likes")
          .insert({ post_id: post.id, user_id: currentUserId });
        setLiked(true);
        setLikeCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like");
    }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("post_comments")
        .insert({
          post_id: post.id,
          user_id: currentUserId,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment("");
      await loadComments();
      toast.success("Comment added");
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = (commentId: string, currentContent: string) => {
    setEditingCommentId(commentId);
    setEditCommentContent(currentContent);
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!editCommentContent.trim()) return;

    try {
      const { error } = await supabase
        .from("post_comments")
        .update({ content: editCommentContent.trim() })
        .eq("id", commentId)
        .eq("user_id", currentUserId);

      if (error) throw error;

      setEditingCommentId(null);
      setEditCommentContent("");
      await loadComments();
      toast.success("Comment updated");
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Failed to update comment");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", currentUserId);

      if (error) throw error;

      await loadComments();
      toast.success("Comment deleted");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  const displayName = post.profile?.display_name || post.profile?.username || "User";
  const initials = displayName.charAt(0).toUpperCase();
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  // Check if this post contains a drill result, round result, umbriago result, or game result
  const drillResult = parseDrillResult(post.content);
  const roundResult = parseRoundResult(post.content);
  const umbriagioResult = parseUmbriagioResult(post.content);
  const gameResult = parseGameResult(post.content);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Post Header */}
        <div className="flex items-center gap-3">
          <ProfilePhoto
            src={post.profile?.avatar_url}
            alt={displayName}
            fallback={displayName}
            size="md"
            onClick={() => handleProfileClick(post.user_id)}
          />
          <div className="flex-1">
            <p 
              className="font-semibold text-foreground cursor-pointer hover:underline"
              onClick={() => handleProfileClick(post.user_id)}
            >
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
          {isOwnPost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                >
                  <MoreHorizontal size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEditPost}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Post Content */}
        {isEditingPost ? (
          <div className="space-y-3">
            <Textarea
              value={editPostContent}
              onChange={(e) => setEditPostContent(e.target.value)}
              placeholder="What's on your golf mind?"
              className="min-h-[80px] resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEditPost}
                disabled={isSavingPost}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSavePost}
                disabled={isSavingPost}
              >
                {isSavingPost ? "Saving..." : "Save"}
              </Button>
            </div>
            {/* Show the result card in read-only mode during edit */}
            {drillResult && (
              <DrillResultCard 
                drillTitle={drillResult.drillTitle}
                score={drillResult.score}
                unit={drillResult.unit}
                isPersonalBest={drillResult.isPersonalBest}
                date={post.created_at}
              />
            )}
            {roundResult && (
              <RoundCard 
                round={{
                  id: roundResult.roundId || '',
                  round_name: roundResult.roundName,
                  course_name: roundResult.courseName,
                  date: new Date().toISOString(),
                  score: roundResult.scoreVsPar,
                  playerCount: 1,
                  gameMode: 'Stroke Play',
                  gameType: 'round',
                  holesPlayed: roundResult.holesPlayed,
                }}
              />
            )}
            {gameResult && gameResult.gameId && (
              <GameResultCardFromDB 
                gameType={gameResult.gameType}
                gameId={gameResult.gameId}
                resultUserId={post.user_id}
                fallbackCourseName={gameResult.courseName}
                fallbackRoundName={gameResult.roundName}
              />
            )}
          </div>
        ) : drillResult ? (
          <div className="space-y-3">
            {drillResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{drillResult.textContent}</p>
            )}
            <DrillResultCard 
              drillTitle={drillResult.drillTitle}
              score={drillResult.score}
              unit={drillResult.unit}
              isPersonalBest={drillResult.isPersonalBest}
              date={post.created_at}
              onClick={async () => {
                if (drillResult.resultId) {
                  navigate(`/drill-result/${drillResult.resultId}`);
                } else {
                  // Try to find the result by matching drill title, user, and score
                  const { data: drillData } = await supabase
                    .rpc('get_or_create_drill_by_title', { p_title: drillResult.drillTitle });
                  if (drillData) {
                    const { data: results } = await supabase
                      .from('drill_results')
                      .select('id')
                      .eq('drill_id', drillData)
                      .eq('user_id', post.user_id)
                      .eq('total_points', parseInt(drillResult.score))
                      .order('created_at', { ascending: false })
                      .limit(1);
                    if (results && results.length > 0) {
                      navigate(`/drill-result/${results[0].id}`);
                      return;
                    }
                  }
                  toast.error("Result details not found");
                }
              }}
            />
          </div>
        ) : roundResult ? (
          <div className="space-y-3">
            {roundResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{roundResult.textContent}</p>
            )}
            <RoundCard 
              round={{
                id: roundResult.roundId || '',
                round_name: roundResult.roundName,
                course_name: roundResult.courseName,
                date: new Date().toISOString(),
                score: roundResult.scoreVsPar,
                playerCount: 1,
                gameMode: 'Stroke Play',
                gameType: 'round',
                holesPlayed: roundResult.holesPlayed,
              }}
              onClick={async () => {
                if (roundResult.roundId) {
                  sessionStorage.setItem(`spectator_return_${roundResult.roundId}`, location.pathname);
                  navigate(`/rounds/${roundResult.roundId}/leaderboard`);
                } else {
                  // Try to find the round by matching course, user, and score
                  try {
                    const { data: rounds, error } = await supabase
                      .from('rounds')
                      .select('id')
                      .eq('user_id', post.user_id)
                      .eq('course_name', roundResult.courseName)
                      .order('created_at', { ascending: false })
                      .limit(5);
                    
                    if (error) throw error;
                    
                    if (rounds && rounds.length > 0) {
                      // Try to find exact match with score from round_summaries
                      for (const round of rounds) {
                        const { data: summary } = await supabase
                          .from('round_summaries')
                          .select('total_score, score_vs_par')
                          .eq('round_id', round.id)
                          .maybeSingle();
                        
                        if (summary && summary.total_score === roundResult.score) {
                          sessionStorage.setItem(`spectator_return_${round.id}`, location.pathname);
                          navigate(`/rounds/${round.id}/leaderboard`);
                          return;
                        }
                      }
                      // Fallback to first round if no exact match
                      sessionStorage.setItem(`spectator_return_${rounds[0].id}`, location.pathname);
                      navigate(`/rounds/${rounds[0].id}/leaderboard`);
                      return;
                    }
                    toast.error("Round details not found");
                  } catch (err) {
                    console.error("Error finding round:", err);
                    toast.error("Error finding round details");
                  }
                }
              }}
            />
          </div>
        ) : umbriagioResult ? (
          <div className="space-y-3">
            {umbriagioResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{umbriagioResult.textContent}</p>
            )}
            {umbriagioResult.gameId ? (
              <GameResultCardFromDB 
                gameType="Umbriago"
                gameId={umbriagioResult.gameId}
                resultUserId={post.user_id}
                fallbackCourseName={umbriagioResult.courseName}
                fallbackRoundName={null}
              />
            ) : (
              <RoundCard 
                round={{
                  id: '',
                  round_name: 'Umbriago',
                  course_name: umbriagioResult.courseName,
                  date: new Date().toISOString(),
                  score: 0,
                  playerCount: 4,
                  gameMode: 'Umbriago',
                  gameType: 'umbriago',
                }}
                onClick={async () => {
                  // Try to find the game by matching course and user
                  const { data: games } = await supabase
                    .from('umbriago_games')
                    .select('id')
                    .eq('user_id', post.user_id)
                    .eq('course_name', umbriagioResult.courseName)
                    .order('created_at', { ascending: false })
                    .limit(1);
                  if (games && games.length > 0) {
                    navigate(`/umbriago/${games[0].id}/summary`);
                    return;
                  }
                  toast.error("Game details not found");
                }}
              />
            )}
          </div>
        ) : gameResult ? (
          <div className="space-y-3">
            {gameResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{gameResult.textContent}</p>
            )}
            {gameResult.gameId ? (
              <GameResultCardFromDB 
                gameType={gameResult.gameType}
                gameId={gameResult.gameId}
                resultUserId={post.user_id}
                fallbackCourseName={gameResult.courseName}
                fallbackRoundName={gameResult.roundName}
              />
            ) : (
              <RoundCard 
                round={{
                  id: '',
                  round_name: gameResult.roundName || gameResult.gameType,
                  course_name: gameResult.courseName,
                  date: new Date().toISOString(),
                  score: 0,
                  playerCount: 2,
                  gameMode: gameResult.gameType,
                  gameType: getGameTypeForCard(gameResult.gameType),
                }}
                onClick={() => toast.error("Game details not found")}
              />
            )}
          </div>
        ) : post.content && (
          <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
        )}

        {/* Post Image */}
        {post.image_url && (
          <img
            src={post.image_url}
            alt="Post"
            className="w-full rounded-lg object-cover max-h-96"
          />
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-4 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={liked ? "text-red-500" : ""}
          >
            <Heart size={18} className={`mr-2 ${liked ? "fill-current" : ""}`} />
            {likeCount} {likeCount === 1 ? "Like" : "Likes"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageCircle size={18} className="mr-2" />
            {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="space-y-3 pt-3 border-t">
            {/* Existing Comments */}
            {comments.map((comment) => {
              const commentName = comment.profiles?.display_name || comment.profiles?.username || "User";
              const commentInitials = commentName.charAt(0).toUpperCase();
              const commentTime = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });

              const isOwnComment = comment.user_id === currentUserId;
              const isEditing = editingCommentId === comment.id;

              return (
                <div key={comment.id} className="flex gap-2">
                  <ProfilePhoto
                    src={comment.profiles?.avatar_url}
                    alt={commentName}
                    fallback={commentName}
                    size="sm"
                    onClick={() => handleProfileClick(comment.user_id)}
                  />
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editCommentContent}
                          onChange={(e) => setEditCommentContent(e.target.value)}
                          className="min-h-[60px] resize-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEditComment(comment.id)}
                            disabled={!editCommentContent.trim()}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditCommentContent("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="bg-muted rounded-lg p-2 flex justify-between items-start">
                          <div className="flex-1">
                            <p 
                              className="text-sm font-semibold cursor-pointer hover:underline"
                              onClick={() => handleProfileClick(comment.user_id)}
                            >
                              {commentName}
                            </p>
                            <p className="text-sm text-foreground">{comment.content}</p>
                          </div>
                          {isOwnComment && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground"
                                >
                                  <MoreHorizontal size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditComment(comment.id, comment.content)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 ml-2">{commentTime}</p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* New Comment Input */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[40px] h-10 py-2 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleComment();
                  }
                }}
              />
              <Button
                size="icon"
                onClick={handleComment}
                disabled={isSubmitting || !newComment.trim()}
              >
                <Send size={18} />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
