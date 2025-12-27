import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { MatchPlayBottomTabBar } from "@/components/MatchPlayBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { ScoreMoreSheet } from "@/components/play/ScoreMoreSheet";
import {
  calculateHoleResult,
  formatMatchStatusWithHoles,
  isMatchFinished,
  getFinalResult,
} from "@/utils/matchPlayScoring";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface GameWithHoles {
  game: MatchPlayGame;
  holes: MatchPlayHole[];
  groupName: string;
  scores: { player1: number; player2: number; player1Mulligan?: boolean; player2Mulligan?: boolean };
}

export default function MatchPlayPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameWithHoles | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<1 | 2 | null>(null);
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [currentComment, setCurrentComment] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [eventGames, setEventGames] = useState<GameWithHoles[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isEventCreator, setIsEventCreator] = useState(false);
  const [eventName, setEventName] = useState<string>("");
  const [courseName, setCourseName] = useState<string>("");

  useEffect(() => {
    if (gameId) {
      fetchData();
    }
  }, [gameId]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(user.id);

      // Fetch the primary game
      const { data: primaryGame, error: gameError } = await supabase
        .from("match_play_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError || !primaryGame) {
        toast({ title: "Game not found", variant: "destructive" });
        navigate("/rounds-play");
        return;
      }

      setCourseName(primaryGame.course_name);
      setEventName(primaryGame.round_name || 'Match Play');

      // Check if this game is part of an event with multiple groups
      let allGames: MatchPlayGame[] = [primaryGame];
      let groupNamesMap = new Map<string, string>();

      if (primaryGame.event_id) {
        // Check if current user is the event creator
        const { data: eventData } = await supabase
          .from("events")
          .select("creator_id, name")
          .eq("id", primaryGame.event_id)
          .single();

        setIsEventCreator(eventData?.creator_id === user.id);
        if (eventData?.name) setEventName(eventData.name);

        // Fetch all games in this event
        const { data: eventGamesData } = await supabase
          .from("match_play_games")
          .select("*")
          .eq("event_id", primaryGame.event_id)
          .order("created_at");

        if (eventGamesData && eventGamesData.length > 1) {
          allGames = eventGamesData;

          // Fetch group names
          const groupIds = allGames.map(g => g.group_id).filter(Boolean) as string[];
          if (groupIds.length > 0) {
            const { data: groupsData } = await supabase
              .from("game_groups")
              .select("id, group_name")
              .in("id", groupIds);

            if (groupsData) {
              groupNamesMap = new Map(groupsData.map(g => [g.id, g.group_name]));
            }
          }
        }
      }

      // Fetch holes for all games
      const gameIds = allGames.map(g => g.id);
      const { data: allHolesData } = await supabase
        .from("match_play_holes")
        .select("*")
        .in("game_id", gameIds)
        .order("hole_number");

      const holesMap = new Map<string, MatchPlayHole[]>();
      (allHolesData || []).forEach(hole => {
        if (!holesMap.has(hole.game_id)) {
          holesMap.set(hole.game_id, []);
        }
        holesMap.get(hole.game_id)!.push(hole as MatchPlayHole);
      });

      // Build games with holes and scores
      const gamesWithHoles: GameWithHoles[] = allGames.map(game => ({
        game: game as MatchPlayGame,
        holes: holesMap.get(game.id) || [],
        groupName: game.group_id ? groupNamesMap.get(game.group_id) || 'Match' : 'Match',
        scores: { player1: 0, player2: 0, player1Mulligan: false, player2Mulligan: false },
      }));

      setEventGames(gamesWithHoles);

      // Fetch course holes for par/stroke index
      if (primaryGame.course_id) {
        const { data: courseHolesData } = await supabase
          .from("course_holes")
          .select("hole_number, par, stroke_index")
          .eq("course_id", primaryGame.course_id)
          .order("hole_number");

        if (courseHolesData) {
          setCourseHoles(courseHolesData);
        }
      }

      // Find starting hole (first hole where not all games have scores)
      const totalHoles = primaryGame.holes_played || 18;
      let startingHole = 0;
      for (let i = 0; i < totalHoles; i++) {
        const holeNumber = i + 1;
        const allGamesHaveScores = gamesWithHoles.every(gw => 
          gw.holes.some(h => h.hole_number === holeNumber && h.player_1_gross_score !== null)
        );
        if (!allGamesHaveScores) {
          startingHole = i;
          break;
        }
        startingHole = i;
      }
      setCurrentHoleIndex(startingHole);

    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const currentHole = currentHoleIndex + 1;
  const currentCourseHole = courseHoles.find(h => h.hole_number === currentHole);
  const par = currentCourseHole?.par || 4;
  const strokeIndex = currentCourseHole?.stroke_index;
  const totalHoles = eventGames[0]?.game.holes_played || 18;

  const getGameScoresForHole = (gw: GameWithHoles, holeNumber: number) => {
    const hole = gw.holes.find(h => h.hole_number === holeNumber);
    return {
      player1: hole?.player_1_gross_score || 0,
      player2: hole?.player_2_gross_score || 0,
      player1Mulligan: hole?.player_1_mulligan || false,
      player2Mulligan: hole?.player_2_mulligan || false,
    };
  };

  const getCurrentMatchStatus = (gw: GameWithHoles) => {
    if (gw.holes.length === 0) return 0;
    const lastHole = gw.holes.reduce((a, b) => a.hole_number > b.hole_number ? a : b);
    return lastHole.match_status_after;
  };

  const getHolesRemaining = (gw: GameWithHoles) => {
    return totalHoles - gw.holes.length;
  };

  const updateScore = (gameIndex: number, player: 'player1' | 'player2', newScore: number) => {
    if (newScore === 0) return;
    setEventGames(prev => {
      const updated = [...prev];
      updated[gameIndex] = {
        ...updated[gameIndex],
        scores: {
          ...updated[gameIndex].scores,
          [player]: newScore,
        },
      };
      return updated;
    });
  };

  const handleUseMulligan = () => {
    if (!selectedGame || !selectedPlayer) return;
    const gameIndex = eventGames.findIndex(g => g.game.id === selectedGame.game.id);
    if (gameIndex === -1) return;

    const key = selectedPlayer === 1 ? 'player1Mulligan' : 'player2Mulligan';
    setEventGames(prev => {
      const updated = [...prev];
      updated[gameIndex] = {
        ...updated[gameIndex],
        scores: {
          ...updated[gameIndex].scores,
          [key]: true,
        },
      };
      return updated;
    });
  };

  const handleRemoveMulligan = () => {
    if (!selectedGame || !selectedPlayer) return;
    const gameIndex = eventGames.findIndex(g => g.game.id === selectedGame.game.id);
    if (gameIndex === -1) return;

    const key = selectedPlayer === 1 ? 'player1Mulligan' : 'player2Mulligan';
    setEventGames(prev => {
      const updated = [...prev];
      updated[gameIndex] = {
        ...updated[gameIndex],
        scores: {
          ...updated[gameIndex].scores,
          [key]: false,
        },
      };
      return updated;
    });
  };

  const handleOpenMoreSheet = () => {
    setShowScoreSheet(false);
    setShowMoreSheet(true);
  };

  const handleSaveMoreSheet = () => {
    setShowMoreSheet(false);
    setCurrentComment("");
  };

  // Check if all games have scores for current hole
  const allGamesHaveScores = eventGames.every(gw => {
    const s = gw.scores;
    return (s.player1 > 0 || s.player1 === -1) && (s.player2 > 0 || s.player2 === -1);
  });

  // Auto-save when all games have scores
  useEffect(() => {
    if (allGamesHaveScores && !showScoreSheet && !showMoreSheet && !saving && eventGames.length > 0) {
      saveAllHoles();
    }
  }, [allGamesHaveScores, showScoreSheet, showMoreSheet, eventGames]);

  const saveAllHoles = async () => {
    setSaving(true);
    try {
      for (const gw of eventGames) {
        const scores = gw.scores;
        if ((scores.player1 === 0 || scores.player2 === 0) && scores.player1 !== -1 && scores.player2 !== -1) continue;

        const holeResult = calculateHoleResult(scores.player1, scores.player2);
        const previousStatus = getCurrentMatchStatus(gw);
        const newMatchStatus = previousStatus + holeResult;
        const holesRemaining = totalHoles - currentHole;

        // Upsert hole
        const { error: holeError } = await supabase
          .from("match_play_holes")
          .upsert({
            game_id: gw.game.id,
            hole_number: currentHole,
            par,
            stroke_index: strokeIndex || null,
            player_1_gross_score: scores.player1,
            player_1_net_score: scores.player1,
            player_2_gross_score: scores.player2,
            player_2_net_score: scores.player2,
            player_1_mulligan: scores.player1Mulligan || false,
            player_2_mulligan: scores.player2Mulligan || false,
            hole_result: holeResult,
            match_status_after: newMatchStatus,
            holes_remaining_after: holesRemaining,
          }, {
            onConflict: 'game_id,hole_number',
          });

        if (holeError) throw holeError;

        // Update game status
        const matchFinished = isMatchFinished(newMatchStatus, holesRemaining);
        const gameUpdate: Record<string, any> = {
          match_status: newMatchStatus,
          holes_remaining: holesRemaining,
        };

        if (matchFinished || currentHole >= totalHoles) {
          const { winner, result } = getFinalResult(newMatchStatus, holesRemaining, gw.game.player_1, gw.game.player_2);
          gameUpdate.is_finished = true;
          gameUpdate.winner_player = winner;
          gameUpdate.final_result = result;
        }

        await supabase
          .from("match_play_games")
          .update(gameUpdate)
          .eq("id", gw.game.id);
      }

      // Reload data and advance to next hole
      await fetchData();
      if (currentHole < totalHoles) {
        setCurrentHoleIndex(currentHoleIndex + 1);
      }

    } catch (error: any) {
      console.error("Error saving holes:", error);
      toast({ title: "Error saving scores", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const navigateHole = (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      setCurrentHoleIndex(currentHoleIndex - 1);
    } else if (direction === "next" && currentHoleIndex < totalHoles - 1) {
      setCurrentHoleIndex(currentHoleIndex + 1);
    }
  };

  const handleDeleteGame = async () => {
    try {
      // Delete all games in the event if this is the primary game
      for (const gw of eventGames) {
        await supabase.from("match_play_holes").delete().eq("game_id", gw.game.id);
        await supabase.from("match_play_games").delete().eq("id", gw.game.id);
      }
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    }
  };

  // Determine which games the current user can see
  const visibleGames = eventGames.filter(gw => {
    if (isEventCreator) return true; // Admin sees all
    // Check if user is a player in this game (by name match - simplified)
    return gw.game.user_id === currentUserId;
  });

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
        {gameId && <MatchPlayBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (eventGames.length === 0) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <MatchPlayBottomTabBar gameId={gameId} />}
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
              onClick={() => setShowExitDialog(true)}
              className="rounded-full"
            >
              <ChevronLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">{eventName}</h1>
              <p className="text-sm text-muted-foreground">{courseName}</p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        {/* Hole Navigation Bar */}
        <div className="bg-[hsl(120,20%,85%)] py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
            >
              <ChevronLeft size={24} />
            </Button>

            <div className="text-center">
              <div className="text-sm text-[hsl(120,20%,40%)]">PAR {par}</div>
              <div className="text-2xl font-bold text-[hsl(120,20%,25%)]">Hole {currentHole}</div>
              <div className="text-sm text-[hsl(120,20%,40%)]">HCP {strokeIndex || '-'}</div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={currentHoleIndex >= totalHoles - 1}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
            >
              <ChevronRight size={24} />
            </Button>
          </div>
        </div>
      </div>

      {/* Score Entry - All Groups */}
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {visibleGames.map((gw, gameIndex) => {
          const existingScores = getGameScoresForHole(gw, currentHole);
          const currentScores = gw.scores.player1 !== 0 || gw.scores.player2 !== 0 
            ? gw.scores 
            : existingScores;
          const matchStatus = getCurrentMatchStatus(gw);
          const holesRemaining = getHolesRemaining(gw);
          const mulligansPerPlayer = gw.game.mulligans_per_player || 0;
          const player1MulligansUsed = gw.holes.filter(h => h.player_1_mulligan).length;
          const player2MulligansUsed = gw.holes.filter(h => h.player_2_mulligan).length;

          return (
            <div key={gw.game.id} className="space-y-3">
              {/* Group Header - only show if multiple groups */}
              {visibleGames.length > 1 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm">
                    {gw.groupName}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatMatchStatusWithHoles(matchStatus, holesRemaining, gw.game.player_1, gw.game.player_2)}
                  </span>
                </div>
              )}

              {/* Player 1 */}
              <Card 
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setSelectedGame(gw);
                  setSelectedPlayer(1);
                  setShowScoreSheet(true);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-blue-600">{gw.game.player_1}</span>
                      {currentScores.player1Mulligan && (
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                          Mulligan
                        </Badge>
                      )}
                    </div>
                    {gw.game.use_handicaps && gw.game.player_1_handicap && (
                      <span className="text-xs text-muted-foreground">HCP: {gw.game.player_1_handicap}</span>
                    )}
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${currentScores.player1 !== 0 ? '' : 'text-muted-foreground'}`}>
                      {currentScores.player1 === -1 ? '–' : currentScores.player1 || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Strokes</div>
                  </div>
                </div>
              </Card>

              {/* Player 2 */}
              <Card 
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setSelectedGame(gw);
                  setSelectedPlayer(2);
                  setShowScoreSheet(true);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-red-600">{gw.game.player_2}</span>
                      {currentScores.player2Mulligan && (
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                          Mulligan
                        </Badge>
                      )}
                    </div>
                    {gw.game.use_handicaps && gw.game.player_2_handicap && (
                      <span className="text-xs text-muted-foreground">HCP: {gw.game.player_2_handicap}</span>
                    )}
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${currentScores.player2 !== 0 ? '' : 'text-muted-foreground'}`}>
                      {currentScores.player2 === -1 ? '–' : currentScores.player2 || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Strokes</div>
                  </div>
                </div>
              </Card>

              {/* Match Status - only show if single group */}
              {visibleGames.length === 1 && (
                <div className="p-3 bg-primary/10 rounded-lg text-center">
                  <p className="text-lg font-bold text-primary">
                    {formatMatchStatusWithHoles(matchStatus, holesRemaining, gw.game.player_1, gw.game.player_2)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Score Sheet */}
      {selectedGame && (
        <PlayerScoreSheet
          open={showScoreSheet}
          onOpenChange={setShowScoreSheet}
          playerName={selectedPlayer === 1 ? selectedGame.game.player_1 : selectedGame.game.player_2}
          handicap={selectedPlayer === 1 ? selectedGame.game.player_1_handicap : selectedGame.game.player_2_handicap}
          par={par}
          holeNumber={currentHole}
          currentScore={selectedPlayer === 1 ? selectedGame.scores.player1 : selectedGame.scores.player2}
          onScoreSelect={(score) => {
            if (score !== null && selectedPlayer) {
              const gameIndex = eventGames.findIndex(g => g.game.id === selectedGame.game.id);
              if (gameIndex !== -1) {
                updateScore(gameIndex, selectedPlayer === 1 ? 'player1' : 'player2', score);
              }
            }
          }}
          onMore={handleOpenMoreSheet}
          onEnterAndNext={() => {
            // Find next player/game without a score
            const gameIndex = eventGames.findIndex(g => g.game.id === selectedGame.game.id);
            const currentGameScores = eventGames[gameIndex]?.scores;

            if (selectedPlayer === 1 && currentGameScores?.player2 === 0) {
              setSelectedPlayer(2);
            } else if (selectedPlayer === 2 && currentGameScores?.player1 === 0) {
              setSelectedPlayer(1);
            } else if (gameIndex < eventGames.length - 1) {
              // Move to next game
              const nextGame = eventGames[gameIndex + 1];
              setSelectedGame(nextGame);
              if (nextGame.scores.player1 === 0) {
                setSelectedPlayer(1);
              } else if (nextGame.scores.player2 === 0) {
                setSelectedPlayer(2);
              } else {
                setShowScoreSheet(false);
              }
            } else {
              setShowScoreSheet(false);
            }
          }}
        />
      )}

      {/* More Sheet */}
      {selectedGame && selectedPlayer && (
        <ScoreMoreSheet
          open={showMoreSheet}
          onOpenChange={setShowMoreSheet}
          holeNumber={currentHole}
          par={par}
          playerName={selectedPlayer === 1 ? selectedGame.game.player_1 : selectedGame.game.player_2}
          comment={currentComment}
          onCommentChange={setCurrentComment}
          mulligansAllowed={selectedGame.game.mulligans_per_player || 0}
          mulligansUsed={selectedPlayer === 1 
            ? selectedGame.holes.filter(h => h.player_1_mulligan).length 
            : selectedGame.holes.filter(h => h.player_2_mulligan).length}
          mulliganUsedOnThisHole={selectedPlayer === 1 
            ? (selectedGame.scores.player1Mulligan || false) 
            : (selectedGame.scores.player2Mulligan || false)}
          onUseMulligan={handleUseMulligan}
          onRemoveMulligan={handleRemoveMulligan}
          onSave={handleSaveMoreSheet}
        />
      )}

      {gameId && <MatchPlayBottomTabBar gameId={gameId} />}

      {/* Exit Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Game</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with this game?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogAction onClick={() => {
              setShowExitDialog(false);
              navigate("/rounds-play");
            }}>
              Save and Exit
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleDeleteGame}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Game
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
