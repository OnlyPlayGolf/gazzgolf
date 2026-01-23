import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { ScoreMoreSheet } from "@/components/play/ScoreMoreSheet";
import { canEditGroupScores } from "@/types/gameGroups";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { StatsMode } from "@/pages/StrokePlaySetup";
import { InRoundStatsEntry } from "@/components/play/InRoundStatsEntry";

interface Round {
  id: string;
  course_name: string;
  tee_set: string;
  holes_played: number;
  date_played: string;
  event_id?: string | null;
  round_name?: string | null;
  origin?: string | null;
  user_id: string;
  stats_mode?: string | null;
}

// Track original planned holes vs actual holes played
interface RoundState {
  plannedHoles: number;
  currentTotalHoles: number;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
  [key: string]: any;
}

interface HoleScore {
  hole_number: number;
  score: number;
  par: number;
  stroke_index: number;
}

interface GameGroup {
  id: string;
  group_name: string;
  group_index: number;
  tee_time?: string | null;
}

interface RoundPlayer {
  id: string;
  user_id: string;
  tee_color: string | null;
  group_id: string | null;
  profiles: {
    display_name: string | null;
    username: string | null;
  } | null;
  isGuest?: boolean;
}

export default function RoundTracker() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Check spectator status - redirect if not a participant or edit window expired
  const { isSpectator, isLoading: spectatorLoading, isEditWindowExpired } = useIsSpectator('round', roundId);
  
  useEffect(() => {
    if (!spectatorLoading && isSpectator && roundId) {
      navigate(`/rounds/${roundId}/leaderboard`, { replace: true });
    }
  }, [isSpectator, spectatorLoading, roundId, navigate]);
  
  const [round, setRound] = useState<Round | null>(null);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [scores, setScores] = useState<Map<string, Map<number, number>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<RoundPlayer[]>([]);
  const [groups, setGroups] = useState<GameGroup[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserGroupId, setCurrentUserGroupId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<RoundPlayer | null>(null);
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [roundState, setRoundState] = useState<RoundState>({ plannedHoles: 18, currentTotalHoles: 18 });

  // Mulligan and comment tracking
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  // Map: playerId -> Set of hole numbers where mulligan was used
  const [mulligansUsed, setMulligansUsed] = useState<Map<string, Set<number>>>(new Map());
  // Map: playerId -> Map<holeNumber, comment>
  const [holeComments, setHoleComments] = useState<Map<string, Map<number, string>>>(new Map());
  // Current comment being edited in the More sheet
  const [currentComment, setCurrentComment] = useState("");
  // Track if mulligan was just added in current More sheet session (to combine with comment)
  const [mulliganJustAdded, setMulliganJustAdded] = useState(false);
  // Track if user manually navigated (to prevent auto-advance)
  const [isManualNavigation, setIsManualNavigation] = useState(false);
  // Track which holes have had stats saved (for stats mode auto-advance blocking)
  const [holeStatsSaved, setHoleStatsSaved] = useState<Set<number>>(new Set());

  // Check if current user can edit a player's scores
  const canEditPlayer = (player: RoundPlayer): boolean => {
    if (!round) return false;
    return canEditGroupScores(currentUserId, round.user_id, player.group_id, currentUserGroupId);
  };

  useEffect(() => {
    if (roundId) {
      fetchRoundData();
      loadSettings();
    }
  }, [roundId]);

  // Refetch data when page comes back into focus (e.g., returning from GameSettingsDetail)
  useEffect(() => {
    const handleFocus = () => {
      if (roundId) {
        fetchRoundData();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [roundId]);

  // Set up realtime subscriptions for players and groups changes
  useEffect(() => {
    if (!roundId) return;

    let mounted = true;

    const channel = supabase
      .channel(`round-participants-${roundId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_players',
          filter: `round_id=eq.${roundId}`,
        },
        () => {
          // Refetch round data when players change
          if (mounted) {
            fetchRoundData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_groups',
          filter: `round_id=eq.${roundId}`,
        },
        () => {
          // Refetch round data when groups change
          if (mounted) {
            fetchRoundData();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  const loadSettings = () => {
    // First try round-specific settings (from localStorage for persistence)
    const roundSettings = localStorage.getItem(`roundSettings_${roundId}`);
    if (roundSettings) {
      const settings = JSON.parse(roundSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      return;
    }
    
    // Fallback to session storage for new rounds
    const savedSettings = sessionStorage.getItem('strokePlaySettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      // Save to round-specific storage for future
      localStorage.setItem(`roundSettings_${roundId}`, JSON.stringify({
        mulligansPerPlayer: settings.mulligansPerPlayer || 0,
      }));
    }
  };

  const fetchRoundData = async () => {
    try {
      // Fetch round details
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRound(roundData);

      // Fetch all players for this round (including guests via is_guest flag)
      const { data: playersData, error: playersError } = await supabase
        .from("round_players")
        .select("id, user_id, tee_color, group_id, handicap, is_guest, guest_name")
        .eq("round_id", roundId);

      if (playersError) throw playersError;

      let allPlayers: RoundPlayer[] = [];
      
      // Separate registered users and guests
      const registeredPlayerData = playersData?.filter(p => !p.is_guest && p.user_id) || [];
      const guestPlayerData = playersData?.filter(p => p.is_guest) || [];

      if (registeredPlayerData.length > 0) {
        const userIds = registeredPlayerData.map(p => p.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const playersWithProfiles = registeredPlayerData.map(player => ({
          ...player,
          profiles: profilesMap.get(player.user_id!) || null,
          isGuest: false,
        }));
        
        allPlayers = playersWithProfiles;
      }

      // Add guest players from database
      guestPlayerData.forEach(g => {
        allPlayers.push({
          id: g.id,
          user_id: g.id, // Use the round_player id as user_id for consistency
          tee_color: g.tee_color,
          group_id: g.group_id,
          profiles: {
            display_name: g.guest_name,
            username: null,
          },
          isGuest: true,
        });
      });

      // Fetch game groups for this round
      const { data: groupsData } = await supabase
        .from("game_groups")
        .select("id, group_name, group_index, tee_time")
        .eq("round_id", roundId)
        .order("group_index");

      const gameGroups: GameGroup[] = groupsData || [];
      setGroups(gameGroups);

      setPlayers(allPlayers);

      // Determine current user's group
      const { data: { user: currentAuthUser } } = await supabase.auth.getUser();
      if (currentAuthUser) {
        setCurrentUserId(currentAuthUser.id);
        const currentPlayerEntry = allPlayers.find(p => p.user_id === currentAuthUser.id);
        if (currentPlayerEntry?.group_id) {
          setCurrentUserGroupId(currentPlayerEntry.group_id);
        }
      }

      // Fetch course holes if course exists in database
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
          // Filter holes based on holes_played and starting_hole
          let filteredHoles = holesData;
          if (roundData.holes_played === 9) {
            const startingHole = roundData.starting_hole || 1;
            if (startingHole === 10) {
              // Back 9: filter holes 10-18
              filteredHoles = holesData.filter(h => h.hole_number >= 10);
            } else {
              // Front 9: filter holes 1-9
              filteredHoles = holesData.filter(h => h.hole_number <= 9);
            }
          }
          
          holesArray = filteredHoles;
        }
      }
      
      // If no course data found, create default holes
      if (holesArray.length === 0) {
        const defaultPar = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 5, 3, 4, 4]; // Default 18-hole pars
        const numHoles = roundData.holes_played || 18;
        const startingHole = roundData.starting_hole || 1;
        
        holesArray = Array.from({ length: numHoles }, (_, i) => {
          const holeNumber = startingHole + i;
          return {
            hole_number: holeNumber,
            par: defaultPar[(holeNumber - 1) % 18] || 4,
            stroke_index: i + 1,
          };
        });
      }
      
      // Track planned holes from round data
      const plannedHoles = roundData.holes_played || 18;
      setRoundState({ 
        plannedHoles, 
        currentTotalHoles: holesArray.length 
      });
      
      setCourseHoles(holesArray);

      // Fetch existing hole scores and mulligans for all players
      const { data: existingHoles, error: existingError } = await supabase
        .from("holes")
        .select("hole_number, score, player_id, mulligan")
        .eq("round_id", roundId);

      const scoresMap = new Map<string, Map<number, number>>();
      const mulligansMap = new Map<string, Set<number>>();

      if (!existingError && existingHoles) {
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
      }


      setScores(scoresMap);
      setMulligansUsed(mulligansMap);
      
      // Load existing stats for this round to mark which holes have stats saved
      if (roundData.stats_mode && roundData.stats_mode !== 'none') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: proRound } = await supabase
            .from('pro_stats_rounds')
            .select('id')
            .eq('external_round_id', roundId)
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (proRound) {
            const { data: existingHoles } = await supabase
              .from('pro_stats_holes')
              .select('hole_number')
              .eq('pro_round_id', proRound.id);
            
            if (existingHoles) {
              const savedHoles = new Set(existingHoles.map(h => h.hole_number));
              setHoleStatsSaved(savedHoles);
            }
          }
        }
      }
      
      // Find the first hole where not all players have entered scores
      if (allPlayers.length > 0) {
        const playerIds = allPlayers.map(p => p.id);
        let startingHoleIndex = 0;
        
        for (let i = 0; i < holesArray.length; i++) {
          const holeNumber = holesArray[i].hole_number;
          const allPlayersScored = playerIds.every(playerId => {
            const playerScores = scoresMap.get(playerId);
            return playerScores && playerScores.has(holeNumber);
          });
          
          if (!allPlayersScored) {
            startingHoleIndex = i;
            break;
          }
          // If all holes are scored, stay at the last hole
          startingHoleIndex = i;
        }
        
        setCurrentHoleIndex(startingHoleIndex);
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

  const currentHole = courseHoles[currentHoleIndex];

  const getPlayerScore = (playerId: string): number | null => {
    const playerScores = scores.get(playerId) || new Map();
    const score = playerScores.get(currentHole?.hole_number);
    return score !== undefined ? score : null;
  };

  const hasPlayerEnteredScore = (playerId: string): boolean => {
    const playerScores = scores.get(playerId) || new Map();
    return playerScores.has(currentHole?.hole_number);
  };

  const updateScore = async (playerId: string, newScore: number) => {
    // Allow -1 (dash/conceded) and positive scores, reject 0 and other negatives
    if (!currentHole || (newScore < 0 && newScore !== -1)) return;
    
    // Prevent editing if 12-hour window has expired after round was finished
    if (isEditWindowExpired) {
      toast({
        title: "Editing locked",
        description: "Scores cannot be edited 24 hours after the round was started.",
        variant: "destructive",
      });
      return;
    }
    
    // Reset manual navigation flag so auto-advance works after score update
    setIsManualNavigation(false);

    const updatedScores = new Map(scores);
    const playerScores = updatedScores.get(playerId) || new Map();
    playerScores.set(currentHole.hole_number, newScore);
    updatedScores.set(playerId, playerScores);
    setScores(updatedScores);

    // Save to database for all players (guests now have real round_player IDs)
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

      if (error) {
        console.error("Upsert error:", error);
        throw error;
      }
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

  const hasPlayerConcededAnyHole = (playerId: string): boolean => {
    const playerScores = scores.get(playerId) || new Map();
    for (const score of playerScores.values()) {
      if (score === -1) return true;
    }
    return false;
  };

  const calculateScoreToPar = (playerId: string) => {
    let totalScore = 0;
    let totalPar = 0;
    const playerScores = scores.get(playerId) || new Map();
    
    courseHoles.forEach((hole) => {
      const score = playerScores.get(hole.hole_number) || 0;
      if (score > 0) {
        totalScore += score;
        totalPar += hole.par;
      }
    });

    return totalScore - totalPar;
  };

  const getScoreDisplay = (playerId: string) => {
    // If player has any conceded hole (dash), show "-"
    if (hasPlayerConcededAnyHole(playerId)) return "-";
    
    const diff = calculateScoreToPar(playerId);
    if (diff === 0) return "E";
    if (diff > 0) return `+${diff}`;
    return diff.toString();
  };

  const getPlayerName = (player: RoundPlayer) => {
    return player.profiles?.display_name || player.profiles?.username || "Player";
  };

  // Get hole distance based on tee set
  const getHoleDistance = (hole: CourseHole, teeSet: string): number | undefined => {
    const teeKey = teeSet?.toLowerCase() || 'white';
    const distanceKey = `${teeKey}_distance`;
    return hole[distanceKey] || hole.white_distance || undefined;
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
              game_type: "round",
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

  // Check if we've reached the end of planned holes
  const isAtLastPlannedHole = currentHoleIndex === roundState.plannedHoles - 1;
  const isAtLastCurrentHole = currentHoleIndex === courseHoles.length - 1;
  
  // Check if all holes have scores for all players
  const allHolesScored = courseHoles.length > 0 && players.length > 0 && players.every(player => {
    const playerScores = scores.get(player.id);
    if (!playerScores) return false;
    return courseHoles.every(hole => {
      const score = playerScores.get(hole.hole_number);
      return score !== undefined && score > 0;
    });
  });

  // Check if all players in the current user's group have entered scores for the current hole
  // -1 is a valid entry (dash/conceded)
  const allPlayersEnteredCurrentHole = (() => {
    if (!currentHole || players.length === 0) return false;
    
    // Determine which players to check based on group membership
    let playersToCheck = players;
    if (groups.length > 0 && currentUserGroupId) {
      // All players in a multi-group game: only check players in their group
      playersToCheck = players.filter(p => p.group_id === currentUserGroupId);
    }
    
    return playersToCheck.every(player => {
      const playerScores = scores.get(player.id);
      const score = playerScores?.get(currentHole.hole_number);
      return score !== undefined && (score > 0 || score === -1);
    });
  })();

  // Auto-advance to next hole when all players have entered scores for current hole
  // Skip if user manually navigated back to review scores
  // Skip if stats mode is enabled and stats haven't been saved for this hole
  useEffect(() => {
    if (isManualNavigation) {
      // Reset flag but don't auto-advance
      return;
    }
    
    // Check if stats mode is enabled and requires stats to be saved first
    const statsRequired = round?.stats_mode && round.stats_mode !== 'none';
    const currentHoleNumber = currentHole?.hole_number;
    const statsCompleted = !statsRequired || (currentHoleNumber && holeStatsSaved.has(currentHoleNumber));
    
    if (allPlayersEnteredCurrentHole && statsCompleted && currentHoleIndex < courseHoles.length - 1) {
      const timeout = setTimeout(() => {
        setCurrentHoleIndex(currentHoleIndex + 1);
        setShowScoreSheet(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [allPlayersEnteredCurrentHole, currentHoleIndex, courseHoles.length, isManualNavigation, round?.stats_mode, holeStatsSaved, currentHole?.hole_number]);

  const handleFinishRound = () => {
    // Tournament: auto-advance to next round in event
    if (round?.event_id) {
      void (async () => {
        try {
          const { data: eventRounds, error } = await supabase
            .from("rounds")
            .select("id, created_at")
            .eq("event_id", round.event_id)
            .order("created_at", { ascending: true });

          if (error) throw error;

          const ids = (eventRounds || []).map(r => r.id);
          const idx = ids.findIndex(id => id === roundId);
          const nextId = idx >= 0 ? ids[idx + 1] : null;

          if (nextId) {
            navigate(`/rounds/${nextId}/track`);
            return;
          }
        } catch (e) {
          console.error("Error advancing to next tournament round:", e);
        }
        // Fallback to summary if something goes wrong
        navigate(`/rounds/${roundId}/summary`);
      })();
      return;
    }

    // Single-round: Navigate to round summary to show results and share option
    navigate(`/rounds/${roundId}/summary`);
  };

  const handleDeleteRound = async () => {
    try {
      // Delete pro stats data if it exists
      const { data: proRound } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundId)
        .maybeSingle();

      if (proRound?.id) {
        // Delete pro stats holes
        await supabase
          .from('pro_stats_holes')
          .delete()
          .eq('pro_round_id', proRound.id);
        
        // Delete pro stats round
        await supabase
          .from('pro_stats_rounds')
          .delete()
          .eq('id', proRound.id);
      }

      // Delete all holes for this round
      const { error: holesError } = await supabase
        .from("holes")
        .delete()
        .eq("round_id", roundId);

      if (holesError) throw holesError;

      // Delete all round players
      const { error: playersError } = await supabase
        .from("round_players")
        .delete()
        .eq("round_id", roundId);

      if (playersError) throw playersError;

      // Delete the round
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
        {roundId && <RoundBottomTabBar roundId={roundId} isEditWindowExpired={isEditWindowExpired} />}
      </div>
    );
  }

  if (!round || !currentHole) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Round not found</div>
        {roundId && <RoundBottomTabBar roundId={roundId} isEditWindowExpired={isEditWindowExpired} />}
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
              onClick={() => navigate("/")}
              className="rounded-full"
            >
              <ChevronLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">{round.round_name || `Round ${round.date_played}`}</h1>
              <p className="text-sm text-muted-foreground">{round.course_name}</p>
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
              <div className="text-sm text-primary-foreground/90">PAR {currentHole.par}</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-bold text-primary-foreground">Hole {currentHole.hole_number}</span>
                {currentHole.hole_number > roundState.plannedHoles && (
                  <Badge variant="secondary" className="text-xs">
                    Extra
                  </Badge>
                )}
              </div>
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
      </div>

      {/* Score Entry */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Show players grouped by their game groups */}
        {groups.length > 0 ? (
          // When groups exist, show players organized by group
          <>
            {groups
              .filter((group) => {
                // All players see only their own group, or if currentUserGroupId is null, show first group
                if (currentUserGroupId) {
                  return group.id === currentUserGroupId;
                }
                // If no currentUserGroupId, show first group (fallback)
                return group === groups[0];
              })
              .map((group) => {
                const groupPlayers = players.filter((p) => 
                  p.group_id === group.id || (!p.group_id && group === groups[0])
                );
                if (groupPlayers.length === 0) return null;
                
                return (
                  <div key={group.id} className="space-y-3">
                    {/* Group header - show for all players in multi-group games */}
                    {groups.length > 1 && (
                      <div className="flex items-center gap-2 pt-2">
                        <Badge variant="secondary" className="text-sm">
                          {group.group_name}
                        </Badge>
                        {group.tee_time && (
                          <span className="text-xs text-muted-foreground">{group.tee_time}</span>
                        )}
                      </div>
                    )}
                    
                    {groupPlayers.map((player) => {
                      const playerScore = getPlayerScore(player.id);
                      const hasScore = hasPlayerEnteredScore(player.id);
                      const hasMulliganOnHole = hasPlayerUsedMulliganOnHole(player.id, currentHole?.hole_number || 0);
                      const isCurrentPlayerUser = player.user_id === currentUserId;
                      return (
                        <div key={player.id}>
                          <Card 
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
                                <div className="text-sm text-muted-foreground">
                                  Tee: {player.tee_color || round.tee_set}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-muted-foreground">{hasScore ? (playerScore === -1 ? "-" : playerScore) : 0}</div>
                                  <div className="text-xs text-muted-foreground">Strokes</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold">{getScoreDisplay(player.id)}</div>
                                  <div className="text-xs text-muted-foreground font-bold">To Par</div>
                                </div>
                              </div>
                            </div>
                          </Card>
                          
                          {/* In-round stats entry for current user only */}
                          {isCurrentPlayerUser && hasScore && playerScore && playerScore > 0 && round.stats_mode && round.stats_mode !== 'none' && (
                            <InRoundStatsEntry
                              key={`stats-${player.id}-${currentHole.hole_number}`}
                              statsMode={round.stats_mode as StatsMode}
                              roundId={round.id}
                              holeNumber={currentHole.hole_number}
                              par={currentHole.par}
                              score={playerScore}
                              playerId={player.id}
                              isCurrentUser={true}
                              holeDistance={getHoleDistance(currentHole, player.tee_color || round.tee_set)}
                              onStatsSaved={() => {
                                setHoleStatsSaved(prev => new Set(prev).add(currentHole.hole_number));
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </>
        ) : (
          // No groups - show all players (they're in the same implicit group)
          players.map((player) => {
            const playerScore = getPlayerScore(player.id);
            const hasScore = hasPlayerEnteredScore(player.id);
            const hasMulliganOnHole = hasPlayerUsedMulliganOnHole(player.id, currentHole?.hole_number || 0);
            const isCurrentPlayerUser = player.user_id === currentUserId;
            return (
              <div key={player.id}>
                <Card 
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
                      <div className="text-sm text-muted-foreground">
                        Tee: {player.tee_color || round.tee_set}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-muted-foreground">{hasScore ? (playerScore === -1 ? "-" : playerScore) : 0}</div>
                        <div className="text-xs text-muted-foreground">Strokes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{getScoreDisplay(player.id)}</div>
                        <div className="text-xs text-muted-foreground font-bold">To Par</div>
                      </div>
                    </div>
                  </div>
                </Card>
                
                {/* In-round stats entry for current user only */}
                {isCurrentPlayerUser && hasScore && playerScore && playerScore > 0 && round.stats_mode && round.stats_mode !== 'none' && (
                  <InRoundStatsEntry
                    key={`stats-${player.id}-${currentHole.hole_number}`}
                    statsMode={round.stats_mode as StatsMode}
                    roundId={round.id}
                    holeNumber={currentHole.hole_number}
                    par={currentHole.par}
                    score={playerScore}
                    playerId={player.id}
                    isCurrentUser={true}
                    holeDistance={getHoleDistance(currentHole, player.tee_color || round.tee_set)}
                    onStatsSaved={() => {
                      setHoleStatsSaved(prev => new Set(prev).add(currentHole.hole_number));
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>


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
              
              // Filter players the current user can edit (same group only)
              const editablePlayers = players.filter(p => {
                // If groups exist, must be in same group
                if (groups.length > 0 && currentUserGroupId) {
                  return p.group_id === currentUserGroupId;
                }
                // No groups: all players can edit each other (same implicit group)
                return true;
              });
              
              // Find next player without a score for this hole
              const nextPlayerWithoutScore = editablePlayers.find(p => {
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

      <RoundBottomTabBar roundId={roundId!} isEditWindowExpired={isEditWindowExpired} />
    </div>
  );
}
