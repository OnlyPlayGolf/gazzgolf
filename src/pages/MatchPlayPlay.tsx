import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useGameScoring, GameScoringConfig, CourseHoleData } from "@/hooks/useGameScoring";
import { useToast } from "@/hooks/use-toast";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { MatchPlayBottomTabBar } from "@/components/MatchPlayBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { ScoreMoreSheet } from "@/components/play/ScoreMoreSheet";
import { InRoundStatsEntry } from "@/components/play/InRoundStatsEntry";
import { StatsMode } from "@/components/play/StatsModeSelector";
import { PlayerStatsModeDialog } from "@/components/play/PlayerStatsModeDialog";
import { usePlayerStatsMode } from "@/hooks/usePlayerStatsMode";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import {
  calculateHoleResult,
  formatMatchStatusWithHoles,
  isMatchFinished,
  getFinalResult,
} from "@/utils/matchPlayScoring";
interface MatchPlayScores {
  player1: number;
  player2: number;
  player1Mulligan?: boolean;
  player2Mulligan?: boolean;
}

// Configuration for Match Play format
const createMatchPlayConfig = (gameId: string): GameScoringConfig<MatchPlayGame, MatchPlayHole, MatchPlayScores> => ({
  gameId,
  gameTable: "match_play_games",
  holesTable: "match_play_holes",
  
  parseGame: (data): MatchPlayGame => data as MatchPlayGame,
  parseHole: (data): MatchPlayHole => data as MatchPlayHole,
  getHoleNumber: (hole) => hole.hole_number,
  getTotalHoles: (game) => game.holes_played || 18,
  getCourseId: (game) => game.course_id || null,
  getSummaryRoute: (id) => `/match-play/${id}/summary`,
  
  createEmptyScores: () => ({ player1: 0, player2: 0, player1Mulligan: false, player2Mulligan: false }),
  
  extractScoresFromHole: (hole) => ({
    player1: hole.player_1_gross_score || 0,
    player2: hole.player_2_gross_score || 0,
    player1Mulligan: hole.player_1_mulligan || false,
    player2Mulligan: hole.player_2_mulligan || false,
  }),
  
  buildHoleData: ({ gameId, holeNumber, par, strokeIndex, scores, previousHoles, game }) => {
    const holeResult = calculateHoleResult(scores.player1, scores.player2);
    const previousStatus = previousHoles.length > 0 
      ? previousHoles[previousHoles.length - 1].match_status_after 
      : 0;
    const newMatchStatus = previousStatus + holeResult;
    const totalHoles = game.holes_played || 18;
    
    return {
      game_id: gameId,
      hole_number: holeNumber,
      par,
      stroke_index: strokeIndex,
      player_1_gross_score: scores.player1,
      player_1_net_score: scores.player1,
      player_2_gross_score: scores.player2,
      player_2_net_score: scores.player2,
      player_1_mulligan: scores.player1Mulligan || false,
      player_2_mulligan: scores.player2Mulligan || false,
      hole_result: holeResult,
      match_status_after: newMatchStatus,
      holes_remaining_after: totalHoles - holeNumber,
    };
  },
  
  buildGameUpdate: ({ game, allHoles, newHoleData }) => {
    const totalHoles = game.holes_played || 18;
    const holesRemaining = totalHoles - newHoleData.hole_number;
    const matchFinished = isMatchFinished(newHoleData.match_status_after, holesRemaining);
    
    const update: Record<string, any> = {
      match_status: newHoleData.match_status_after,
      holes_remaining: holesRemaining,
    };
    
    if (matchFinished) {
      const { winner, result } = getFinalResult(
        newHoleData.match_status_after, 
        holesRemaining, 
        game.player_1, 
        game.player_2
      );
      update.is_finished = true;
      update.winner_player = winner;
      update.final_result = result;
    }
    
    return update;
  },
  
  isGameFinished: (game, holeNumber, totalHoles, holeData) => {
    // Only finish when all holes are complete, not when match is decided early
    // Match status will still be calculated and displayed, but popup only shows when scorecard is complete
    return holeNumber >= totalHoles;
  },
  
  areAllHolesComplete: (game, allHoles, totalHoles) => {
    // Check that we have holes for all hole numbers 1 through totalHoles
    if (allHoles.length < totalHoles) return false;
    
    // Verify we have a hole for each number from 1 to totalHoles
    for (let i = 1; i <= totalHoles; i++) {
      const hole = allHoles.find(h => h.hole_number === i);
      if (!hole) return false;
      
      const player1Score = hole.player_1_gross_score;
      const player2Score = hole.player_2_gross_score;
      // Score must be > 0 (0 means not entered, -1 is dash/conceded which is valid)
      const player1Complete = (player1Score !== undefined && player1Score !== null && (player1Score > 0 || player1Score === -1));
      const player2Complete = (player2Score !== undefined && player2Score !== null && (player2Score > 0 || player2Score === -1));
      
      if (!player1Complete || !player2Complete) return false;
    }
    
    return true;
  },
});

export default function MatchPlayPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Check spectator status - redirect if not a participant or edit window expired
  const { isSpectator, isLoading: spectatorLoading, isEditWindowExpired } = useIsSpectator('match_play', gameId);
  
  useEffect(() => {
    if (!spectatorLoading && isSpectator && gameId) {
      navigate(`/match-play/${gameId}/leaderboard`, { replace: true });
    }
  }, [isSpectator, spectatorLoading, gameId, navigate]);
  
  const [selectedPlayer, setSelectedPlayer] = useState<1 | 2 | null>(null);
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [currentComment, setCurrentComment] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [statsSaved, setStatsSaved] = useState(false);
  const [showStatsModeDialog, setShowStatsModeDialog] = useState(false);
  
  const config = createMatchPlayConfig(gameId || "");
  const [state, actions] = useGameScoring(config, navigate);
  
  // Per-player stats mode
  const { 
    statsMode: playerStatsMode, 
    loading: statsModeLoading, 
    saving: statsModeSaving,
    setStatsMode: setPlayerStatsMode 
  } = usePlayerStatsMode(gameId, 'match_play');
  
  const { game, holes, courseHoles, currentHoleIndex, loading, saving, scores, par, strokeIndex } = state;
  const { setScores, saveHole, navigateHole, deleteGame } = actions;
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;
  
  // Get hole distance from course data based on tee set
  const currentCourseHole = courseHoles.find(h => h.hole_number === currentHole);
  const getHoleDistance = (): number | undefined => {
    if (!currentCourseHole) return undefined;
    const tee = game?.tee_set?.toLowerCase() || 'white';
    const distanceKey = `${tee}_distance` as keyof typeof currentCourseHole;
    const distance = currentCourseHole[distanceKey];
    return typeof distance === 'number' ? distance : undefined;
  };
  const holeDistance = getHoleDistance();
  
  // Get current user ID for stats entry
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
  }, [gameId]);
  
  // Reset stats saved when hole changes
  useEffect(() => {
    setStatsSaved(false);
  }, [currentHoleIndex]);

  // Calculate mulligans used by each player
  const mulligansPerPlayer = game?.mulligans_per_player || 0;
  const player1MulligansUsed = holes.filter(h => h.player_1_mulligan).length + (scores.player1Mulligan ? 1 : 0);
  const player2MulligansUsed = holes.filter(h => h.player_2_mulligan).length + (scores.player2Mulligan ? 1 : 0);

  const updateScore = (player: 'player1' | 'player2', newScore: number) => {
    if (newScore === 0) return; // 0 is not valid, but -1 (dash) and positive are valid
    setScores(prev => ({ ...prev, [player]: newScore }));
  };

  const handleUseMulligan = () => {
    if (selectedPlayer === 1) {
      setScores(prev => ({ ...prev, player1Mulligan: true }));
    } else if (selectedPlayer === 2) {
      setScores(prev => ({ ...prev, player2Mulligan: true }));
    }
  };

  const handleRemoveMulligan = () => {
    if (selectedPlayer === 1) {
      setScores(prev => ({ ...prev, player1Mulligan: false }));
    } else if (selectedPlayer === 2) {
      setScores(prev => ({ ...prev, player2Mulligan: false }));
    }
  };

  const handleOpenMoreSheet = () => {
    setShowScoreSheet(false);
    setShowMoreSheet(true);
  };

  // Check if both players have entered scores for current hole
  // -1 means dash/conceded, which is also a valid entry
  const allPlayersEnteredCurrentHole = (scores.player1 > 0 || scores.player1 === -1) && (scores.player2 > 0 || scores.player2 === -1);
  
  // Determine if stats need to be saved before advancing (using per-player stats mode)
  const needsStats = playerStatsMode !== 'none' && currentUserId;
  const canAutoAdvance = allPlayersEnteredCurrentHole && !showScoreSheet && !showMoreSheet && !saving;

  // Auto-save and advance to next hole when all players have entered scores
  // If stats mode is enabled, wait for stats to be saved first
  useEffect(() => {
    if (canAutoAdvance) {
      if (needsStats && !statsSaved) {
        // Wait for stats to be saved
        return;
      }
      saveHole();
    }
  }, [canAutoAdvance, needsStats, statsSaved]);
  
  const handleStatsSaved = () => {
    setStatsSaved(true);
  };

  const handleSaveMoreSheet = async () => {
    // Save comment to feed if provided
    if (currentComment.trim() && gameId && selectedPlayer) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const playerName = selectedPlayer === 1 ? game?.player_1 : game?.player_2;
          const mulliganUsed = selectedPlayer === 1 ? scores.player1Mulligan : scores.player2Mulligan;
          
          let content = currentComment.trim();
          if (mulliganUsed) {
            content = `🔄 ${playerName} used a mulligan on hole ${currentHole}: "${content}"`;
          }
          
          await supabase.from("round_comments").insert({
            round_id: gameId,
            user_id: user.id,
            content,
            hole_number: currentHole,
            game_type: "match_play",
            game_id: gameId,
          });
        }
      } catch (error) {
        console.error("Error saving comment:", error);
      }
    } else if (selectedPlayer) {
      // Save mulligan-only comment if no text but mulligan was used
      const mulliganUsed = selectedPlayer === 1 ? scores.player1Mulligan : scores.player2Mulligan;
      if (mulliganUsed && gameId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const playerName = selectedPlayer === 1 ? game?.player_1 : game?.player_2;
            await supabase.from("round_comments").insert({
              round_id: gameId,
              user_id: user.id,
              content: `🔄 ${playerName} used a mulligan on hole ${currentHole}`,
              hole_number: currentHole,
              game_type: "match_play",
              game_id: gameId,
            });
          }
        } catch (error) {
          console.error("Error saving mulligan comment:", error);
        }
      }
    }
    
    setShowMoreSheet(false);
    setCurrentComment("");
  };

  const handleDeleteGame = async () => {
    await deleteGame();
  };

  if (loading || spectatorLoading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
        {gameId && !spectatorLoading && <MatchPlayBottomTabBar gameId={gameId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && !spectatorLoading && <MatchPlayBottomTabBar gameId={gameId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
      </div>
    );
  }

  const currentMatchStatus = holes.length > 0 
    ? holes[holes.length - 1].match_status_after 
    : 0;
  const currentHolesRemaining = totalHoles - holes.length;

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/rounds-play")}
              className="rounded-full"
            >
              <ChevronLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">{game.round_name || 'Match Play'}</h1>
              <p className="text-sm text-muted-foreground">{game.course_name}</p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        {/* Hole Navigation Bar */}
        <div className="bg-primary py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
              className="text-primary-foreground hover:bg-primary/80 disabled:text-primary-foreground/50"
            >
              <ChevronLeft size={24} />
            </Button>

            <div className="text-center">
              <div className="text-sm text-primary-foreground/90">PAR {par}</div>
              <div className="text-2xl font-bold text-primary-foreground">Hole {currentHole}</div>
              <div className="text-sm text-primary-foreground/90">HCP {strokeIndex || '-'}</div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={currentHole > holes.length || currentHole >= totalHoles}
              className="text-primary-foreground hover:bg-primary/80 disabled:text-primary-foreground/50"
            >
              <ChevronRight size={24} />
            </Button>
          </div>
        </div>
      </div>

      {/* Score Entry */}
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Player 1 */}
        <Card 
          className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            setSelectedPlayer(1);
            setShowScoreSheet(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-blue-600 truncate">{game.player_1}</span>
                {scores.player1Mulligan && (
                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 flex-shrink-0">
                    Mulligan
                  </Badge>
                )}
              </div>
              {false && (
                <span className="text-sm text-muted-foreground">HCP: {game.player_1_handicap}</span>
              )}
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${scores.player1 !== 0 ? '' : 'text-muted-foreground'}`}>
                {scores.player1 === -1 ? '–' : scores.player1}
              </div>
              <div className="text-xs text-muted-foreground">Strokes</div>
            </div>
          </div>
        </Card>

        {/* Player 2 */}
        <Card 
          className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            setSelectedPlayer(2);
            setShowScoreSheet(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-red-600 truncate">{game.player_2}</span>
                {scores.player2Mulligan && (
                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 flex-shrink-0">
                    Mulligan
                  </Badge>
                )}
              </div>
              {false && (
                <span className="text-sm text-muted-foreground">HCP: {game.player_2_handicap}</span>
              )}
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${scores.player2 !== 0 ? '' : 'text-muted-foreground'}`}>
                {scores.player2 === -1 ? '–' : scores.player2}
              </div>
              <div className="text-xs text-muted-foreground">Strokes</div>
            </div>
          </div>
        </Card>

        {/* In-Round Stats Entry - only shown when score is entered and player has enabled stats */}
        {allPlayersEnteredCurrentHole && playerStatsMode !== 'none' && currentUserId && (
          <InRoundStatsEntry
            statsMode={playerStatsMode}
            roundId={gameId || ''}
            holeNumber={currentHole}
            par={par}
            score={scores.player1 > 0 ? scores.player1 : scores.player2}
            playerId={currentUserId}
            isCurrentUser={true}
            onStatsSaved={handleStatsSaved}
            courseName={game.course_name}
            holesPlayed={game.holes_played}
            holeDistance={holeDistance}
          />
        )}
        
        {/* Stats Mode Selection Dialog */}
        <PlayerStatsModeDialog
          open={showStatsModeDialog}
          onOpenChange={setShowStatsModeDialog}
          onSelect={setPlayerStatsMode}
          currentMode={playerStatsMode}
          saving={statsModeSaving}
        />

        {/* Score Sheet */}
        <PlayerScoreSheet
          open={showScoreSheet}
          onOpenChange={setShowScoreSheet}
          playerName={selectedPlayer === 1 ? game.player_1 : game.player_2}
          handicap={selectedPlayer === 1 ? game.player_1_handicap : game.player_2_handicap}
          par={par}
          holeNumber={currentHole}
          currentScore={selectedPlayer === 1 ? scores.player1 : scores.player2}
          onScoreSelect={(score) => {
            if (score !== null && selectedPlayer) {
              updateScore(selectedPlayer === 1 ? 'player1' : 'player2', score);
            }
          }}
          onMore={handleOpenMoreSheet}
          onEnterAndNext={() => {
            // Find next player without a score (0 means no entry, -1 is dash which counts as entered)
            if (selectedPlayer === 1 && scores.player2 === 0) {
              setSelectedPlayer(2);
            } else if (selectedPlayer === 2 && scores.player1 === 0) {
              setSelectedPlayer(1);
            } else {
              // Both players have scores - close sheet
              setShowScoreSheet(false);
            }
          }}
        />

        {/* More Sheet for Mulligans and Comments */}
        {selectedPlayer && (
          <ScoreMoreSheet
            open={showMoreSheet}
            onOpenChange={setShowMoreSheet}
            holeNumber={currentHole}
            par={par}
            playerName={selectedPlayer === 1 ? game.player_1 : game.player_2}
            comment={currentComment}
            onCommentChange={setCurrentComment}
            mulligansAllowed={mulligansPerPlayer}
            mulligansUsed={selectedPlayer === 1 ? player1MulligansUsed : player2MulligansUsed}
            mulliganUsedOnThisHole={selectedPlayer === 1 ? (scores.player1Mulligan || false) : (scores.player2Mulligan || false)}
            onUseMulligan={handleUseMulligan}
            onRemoveMulligan={handleRemoveMulligan}
            onSave={handleSaveMoreSheet}
          />
        )}

        {/* Match Status - Hide when tied/all square */}
        {currentMatchStatus !== 0 && (
        <div className={`p-3 rounded-lg text-center ${
          currentMatchStatus > 0 
            ? "bg-blue-100 dark:bg-blue-900/30" 
            : "bg-red-100 dark:bg-red-900/30"
        }`}>
          <p className={`text-lg font-bold ${
            currentMatchStatus > 0 
              ? "text-blue-600 dark:text-blue-400" 
              : "text-red-600 dark:text-red-400"
          }`}>
            {formatMatchStatusWithHoles(currentMatchStatus, currentHolesRemaining, game.player_1, game.player_2)}
          </p>
        </div>
        )}

      </div>

      {gameId && !spectatorLoading && <MatchPlayBottomTabBar gameId={gameId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
    </div>
  );
}
