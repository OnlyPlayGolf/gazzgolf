import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SimpleSkinsBottomTabBar } from "@/components/SimpleSkinsBottomTabBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { ScoreMoreSheet } from "@/components/play/ScoreMoreSheet";
import { RoundCompletionDialog } from "@/components/RoundCompletionDialog";
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

interface Round {
  id: string;
  course_name: string;
  tee_set: string;
  holes_played: number;
  date_played: string;
  round_name?: string | null;
  origin?: string | null;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
  [key: string]: any;
}

interface RoundPlayer {
  id: string;
  user_id: string;
  tee_color: string | null;
  profiles: {
    display_name: string | null;
    username: string | null;
  } | null;
}

interface SkinResult {
  holeNumber: number;
  winnerId: string | null;
  winnerName: string | null;
  skinsWon: number;
  isCarryover: boolean;
}

export default function SimpleSkinsTracker() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [round, setRound] = useState<Round | null>(null);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(() => {
    const saved = localStorage.getItem(`simpleSkinsCurrentHole_${roundId}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [scores, setScores] = useState<Map<string, Map<number, number>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<RoundPlayer[]>([]);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<RoundPlayer | null>(null);
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [skinResults, setSkinResults] = useState<SkinResult[]>([]);
  const [carryoverCount, setCarryoverCount] = useState(1);

  // Mulligan and comment tracking
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  // Map: playerId -> Set of hole numbers where mulligan was used
  const [mulligansUsed, setMulligansUsed] = useState<Map<string, Set<number>>>(new Map());
  // Map: playerId -> Map<holeNumber, comment>
  const [holeComments, setHoleComments] = useState<Map<string, Map<number, string>>>(new Map());
  // Current comment being edited in the More sheet
  const [currentComment, setCurrentComment] = useState("");
  // Track if mulligan was just added in current More sheet session
  const [mulliganJustAdded, setMulliganJustAdded] = useState(false);
  // Track if user manually navigated (to prevent auto-advance)
  const [isManualNavigation, setIsManualNavigation] = useState(false);

  useEffect(() => {
    if (roundId) {
      fetchRoundData();
      loadSettings();
    }
  }, [roundId]);

  // Save current hole index to localStorage
  useEffect(() => {
    if (roundId) {
      localStorage.setItem(`simpleSkinsCurrentHole_${roundId}`, currentHoleIndex.toString());
    }
  }, [currentHoleIndex, roundId]);

  // Calculate skin results whenever scores change
  useEffect(() => {
    calculateSkinResults();
  }, [scores, courseHoles, players]);

  // Auto-advance to next hole when all players have scores
  // Skip if user manually navigated back to review scores
  useEffect(() => {
    if (isManualNavigation) {
      // Don't auto-advance when manually navigating
      return;
    }
    if (!courseHoles.length || !players.length || loading) return;
    
    const currentHoleNum = courseHoles[currentHoleIndex]?.hole_number;
    if (!currentHoleNum) return;
    
    const allPlayersHaveScores = players.every(p => {
      const playerScores = scores.get(p.id);
      const score = playerScores?.get(currentHoleNum);
      return score !== undefined && (score > 0 || score === -1);
    });
    
    // Auto-advance if all players have scores and not at last hole
    if (allPlayersHaveScores && currentHoleIndex < courseHoles.length - 1) {
      // Small delay for visual feedback before advancing
      const timer = setTimeout(() => {
        setCurrentHoleIndex(prev => prev + 1);
        setShowScoreSheet(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scores, currentHoleIndex, courseHoles, players, loading, isManualNavigation]);

  const loadSettings = () => {
    // First try round-specific settings (from localStorage for persistence)
    const roundSettings = localStorage.getItem(`simpleSkinsRoundSettings_${roundId}`);
    if (roundSettings) {
      const settings = JSON.parse(roundSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      return;
    }
    
    // Fallback to session storage for new rounds
    const savedSettings = sessionStorage.getItem('simpleSkinsSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      // Save to round-specific storage for future
      localStorage.setItem(`simpleSkinsRoundSettings_${roundId}`, JSON.stringify({
        mulligansPerPlayer: settings.mulligansPerPlayer || 0,
        skinValue: settings.skinValue || 1,
        carryoverEnabled: settings.carryoverEnabled ?? true,
      }));
    }
  };

  const fetchRoundData = async () => {
    try {
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRound(roundData);

      const { data: playersData, error: playersError } = await supabase
        .from("round_players")
        .select("id, user_id, tee_color")
        .eq("round_id", roundId);

      if (playersError) throw playersError;
      
      if (playersData && playersData.length > 0) {
        const userIds = playersData.map(p => p.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const playersWithProfiles = playersData.map(player => ({
          ...player,
          profiles: profilesMap.get(player.user_id) || null
        }));
        
        setPlayers(playersWithProfiles);
      }

      const { data: courseData } = await supabase
        .from("courses")
        .select("id")
        .eq("name", roundData.course_name)
        .maybeSingle();

      let holesArray: CourseHole[] = [];
      
      if (courseData) {
        const { data: holesData, error: holesError } = await supabase
          .from("course_holes")
          .select("*")
          .eq("course_id", courseData.id)
          .order("hole_number");

        if (!holesError && holesData) {
          let filteredHoles = holesData;
          if (roundData.holes_played === 9) {
            filteredHoles = holesData.slice(0, 9);
          }
          holesArray = filteredHoles;
        }
      }
      
      if (holesArray.length === 0) {
        const defaultPar = [4, 4, 3, 5, 4, 4, 3, 4, 5];
        const numHoles = roundData.holes_played || 18;
        
        holesArray = Array.from({ length: numHoles }, (_, i) => ({
          hole_number: i + 1,
          par: i < 9 ? defaultPar[i] : defaultPar[i % 9],
          stroke_index: i + 1,
        }));
      }
      
      setCourseHoles(holesArray);

      // Fetch existing hole scores and mulligans for all players
      const { data: existingHoles, error: existingError } = await supabase
        .from("holes")
        .select("hole_number, score, player_id, mulligan")
        .eq("round_id", roundId);

      if (!existingError && existingHoles) {
        const scoresMap = new Map<string, Map<number, number>>();
        const mulligansMap = new Map<string, Set<number>>();
        
        existingHoles.forEach((hole) => {
          if (hole.player_id) {
            // Scores
            if (!scoresMap.has(hole.player_id)) {
              scoresMap.set(hole.player_id, new Map());
            }
            scoresMap.get(hole.player_id)!.set(hole.hole_number, hole.score);
            
            // Mulligans
            if (hole.mulligan) {
              if (!mulligansMap.has(hole.player_id)) {
                mulligansMap.set(hole.player_id, new Set());
              }
              mulligansMap.get(hole.player_id)!.add(hole.hole_number);
            }
          }
        });
        setScores(scoresMap);
        setMulligansUsed(mulligansMap);
      }
    } catch (error: any) {
      console.error("Error fetching round data:", error);
      toast({
        title: "Error loading round",
        description: error.message,
        variant: "destructive",
      });
      navigate("/rounds");
    } finally {
      setLoading(false);
    }
  };

  const calculateSkinResults = () => {
    const results: SkinResult[] = [];
    let carryover = 0;
    
    for (const hole of courseHoles) {
      const holeScores: { playerId: string; playerName: string; score: number }[] = [];
      
      for (const player of players) {
        const playerScoreMap = scores.get(player.id);
        const score = playerScoreMap?.get(hole.hole_number);
        if (score && score > 0) {
          holeScores.push({
            playerId: player.id,
            playerName: getPlayerName(player),
            score
          });
        }
      }
      
      // All players must have a score for the hole to count
      if (holeScores.length < players.length || players.length === 0) {
        results.push({
          holeNumber: hole.hole_number,
          winnerId: null,
          winnerName: null,
          skinsWon: 0,
          isCarryover: false
        });
        continue;
      }
      
      // Find lowest score
      const lowestScore = Math.min(...holeScores.map(s => s.score));
      const playersWithLowest = holeScores.filter(s => s.score === lowestScore);
      
      if (playersWithLowest.length === 1) {
        // One player wins the skin(s)
        results.push({
          holeNumber: hole.hole_number,
          winnerId: playersWithLowest[0].playerId,
          winnerName: playersWithLowest[0].playerName,
          skinsWon: 1 + carryover,
          isCarryover: false
        });
        carryover = 0;
      } else {
        // Tie - carry over
        results.push({
          holeNumber: hole.hole_number,
          winnerId: null,
          winnerName: null,
          skinsWon: 0,
          isCarryover: true
        });
        carryover += 1;
      }
    }
    
    setSkinResults(results);
    
    // Calculate carryover for current hole
    const currentHoleNum = currentHoleIndex + 1;
    let currentCarryover = 1;
    for (let i = currentHoleNum - 2; i >= 0; i--) {
      if (results[i]?.isCarryover) {
        currentCarryover++;
      } else {
        break;
      }
    }
    setCarryoverCount(currentCarryover);
  };

  const getPlayerSkinCount = (playerId: string): number => {
    return skinResults
      .filter(r => r.winnerId === playerId)
      .reduce((sum, r) => sum + r.skinsWon, 0);
  };

  const currentHole = courseHoles[currentHoleIndex];

  const getPlayerScore = (playerId: string) => {
    const playerScores = scores.get(playerId) || new Map();
    return playerScores.get(currentHole?.hole_number) || 0;
  };

  const updateScore = async (playerId: string, newScore: number) => {
    // Allow -1 (dash/conceded) and positive scores, reject 0 and other negatives
    if (!currentHole || (newScore < 0 && newScore !== -1)) return;
    
    // Reset manual navigation flag so auto-advance works after score update
    setIsManualNavigation(false);

    const updatedScores = new Map(scores);
    const playerScores = updatedScores.get(playerId) || new Map();
    playerScores.set(currentHole.hole_number, newScore);
    updatedScores.set(playerId, playerScores);
    setScores(updatedScores);

    try {
      const { error } = await supabase
        .from("holes")
        .upsert({
          round_id: roundId,
          player_id: playerId,
          hole_number: currentHole.hole_number,
          par: currentHole.par,
          score: newScore,
        }, {
          onConflict: 'round_id,player_id,hole_number',
          ignoreDuplicates: false
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

  const getPlayerName = (player: RoundPlayer) => {
    return player.profiles?.display_name || player.profiles?.username || "Player";
  };

  const getCurrentHoleSkinResult = (): SkinResult | null => {
    return skinResults.find(r => r.holeNumber === currentHole?.hole_number) || null;
  };

  // Mulligan helpers
  const getPlayerMulligansUsed = (playerId: string): number => {
    return mulligansUsed.get(playerId)?.size || 0;
  };

  const hasPlayerUsedMulliganOnHole = (playerId: string, holeNumber: number): boolean => {
    return mulligansUsed.get(playerId)?.has(holeNumber) || false;
  };

  const useMulliganOnHole = async (playerId: string, holeNumber: number) => {
    setMulligansUsed(prev => {
      const updated = new Map(prev);
      const playerMulligans = new Set(prev.get(playerId) || []);
      playerMulligans.add(holeNumber);
      updated.set(playerId, playerMulligans);
      return updated;
    });

    // Update mulligan in database
    try {
      await supabase
        .from("holes")
        .update({ mulligan: true })
        .eq("round_id", roundId)
        .eq("player_id", playerId)
        .eq("hole_number", holeNumber);

      // Mark that mulligan was just added (will be combined with comment on save)
      setMulliganJustAdded(true);
    } catch (error) {
      console.error("Error saving mulligan:", error);
    }
  };

  const removeMulliganFromHole = async (playerId: string, holeNumber: number) => {
    setMulligansUsed(prev => {
      const updated = new Map(prev);
      const playerMulligans = new Set(prev.get(playerId) || []);
      playerMulligans.delete(holeNumber);
      updated.set(playerId, playerMulligans);
      return updated;
    });

    // Update mulligan in database
    try {
      await supabase
        .from("holes")
        .update({ mulligan: false })
        .eq("round_id", roundId)
        .eq("player_id", playerId)
        .eq("hole_number", holeNumber);
    } catch (error) {
      console.error("Error removing mulligan:", error);
    }
  };

  // Comment helpers
  const getHoleComment = (playerId: string, holeNumber: number): string => {
    return holeComments.get(playerId)?.get(holeNumber) || "";
  };

  const setHoleComment = (playerId: string, holeNumber: number, comment: string) => {
    setHoleComments(prev => {
      const updated = new Map(prev);
      const playerComments = new Map(prev.get(playerId) || []);
      if (comment) {
        playerComments.set(holeNumber, comment);
      } else {
        playerComments.delete(holeNumber);
      }
      updated.set(playerId, playerComments);
      return updated;
    });
  };

  // Handle opening the More sheet
  const handleOpenMoreSheet = () => {
    if (selectedPlayer && currentHole) {
      setCurrentComment(getHoleComment(selectedPlayer.id, currentHole.hole_number));
      setMulliganJustAdded(false); // Reset flag when opening sheet
      setShowMoreSheet(true);
    }
  };

  // Handle saving from More sheet
  const handleSaveMore = async () => {
    if (selectedPlayer && currentHole) {
      const hasComment = currentComment.trim().length > 0;
      const hasMulligan = mulliganJustAdded;
      
      // Only post if there's a comment or mulligan
      if (hasComment || hasMulligan) {
        if (hasComment) {
          setHoleComment(selectedPlayer.id, currentHole.hole_number, currentComment);
        }
        
        // Build combined content
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const playerName = getPlayerName(selectedPlayer);
            let content = "";
            
            if (hasMulligan && hasComment) {
              // Combined mulligan + comment
              content = `🔄 ${playerName} used a mulligan on hole ${currentHole.hole_number}: "${currentComment.trim()}"`;
            } else if (hasMulligan) {
              // Mulligan only
              content = `🔄 ${playerName} used a mulligan on hole ${currentHole.hole_number}`;
            } else {
              // Comment only
              content = currentComment.trim();
            }
            
            await supabase.from("round_comments").insert({
              round_id: roundId,
              user_id: user.id,
              content,
              hole_number: currentHole.hole_number,
              game_type: "simple_skins",
            });
          }
        } catch (error) {
          console.error("Error saving to feed:", error);
        }
      }
      
      // Reset the flag
      setMulliganJustAdded(false);
    }
  };

  const handleShowCompletionDialog = () => {
    setShowCompletionDialog(true);
  };

  const handleFinishRound = () => {
    setShowCompletionDialog(false);
    navigate(`/simple-skins/${roundId}/summary`);
  };

  const handleContinuePlaying = async () => {
    setShowCompletionDialog(false);
    
    const nextHoleNumber = courseHoles.length + 1;
    const defaultPar = [4, 4, 3, 5, 4, 4, 3, 4, 5];
    
    const newHole: CourseHole = {
      hole_number: nextHoleNumber,
      par: defaultPar[(nextHoleNumber - 1) % 9],
      stroke_index: nextHoleNumber,
    };
    
    setCourseHoles([...courseHoles, newHole]);
    setCurrentHoleIndex(courseHoles.length);
    
    try {
      await supabase
        .from("rounds")
        .update({ holes_played: nextHoleNumber })
        .eq("id", roundId);
    } catch (error) {
      console.error("Error updating holes_played:", error);
    }
    
    toast({
      title: "Extra hole added",
      description: `Hole ${nextHoleNumber} added to your round`,
    });
  };

  const handleGoBack = () => {
    setShowCompletionDialog(false);
  };

  const handleDeleteRound = async () => {
    try {
      const { error: holesError } = await supabase
        .from("holes")
        .delete()
        .eq("round_id", roundId);

      if (holesError) throw holesError;

      const { error: playersError } = await supabase
        .from("round_players")
        .delete()
        .eq("round_id", roundId);

      if (playersError) throw playersError;

      const { error: roundError } = await supabase
        .from("rounds")
        .delete()
        .eq("id", roundId);

      if (roundError) throw roundError;

      toast({
        title: "Round deleted",
        description: "The round has been deleted successfully.",
      });

      navigate("/");
    } catch (error: any) {
      console.error("Error deleting round:", error);
      toast({
        title: "Error deleting round",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading round...</div>
        {roundId && <SimpleSkinsBottomTabBar roundId={roundId} />}
      </div>
    );
  }

  if (!round || !currentHole) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Round not found</div>
        {roundId && <SimpleSkinsBottomTabBar roundId={roundId} />}
      </div>
    );
  }

  const isAtLastHole = currentHoleIndex === courseHoles.length - 1;
  const currentSkinResult = getCurrentHoleSkinResult();
  const allPlayersHaveScores = players.every(p => {
    const playerScores = scores.get(p.id);
    const score = playerScores?.get(currentHole.hole_number);
    return score !== undefined && (score > 0 || score === -1);
  });

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
              <h1 className="text-xl font-bold">{round.round_name || 'Simple Skins'}</h1>
              <p className="text-sm text-muted-foreground">{round.course_name}</p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        {/* Hole Navigation Bar */}
        <div className="bg-amber-100 dark:bg-amber-950/30 py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
              className="text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900"
            >
              <ChevronLeft size={24} />
            </Button>

            <div className="text-center">
              <div className="text-sm text-amber-700 dark:text-amber-300">PAR {currentHole.par}</div>
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">Hole {currentHole.hole_number}</div>
              <div className="text-sm text-amber-700 dark:text-amber-300">HCP {currentHole.stroke_index}</div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={currentHoleIndex === courseHoles.length - 1}
              className="text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900"
            >
              <ChevronRight size={24} />
            </Button>
          </div>
        </div>
      </div>

      {/* Skins Info Banner */}
      <div className="max-w-2xl mx-auto px-4 mt-4">
        <Card className="p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800 dark:text-amber-200">
                {carryoverCount} Skin{carryoverCount > 1 ? 's' : ''} on this hole
              </span>
            </div>
            {allPlayersHaveScores && currentSkinResult && (
              <Badge variant={currentSkinResult.winnerId ? "default" : "secondary"} className="text-xs">
                {currentSkinResult.winnerId ? `${currentSkinResult.winnerName} wins!` : "Tied - Carryover"}
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
        {players.map((player) => {
          const playerScore = getPlayerScore(player.id);
          const skinCount = getPlayerSkinCount(player.id);
          const hasScore = playerScore > 0 || playerScore === -1;
          const hasMulliganOnHole = hasPlayerUsedMulliganOnHole(player.id, currentHole?.hole_number || 0);
          
          return (
            <Card 
              key={player.id} 
              className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                setSelectedPlayer(player);
                setShowScoreSheet(true);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{getPlayerName(player)}</span>
                    {hasMulliganOnHole && (
                      <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                        Mulligan
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>Tee: {player.tee_color || round.tee_set}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <Trophy size={14} />
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
            onClick={handleShowCompletionDialog}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            size="lg"
          >
            <Check size={20} className="mr-2" />
            Complete Round
          </Button>
        )}
      </div>

      {/* Round Completion Dialog */}
      <RoundCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        holesPlayed={courseHoles.length}
        plannedHoles={round.holes_played}
        onFinishRound={handleFinishRound}
        onContinuePlaying={handleContinuePlaying}
        onGoBack={handleGoBack}
      />

      {/* Score Input Sheet */}
      {selectedPlayer && currentHole && (
        <>
          <PlayerScoreSheet
            open={showScoreSheet}
            onOpenChange={setShowScoreSheet}
            playerName={getPlayerName(selectedPlayer)}
            par={currentHole.par}
            holeNumber={currentHole.hole_number}
            currentScore={getPlayerScore(selectedPlayer.id)}
            onScoreSelect={(score) => {
              if (score !== null) {
                updateScore(selectedPlayer.id, score);
              }
            }}
            onMore={handleOpenMoreSheet}
            onEnterAndNext={() => {
              const currentHoleNum = currentHole.hole_number;
              
              // Find next player without a score for this hole
              const nextPlayerWithoutScore = players.find(p => {
                if (p.id === selectedPlayer.id) return false;
                const playerScores = scores.get(p.id);
                const score = playerScores?.get(currentHoleNum);
                return !score || score === 0;
              });
              
              if (nextPlayerWithoutScore) {
                // Move to next player without a score
                setSelectedPlayer(nextPlayerWithoutScore);
              } else {
                // All players have scores - close the sheet
                setShowScoreSheet(false);
                // Show completion dialog if at last hole
                if (currentHoleIndex >= courseHoles.length - 1) {
                  setShowCompletionDialog(true);
                }
              }
            }}
          />
          
          <ScoreMoreSheet
            open={showMoreSheet}
            onOpenChange={setShowMoreSheet}
            holeNumber={currentHole.hole_number}
            par={currentHole.par}
            playerName={getPlayerName(selectedPlayer)}
            comment={currentComment}
            onCommentChange={setCurrentComment}
            mulligansAllowed={mulligansPerPlayer}
            mulligansUsed={getPlayerMulligansUsed(selectedPlayer.id)}
            mulliganUsedOnThisHole={hasPlayerUsedMulliganOnHole(selectedPlayer.id, currentHole.hole_number)}
            onUseMulligan={() => useMulliganOnHole(selectedPlayer.id, currentHole.hole_number)}
            onRemoveMulligan={() => removeMulliganFromHole(selectedPlayer.id, currentHole.hole_number)}
            onSave={handleSaveMore}
          />
        </>
      )}

      <SimpleSkinsBottomTabBar roundId={roundId!} />

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Round</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with this round?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => {
                setShowExitDialog(false);
                navigate("/");
              }}
              className="w-full"
            >
              Save and Exit
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setShowExitDialog(false);
                handleDeleteRound();
              }}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Round
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
