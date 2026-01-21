import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGameScoring, GameScoringConfig } from "@/hooks/useGameScoring";
import { CopenhagenGame, CopenhagenHole } from "@/types/copenhagen";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { calculateCopenhagenPoints, normalizePoints } from "@/utils/copenhagenScoring";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { ScoreMoreSheet } from "@/components/play/ScoreMoreSheet";
import { supabase } from "@/integrations/supabase/client";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { usePlayerStatsMode } from "@/hooks/usePlayerStatsMode";
import { PlayerStatsModeDialog } from "@/components/play/PlayerStatsModeDialog";
import { InRoundStatsEntry } from "@/components/play/InRoundStatsEntry";

interface CopenhagenScores {
  player1: number;
  player2: number;
  player3: number;
}

const createCopenhagenConfig = (gameId: string): GameScoringConfig<CopenhagenGame, CopenhagenHole, CopenhagenScores> => ({
  gameId,
  gameTable: "copenhagen_games",
  holesTable: "copenhagen_holes",
  
  parseGame: (data): CopenhagenGame => ({
    ...data,
  }),
  parseHole: (data): CopenhagenHole => ({
    ...data,
  }),
  getHoleNumber: (hole) => hole.hole_number,
  getTotalHoles: (game) => game.holes_played || 18,
  getCourseId: (game) => game.course_id || null,
  getSummaryRoute: (id) => `/copenhagen/${id}/summary`,
  
  createEmptyScores: () => ({ player1: 0, player2: 0, player3: 0 }),
  
  extractScoresFromHole: (hole) => ({
    player1: hole.player_1_gross_score || 0,
    player2: hole.player_2_gross_score || 0,
    player3: hole.player_3_gross_score || 0,
  }),
  
  buildHoleData: ({ gameId, holeNumber, par, strokeIndex, scores, previousHoles, game }) => {
    const playerScores = [
      { grossScore: scores.player1, netScore: scores.player1, playerIndex: 1 },
      { grossScore: scores.player2, netScore: scores.player2, playerIndex: 2 },
      { grossScore: scores.player3, netScore: scores.player3, playerIndex: 3 },
    ];

    const result = calculateCopenhagenPoints(playerScores, par);

    const prevP1 = previousHoles.reduce((sum, h) => sum + h.player_1_hole_points, 0);
    const prevP2 = previousHoles.reduce((sum, h) => sum + h.player_2_hole_points, 0);
    const prevP3 = previousHoles.reduce((sum, h) => sum + h.player_3_hole_points, 0);

    return {
      game_id: gameId,
      hole_number: holeNumber,
      par,
      stroke_index: strokeIndex,
      player_1_gross_score: scores.player1,
      player_2_gross_score: scores.player2,
      player_3_gross_score: scores.player3,
      player_1_net_score: scores.player1,
      player_2_net_score: scores.player2,
      player_3_net_score: scores.player3,
      player_1_hole_points: result.player1Points,
      player_2_hole_points: result.player2Points,
      player_3_hole_points: result.player3Points,
      player_1_running_total: prevP1 + result.player1Points,
      player_2_running_total: prevP2 + result.player2Points,
      player_3_running_total: prevP3 + result.player3Points,
      is_sweep: result.isSweep,
      sweep_winner: result.sweepWinner,
    };
  },
  
  buildGameUpdate: ({ allHoles }) => {
    const totalP1 = allHoles.reduce((sum, h) => sum + h.player_1_hole_points, 0);
    const totalP2 = allHoles.reduce((sum, h) => sum + h.player_2_hole_points, 0);
    const totalP3 = allHoles.reduce((sum, h) => sum + h.player_3_hole_points, 0);

    return {
      player_1_total_points: totalP1,
      player_2_total_points: totalP2,
      player_3_total_points: totalP3,
    };
  },
  
  // Don't auto-navigate to summary - stay on play page
  isGameFinished: () => false,
});

export default function CopenhagenPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  
  // Check spectator status - redirect if not a participant or edit window expired
  const { isSpectator, isLoading: spectatorLoading, isEditWindowExpired } = useIsSpectator('copenhagen', gameId);
  
  useEffect(() => {
    if (!spectatorLoading && isSpectator && gameId) {
      navigate(`/copenhagen/${gameId}/leaderboard`, { replace: true });
    }
  }, [isSpectator, spectatorLoading, gameId, navigate]);
  
  const [activePlayerSheet, setActivePlayerSheet] = useState<1 | 2 | 3 | null>(null);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [pendingAutoAdvance, setPendingAutoAdvance] = useState(false);
  const [showStatsModeDialog, setShowStatsModeDialog] = useState(false);
  
  // Mulligan and comment tracking
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  const [mulligansUsed, setMulligansUsed] = useState<Map<number, Set<number>>>(new Map()); // playerNum -> Set of hole numbers
  const [currentComment, setCurrentComment] = useState("");
  const [mulliganJustAdded, setMulliganJustAdded] = useState(false);
  
  // Per-player stats mode
  const { statsMode, loading: statsModeLoading, saving: statsModeSaving, setStatsMode } = usePlayerStatsMode(gameId, 'copenhagen');
  
  const config = createCopenhagenConfig(gameId || "");
  const [state, actions] = useGameScoring(config, navigate);
  
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


  // Load mulligan settings on mount
  useEffect(() => {
    if (gameId) {
      loadSettings();
    }
  }, [gameId]);

  const loadSettings = () => {
    // First try game-specific settings
    const gameSettings = localStorage.getItem(`copenhagenSettings_${gameId}`);
    if (gameSettings) {
      const settings = JSON.parse(gameSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      return;
    }
    
    // Fallback to session storage for new games
    const savedSettings = sessionStorage.getItem('copenhagenSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      // Save to game-specific storage for future
      localStorage.setItem(`copenhagenSettings_${gameId}`, JSON.stringify({
        mulligansPerPlayer: settings.mulligansPerPlayer || 0,
      }));
    }
  };

  // Mulligan helpers
  const getPlayerMulligansUsed = (playerNum: number): number => {
    return mulligansUsed.get(playerNum)?.size || 0;
  };

  const hasPlayerUsedMulliganOnHole = (playerNum: number, holeNumber: number): boolean => {
    return mulligansUsed.get(playerNum)?.has(holeNumber) || false;
  };

  const useMulliganOnHole = (playerNum: number, holeNumber: number) => {
    setMulligansUsed(prev => {
      const updated = new Map(prev);
      const playerMulligans = new Set(prev.get(playerNum) || []);
      playerMulligans.add(holeNumber);
      updated.set(playerNum, playerMulligans);
      return updated;
    });
    setMulliganJustAdded(true);
  };

  const removeMulliganFromHole = (playerNum: number, holeNumber: number) => {
    setMulligansUsed(prev => {
      const updated = new Map(prev);
      const playerMulligans = new Set(prev.get(playerNum) || []);
      playerMulligans.delete(holeNumber);
      updated.set(playerNum, playerMulligans);
      return updated;
    });
  };

  // Handle opening the More sheet
  const handleOpenMoreSheet = () => {
    if (activePlayerSheet) {
      setCurrentComment("");
      setMulliganJustAdded(false);
      setShowMoreSheet(true);
    }
  };

  // Handle saving from More sheet
  const handleSaveMore = async () => {
    if (activePlayerSheet && game) {
      const hasComment = currentComment.trim().length > 0;
      const hasMulligan = mulliganJustAdded;
      
      if (hasComment || hasMulligan) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const playerName = activePlayerSheet === 1 ? game.player_1 : activePlayerSheet === 2 ? game.player_2 : game.player_3;
            let content = "";
            
            if (hasMulligan && hasComment) {
              content = `🔄 ${playerName} used a mulligan on hole ${currentHole}: "${currentComment.trim()}"`;
            } else if (hasMulligan) {
              content = `🔄 ${playerName} used a mulligan on hole ${currentHole}`;
            } else {
              content = currentComment.trim();
            }
            
            await supabase.from("round_comments").insert({
              round_id: gameId,
              user_id: user.id,
              content,
              hole_number: currentHole,
              game_type: "copenhagen",
              game_id: gameId,
            });
          }
        } catch (error) {
          console.error("Error saving to feed:", error);
        }
      }
      
      setMulliganJustAdded(false);
    }
  };

  // Helper to check if a score has been entered (positive score or dash/-1)
  const hasValidScore = (score: number) => score > 0 || score === -1;

  const updateScore = (player: 'player1' | 'player2' | 'player3', score: number | null) => {
    const nextScores: CopenhagenScores = {
      ...scores,
      [player]: score ?? (scores as any)[player],
    } as CopenhagenScores;

    setScores(nextScores);

    // If this score completes the hole (including dash), auto-save + advance.
    if (
      activePlayerSheet !== null &&
      hasValidScore(nextScores.player1) &&
      hasValidScore(nextScores.player2) &&
      hasValidScore(nextScores.player3)
    ) {
      setPendingAutoAdvance(true);
    }
  };

  // Advance between players; actual hole-advance happens when all scores are valid.
  const handleEnterAndNext = () => {
    // Find the next player who doesn't have a valid score yet
    const currentScores = {
      1: activePlayerSheet === 1 ? true : hasValidScore(scores.player1), // Current player just entered
      2: activePlayerSheet === 2 ? true : hasValidScore(scores.player2),
      3: activePlayerSheet === 3 ? true : hasValidScore(scores.player3),
    };
    
    // Check players in order starting from the next one
    const playerOrder = activePlayerSheet === 1 ? [2, 3, 1] : activePlayerSheet === 2 ? [3, 1, 2] : [1, 2, 3];
    
    for (const playerNum of playerOrder) {
      if (!currentScores[playerNum as 1 | 2 | 3]) {
        setActivePlayerSheet(playerNum as 1 | 2 | 3);
        return;
      }
    }
    
    // All players have scores, close the sheet
    setActivePlayerSheet(null);
  };

  // After state is updated with the last entered score, save and let useGameScoring advance holes.
  useEffect(() => {
    if (!pendingAutoAdvance) return;
    if (saving) return;

    if (!hasValidScore(scores.player1) || !hasValidScore(scores.player2) || !hasValidScore(scores.player3)) {
      return;
    }

    setPendingAutoAdvance(false);
    setActivePlayerSheet(null);
    void saveHole();
  }, [pendingAutoAdvance, saving, scores.player1, scores.player2, scores.player3, saveHole]);

  if (loading || spectatorLoading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
        {gameId && !spectatorLoading && <CopenhagenBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && !spectatorLoading && <CopenhagenBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
      </div>
    );
  }

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
              <h1 className="text-xl font-bold">{game.round_name || 'Copenhagen'}</h1>
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
              <div className="text-sm text-primary-foreground/90">HCP {strokeIndex || 1}</div>
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
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Player Cards */}
        {[
          { num: 1 as const, name: game.player_1, handicap: game.player_1_handicap, score: scores.player1 },
          { num: 2 as const, name: game.player_2, handicap: game.player_2_handicap, score: scores.player2 },
          { num: 3 as const, name: game.player_3, handicap: game.player_3_handicap, score: scores.player3 },
        ].map(player => (
          <Card 
            key={player.num}
            className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setActivePlayerSheet(player.num)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold">{player.name}</div>
                {game.use_handicaps && player.handicap !== null && (
                  <div className="text-sm text-muted-foreground">HCP: {player.handicap}</div>
                )}
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${player.score > 0 ? '' : 'text-muted-foreground'}`}>
                  {player.score === -1 ? '–' : player.score > 0 ? player.score : 0}
                </div>
                <div className="text-xs text-muted-foreground">Strokes</div>
              </div>
            </div>
          </Card>
        ))}

        {/* Score Sheets */}
        {[1, 2, 3].map(num => (
          <PlayerScoreSheet
            key={num}
            open={activePlayerSheet === num}
            onOpenChange={(open) => { if (!open) setActivePlayerSheet(null); }}
            playerName={num === 1 ? game.player_1 : num === 2 ? game.player_2 : game.player_3}
            handicap={num === 1 ? game.player_1_handicap : num === 2 ? game.player_2_handicap : game.player_3_handicap}
            par={par}
            holeNumber={currentHole}
            currentScore={num === 1 ? scores.player1 : num === 2 ? scores.player2 : scores.player3}
            onScoreSelect={(score) => updateScore(`player${num}` as any, score)}
            onMore={handleOpenMoreSheet}
            onEnterAndNext={handleEnterAndNext}
          />
        ))}

        {/* More Sheet for Mulligans/Comments */}
        {activePlayerSheet && (
          <ScoreMoreSheet
            open={showMoreSheet}
            onOpenChange={setShowMoreSheet}
            holeNumber={currentHole}
            par={par}
            playerName={activePlayerSheet === 1 ? game.player_1 : activePlayerSheet === 2 ? game.player_2 : game.player_3}
            comment={currentComment}
            onCommentChange={setCurrentComment}
            mulligansAllowed={mulligansPerPlayer}
            mulligansUsed={getPlayerMulligansUsed(activePlayerSheet)}
            mulliganUsedOnThisHole={hasPlayerUsedMulliganOnHole(activePlayerSheet, currentHole)}
            onUseMulligan={() => useMulliganOnHole(activePlayerSheet, currentHole)}
            onRemoveMulligan={() => removeMulliganFromHole(activePlayerSheet, currentHole)}
            onSave={handleSaveMore}
          />
        )}

        {/* Points Display */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Points</h3>
          {(() => {
            const normalized = normalizePoints(
              game.player_1_total_points,
              game.player_2_total_points,
              game.player_3_total_points
            );
            return (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-sm text-muted-foreground truncate">{game.player_1}</div>
                  <div className="text-xl font-bold">{normalized.player1}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground truncate">{game.player_2}</div>
                  <div className="text-xl font-bold">{normalized.player2}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground truncate">{game.player_3}</div>
                  <div className="text-xl font-bold">{normalized.player3}</div>
                </div>
              </div>
            );
          })()}
        </Card>
      </div>

      {gameId && !spectatorLoading && <CopenhagenBottomTabBar gameId={gameId} isSpectator={isSpectator} />}

      {/* Stats Mode Dialog */}
      <PlayerStatsModeDialog
        open={showStatsModeDialog}
        onOpenChange={setShowStatsModeDialog}
        onSelect={setStatsMode}
        currentMode={statsMode}
        saving={statsModeSaving}
      />

      {/* Per-player stats entry */}
      <InRoundStatsEntry
        statsMode={statsMode}
        roundId={gameId}
        holeNumber={currentHole}
        par={par}
        score={scores.player1}
        holeDistance={holeDistance}
        playerId="player1"
        isCurrentUser={true}
      />
    </div>
  );
}
