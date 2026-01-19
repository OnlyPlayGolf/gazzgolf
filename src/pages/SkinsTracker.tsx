import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { SkinsCompletionModal } from "@/components/SkinsCompletionModal";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { useGameAdminStatus } from "@/hooks/useGameAdminStatus";
import { GameHeader } from "@/components/GameHeader";
import { usePlayerStatsMode } from "@/hooks/usePlayerStatsMode";
import { PlayerStatsModeDialog } from "@/components/play/PlayerStatsModeDialog";
import { InRoundStatsEntry } from "@/components/play/InRoundStatsEntry";

interface SkinsGame {
  id: string;
  course_name: string;
  holes_played: number;
  date_played: string;
  round_name?: string | null;
  skin_value: number;
  carryover_enabled: boolean;
  players: PlayerData[];
  is_finished: boolean;
}

interface PlayerData {
  odId: string;
  displayName: string;
  handicap: number;
  teeColor: string;
  isTemporary?: boolean;
  skinsWon?: number;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
  white_distance?: number | null;
  yellow_distance?: number | null;
  blue_distance?: number | null;
  red_distance?: number | null;
  black_distance?: number | null;
  gold_distance?: number | null;
  orange_distance?: number | null;
  silver_distance?: number | null;
}

interface SkinsHoleData {
  hole_number: number;
  par: number;
  player_scores: Record<string, number>;
  winner_player: string | null;
  skins_available: number;
  is_carryover: boolean;
}

export default function SkinsTracker() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { isSpectator, isLoading: spectatorLoading } = useIsSpectator('skins', roundId);
  const { isAdmin, isLoading: adminLoading } = useGameAdminStatus('skins', roundId);
  
  useEffect(() => {
    if (!spectatorLoading && isSpectator && roundId) {
      navigate(`/skins/${roundId}/leaderboard`, { replace: true });
    }
  }, [isSpectator, spectatorLoading, roundId, navigate]);
  
  const [game, setGame] = useState<SkinsGame | null>(null);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(() => {
    const saved = localStorage.getItem(`skinsCurrentHole_${roundId}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [holeData, setHoleData] = useState<Map<number, SkinsHoleData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerData | null>(null);
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const [carryoverCount, setCarryoverCount] = useState(1);
  const [isManualNavigation, setIsManualNavigation] = useState(false);
  const [showStatsModeDialog, setShowStatsModeDialog] = useState(false);
  
  // Per-player stats mode
  const { statsMode, loading: statsModeLoading, saving: statsModeSaving, setStatsMode } = usePlayerStatsMode(roundId, 'skins');

  useEffect(() => {
    if (roundId) {
      fetchGameData();
    }
  }, [roundId]);

  // Refetch data when page comes back into focus (e.g., returning from GameSettingsDetail)
  useEffect(() => {
    const handleFocus = () => {
      if (roundId) {
        fetchGameData();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [roundId]);

  useEffect(() => {
    if (roundId) {
      localStorage.setItem(`skinsCurrentHole_${roundId}`, currentHoleIndex.toString());
    }
  }, [currentHoleIndex, roundId]);

  useEffect(() => {
    calculateCarryover();
  }, [holeData, currentHoleIndex, courseHoles]);

  // Auto-advance logic
  useEffect(() => {
    if (isManualNavigation || !courseHoles.length || !game || loading) return;
    
    const currentHole = courseHoles[currentHoleIndex];
    if (!currentHole) return;
    
    const currentHoleData = holeData.get(currentHole.hole_number);
    const allPlayersHaveScores = game.players.every(p => {
      const score = currentHoleData?.player_scores?.[p.odId];
      return score !== undefined && (score > 0 || score === -1);
    });
    
    if (allPlayersHaveScores && currentHoleIndex < courseHoles.length - 1) {
      const timer = setTimeout(() => {
        setCurrentHoleIndex(prev => prev + 1);
        setShowScoreSheet(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [holeData, currentHoleIndex, courseHoles, game, loading, isManualNavigation]);

  const fetchGameData = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("skins_games")
        .select("*")
        .eq("id", roundId)
        .single();

      if (gameError) throw gameError;
      
      // Parse players from JSON
      const players = Array.isArray(gameData.players) 
        ? (gameData.players as unknown as PlayerData[])
        : [];
      setGame({ ...gameData, players });

      // Fetch course holes
      const { data: courseData } = await supabase
        .from("courses")
        .select("id")
        .eq("name", gameData.course_name)
        .maybeSingle();

      let holesArray: CourseHole[] = [];
      
      if (courseData) {
        const { data: holesData } = await supabase
          .from("course_holes")
          .select("hole_number, par, stroke_index, white_distance, yellow_distance, blue_distance, red_distance, black_distance, gold_distance, orange_distance, silver_distance")
          .eq("course_id", courseData.id)
          .order("hole_number");

        if (holesData) {
          let filteredHoles = holesData;
          if (gameData.holes_played === 9) {
            filteredHoles = holesData.slice(0, 9);
          }
          holesArray = filteredHoles;
        }
      }
      
      if (holesArray.length === 0) {
        const defaultPar = [4, 4, 3, 5, 4, 4, 3, 4, 5];
        const numHoles = gameData.holes_played || 18;
        
        holesArray = Array.from({ length: numHoles }, (_, i) => ({
          hole_number: i + 1,
          par: i < 9 ? defaultPar[i] : defaultPar[i % 9],
          stroke_index: i + 1,
        }));
      }
      
      setCourseHoles(holesArray);

      // Fetch existing skins_holes data
      const { data: existingHoles } = await supabase
        .from("skins_holes")
        .select("*")
        .eq("game_id", roundId);

      if (existingHoles) {
        const holesMap = new Map<number, SkinsHoleData>();
        existingHoles.forEach((hole) => {
          holesMap.set(hole.hole_number, {
            hole_number: hole.hole_number,
            par: hole.par,
            player_scores: (hole.player_scores as Record<string, number>) || {},
            winner_player: hole.winner_player,
            skins_available: hole.skins_available,
            is_carryover: hole.is_carryover,
          });
        });
        setHoleData(holesMap);
      }
    } catch (error: any) {
      console.error("Error fetching game data:", error);
      toast({
        title: "Error loading game",
        description: error.message,
        variant: "destructive",
      });
      navigate("/rounds");
    } finally {
      setLoading(false);
    }
  };

  const calculateCarryover = () => {
    if (!courseHoles.length) return;
    
    const currentHoleNum = courseHoles[currentHoleIndex]?.hole_number;
    if (!currentHoleNum) return;
    
    let carryover = 1;
    for (let i = currentHoleNum - 2; i >= 0; i--) {
      const hole = holeData.get(i + 1);
      if (hole?.is_carryover) {
        carryover++;
      } else if (hole?.winner_player) {
        break;
      }
    }
    setCarryoverCount(carryover);
  };

  const calculateSkinResult = (holeNumber: number, scores: Record<string, number>): { winnerId: string | null; isCarryover: boolean } => {
    if (!game) return { winnerId: null, isCarryover: false };
    
    const validScores = Object.entries(scores).filter(([_, score]) => score > 0);
    
    // All players must have a score
    if (validScores.length < game.players.length) {
      return { winnerId: null, isCarryover: false };
    }
    
    const lowestScore = Math.min(...validScores.map(([_, s]) => s));
    const playersWithLowest = validScores.filter(([_, s]) => s === lowestScore);
    
    if (playersWithLowest.length === 1) {
      return { winnerId: playersWithLowest[0][0], isCarryover: false };
    }
    
    return { winnerId: null, isCarryover: true };
  };

  const getPlayerSkinCount = (playerId: string): number => {
    let count = 0;
    holeData.forEach((hole) => {
      if (hole.winner_player === playerId) {
        count += hole.skins_available;
      }
    });
    return count;
  };

  const currentHole = courseHoles[currentHoleIndex];
  
  // Get hole distance from course data (Skins uses per-player tees, default to white)
  const getHoleDistance = (): number | undefined => {
    if (!currentHole) return undefined;
    const distanceKey = 'white_distance' as keyof typeof currentHole;
    const distance = currentHole[distanceKey];
    return typeof distance === 'number' ? distance : undefined;
  };
  const holeDistance = getHoleDistance();

  const getPlayerScore = (playerId: string): number => {
    if (!currentHole) return 0;
    const hole = holeData.get(currentHole.hole_number);
    return hole?.player_scores?.[playerId] || 0;
  };

  const updateScore = async (playerId: string, newScore: number) => {
    if (!currentHole || !game || (newScore < 0 && newScore !== -1)) return;
    
    setIsManualNavigation(false);

    const existingHole = holeData.get(currentHole.hole_number);
    const updatedScores = {
      ...(existingHole?.player_scores || {}),
      [playerId]: newScore,
    };

    // Calculate skin result
    const { winnerId, isCarryover } = calculateSkinResult(currentHole.hole_number, updatedScores);
    
    // Calculate skins available (including carryovers)
    let skinsAvailable = 1;
    for (let i = currentHole.hole_number - 2; i >= 0; i--) {
      const prevHole = holeData.get(i + 1);
      if (prevHole?.is_carryover) {
        skinsAvailable++;
      } else {
        break;
      }
    }

    const updatedHoleData: SkinsHoleData = {
      hole_number: currentHole.hole_number,
      par: currentHole.par,
      player_scores: updatedScores,
      winner_player: winnerId,
      skins_available: skinsAvailable,
      is_carryover: isCarryover,
    };

    // Update local state
    setHoleData(prev => {
      const updated = new Map(prev);
      updated.set(currentHole.hole_number, updatedHoleData);
      return updated;
    });

    try {
      const { error } = await supabase
        .from("skins_holes")
        .upsert({
          game_id: roundId,
          hole_number: currentHole.hole_number,
          par: currentHole.par,
          player_scores: updatedScores,
          winner_player: winnerId,
          skins_available: skinsAvailable,
          is_carryover: isCarryover,
          stroke_index: currentHole.stroke_index,
        }, {
          onConflict: 'game_id,hole_number',
        });

      if (error) throw error;
    } catch (error: any) {
      console.error("Error saving score:", error);
      toast({
        title: "Error saving score",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const navigateHole = (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      setIsManualNavigation(true);
      setCurrentHoleIndex(currentHoleIndex - 1);
    } else if (direction === "next" && currentHoleIndex < courseHoles.length - 1) {
      setCurrentHoleIndex(currentHoleIndex + 1);
    }
  };

  const getCurrentHoleResult = () => {
    if (!currentHole) return null;
    return holeData.get(currentHole.hole_number);
  };

  const handleFinishRound = () => {
    // Show completion modal immediately - don't update database yet
    // The modal will handle marking the game as finished when user clicks Done/Post/Share
    setShowCompletionDialog(true);
  };


  const handleDeleteGame = async () => {
    try {
      await supabase.from("skins_holes").delete().eq("game_id", roundId);
      await supabase.from("skins_games").delete().eq("id", roundId);

      toast({ title: "Game deleted" });
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting game:", error);
      toast({
        title: "Error deleting game",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
        {roundId && <SkinsBottomTabBar roundId={roundId} />}
      </div>
    );
  }

  if (!game || !currentHole) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {roundId && <SkinsBottomTabBar roundId={roundId} />}
      </div>
    );
  }

  const isAtLastHole = currentHoleIndex === courseHoles.length - 1;
  const currentHoleResult = getCurrentHoleResult();
  const allPlayersHaveScores = game.players.every(p => {
    const score = currentHoleResult?.player_scores?.[p.odId];
    return score !== undefined && (score > 0 || score === -1);
  });

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <GameHeader
        gameTitle={game.round_name || 'Skins'}
        courseName={game.course_name}
        pageTitle="Skins"
      />

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
            <div className="text-sm text-primary-foreground/90">PAR {currentHole.par}</div>
            <div className="text-2xl font-bold text-primary-foreground">Hole {currentHole.hole_number}</div>
            <div className="text-sm text-primary-foreground/90">HCP {currentHole.stroke_index}</div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateHole("next")}
            disabled={currentHoleIndex === courseHoles.length - 1}
            className="text-primary-foreground hover:bg-primary/80 disabled:text-primary-foreground/50"
          >
            <ChevronRight size={24} />
          </Button>
        </div>
      </div>

      {/* Skins Info Banner */}
      <div className="max-w-2xl mx-auto px-4 mt-4">
        <Card className="p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-amber-800 dark:text-amber-200">
                {carryoverCount} Skin{carryoverCount > 1 ? 's' : ''} on this hole
              </span>
            </div>
            {allPlayersHaveScores && currentHoleResult && (
              <Badge variant={currentHoleResult.winner_player ? "default" : "secondary"} className="text-xs">
                {currentHoleResult.winner_player 
                  ? `${game.players.find(p => p.odId === currentHoleResult.winner_player)?.displayName} wins!` 
                  : "Tied - Carryover"}
              </Badge>
            )}
          </div>
          {carryoverCount > 1 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Includes {carryoverCount - 1} carryover{carryoverCount > 2 ? 's' : ''} from previous tie{carryoverCount > 2 ? 's' : ''}
            </p>
          )}
        </Card>
      </div>

      {/* Score Entry */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {game.players.map((player) => {
          const playerScore = getPlayerScore(player.odId);
          const skinCount = getPlayerSkinCount(player.odId);
          const hasScore = playerScore > 0 || playerScore === -1;
          
          return (
            <Card 
              key={player.odId} 
              className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                setSelectedPlayer(player);
                setShowScoreSheet(true);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-bold">{player.displayName}</span>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>Tee: {player.teeColor}</span>
                    <span>•</span>
                    <span className="text-amber-600">
                      {skinCount} skin{skinCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${hasScore ? '' : 'text-muted-foreground'}`}>
                    {playerScore === -1 ? '–' : hasScore ? playerScore : '0'}
                  </div>
                  <div className="text-xs text-muted-foreground">Strokes</div>
                </div>
              </div>
            </Card>
          );
        })}
        
        {/* Complete Round Button */}
        {isAtLastHole && (
          <Button
            onClick={handleFinishRound}
            className="w-full bg-primary hover:bg-primary/90 text-white"
            size="lg"
          >
            <Check size={20} className="mr-2" />
            Complete Game
          </Button>
        )}
      </div>

      {/* Round Completion Modal */}
      {game && (
        <SkinsCompletionModal
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
          game={{
            id: game.id,
            course_name: game.course_name,
            date_played: game.date_played,
            holes_played: game.holes_played,
            round_name: game.round_name || null,
            user_id: game.players[0]?.odId || '',
            is_finished: game.is_finished,
            skin_value: game.skin_value,
            carryover_enabled: game.carryover_enabled,
            use_handicaps: false,
            players: game.players,
          }}
          holes={Array.from(holeData.values()).map((h, index) => ({
            id: `${roundId}-${h.hole_number}-${index}`,
            game_id: roundId || '',
            hole_number: h.hole_number,
            par: h.par,
            player_scores: h.player_scores,
            winner_player: h.winner_player,
            skins_available: h.skins_available,
            is_carryover: h.is_carryover,
          }))}
          players={game.players.map(p => ({
            id: p.odId,
            odId: p.odId,
            name: p.displayName || 'Player',
            displayName: p.displayName,
            handicap: p.handicap,
            tee: p.teeColor,
            avatarUrl: undefined,
          }))}
          courseHoles={courseHoles}
        />
      )}

      {/* Score Input Sheet */}
      {selectedPlayer && currentHole && (
        <PlayerScoreSheet
          open={showScoreSheet}
          onOpenChange={setShowScoreSheet}
          playerName={selectedPlayer.displayName}
          par={currentHole.par}
          holeNumber={currentHole.hole_number}
          currentScore={getPlayerScore(selectedPlayer.odId)}
          onScoreSelect={(score) => {
            if (score !== null) {
              updateScore(selectedPlayer.odId, score);
            }
          }}
          onEnterAndNext={() => {
            // Find next player without a score
            const nextPlayer = game.players.find(p => {
              if (p.odId === selectedPlayer.odId) return false;
              const score = currentHoleResult?.player_scores?.[p.odId];
              return !score || score === 0;
            });
            
            if (nextPlayer) {
              setSelectedPlayer(nextPlayer);
            } else {
              setShowScoreSheet(false);
              // Don't auto-show completion dialog - user must click "FINISH ROUND" button
            }
          }}
        />
      )}

      {/* Stats Mode Dialog */}
      <PlayerStatsModeDialog
        open={showStatsModeDialog}
        onOpenChange={setShowStatsModeDialog}
        onSelect={setStatsMode}
        saving={statsModeSaving}
      />

      {/* Per-player stats entry */}
      {currentHole && selectedPlayer && (
        <InRoundStatsEntry
          statsMode={statsMode}
          roundId={roundId}
          holeNumber={currentHole.hole_number}
          par={currentHole.par}
          score={getPlayerScore(selectedPlayer.odId)}
          holeDistance={holeDistance}
          playerId={selectedPlayer.odId}
          isCurrentUser={true}
        />
      )}

      <SkinsBottomTabBar roundId={roundId!} />
    </div>
  );
}
