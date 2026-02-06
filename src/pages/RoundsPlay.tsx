import { useState, useEffect } from "react";
import { Info, Sparkles, Calendar, MapPin, Users, Plus, ChevronDown, ChevronUp, CalendarDays } from "lucide-react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AISetupAssistant } from "@/components/AISetupAssistant";
import { GameConfiguration } from "@/types/gameConfig";
import { CourseSelectionDialog } from "@/components/CourseSelectionDialog";
import { GroupCard } from "@/components/play/GroupCard";
import { AddPlayerDialog } from "@/components/play/AddPlayerDialog";
import { AIConfigSummary } from "@/components/play/AIConfigSummary";
import { PlayerEditSheet } from "@/components/play/PlayerEditSheet";
import { PlaySetupState, PlayerGroup, Player, createDefaultGroup, getInitialPlaySetupState, RoundType } from "@/types/playSetup";
import { cn, parseHandicap } from "@/lib/utils";
import { TeeSelector, DEFAULT_MEN_TEE, STANDARD_TEE_OPTIONS, normalizeValue } from "@/components/TeeSelector";
import { CourseScorecard } from "@/components/CourseScorecard";
import { validateAllGroupsForFormat, formatSupportsMultipleGroups } from "@/utils/groupValidation";
import { GAME_FORMAT_PLAYER_REQUIREMENTS } from "@/types/gameGroups";
import { getDefaultRoundName } from "@/utils/roundCounter";
import AuthGuard from "@/components/AuthGuard";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ActiveRound {
  id: string;
  course_name: string;
  round_name: string | null;
  creator_id: string;
  creator_name: string;
  holes_played: number;
  holes_entered: number;
}

type HoleCount = "18" | "front9" | "back9";

interface Course {
  id: string;
  name: string;
  location: string;
  tee_names?: Record<string, string> | null;
}

function RoundsPlayContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Core state
  const [setupState, setSetupState] = useState<PlaySetupState>(getInitialPlaySetupState());
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teeCount, setTeeCount] = useState(5);
  const [courseTeeNames, setCourseTeeNames] = useState<Record<string, string> | null>(null);
  const [availableCourseTees, setAvailableCourseTees] = useState<string[]>(STANDARD_TEE_OPTIONS.map(t => t.value));
  const [courseHoles, setCourseHoles] = useState<{ holeNumber: number; par: number; strokeIndex: number }[]>([]);
  
  // UI state
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [addPlayerDialogOpen, setAddPlayerDialogOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  
  // Player edit state
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingPlayerGroupId, setEditingPlayerGroupId] = useState<string | null>(null);
  const [playerEditSheetOpen, setPlayerEditSheetOpen] = useState(false);
  
  // Join existing game state
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  // Event: list for dropdown + first-round players when continuing an event
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [createEventLoading, setCreateEventLoading] = useState(false);

  useEffect(() => {
    initializeSetup();
    checkForActiveRounds();
  }, []);

  // Fetch events (user is creator or participant via RLS)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setEventsLoading(true);
        const { data, error } = await supabase
          .from("events")
          .select("id, name")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (!cancelled) setEvents(data || []);
      } catch (e) {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseTees(selectedCourse.id);
      setSetupState(prev => ({
        ...prev,
        selectedCourse: { id: selectedCourse.id, name: selectedCourse.name, location: selectedCourse.location }
      }));
    }
  }, [selectedCourse]);

  // Check for active rounds where user is participant but not creator
  const checkForActiveRounds = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get rounds where user is a participant but NOT the creator (from last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: participantRounds } = await supabase
        .from('round_players')
        .select('round_id')
        .eq('user_id', user.id);
      
      if (!participantRounds || participantRounds.length === 0) return;
      
      const roundIds = participantRounds.map(rp => rp.round_id);
      
      // Find rounds where user is participant but not creator, created recently
      const { data: activeRounds } = await supabase
        .from('rounds')
        .select('id, course_name, round_name, user_id, holes_played, created_at, event_id')
        .in('id', roundIds)
        .neq('user_id', user.id)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (activeRounds && activeRounds.length > 0) {
        let round = activeRounds[0] as any;

        // If this is part of an event (multi-round tournament), join the first round
        if (round?.event_id) {
          const { data: firstRounds } = await supabase
            .from('rounds')
            .select('id, course_name, round_name, user_id, holes_played, created_at, event_id')
            .eq('event_id', round.event_id)
            .order('created_at', { ascending: true })
            .limit(1);

          if (firstRounds && firstRounds.length > 0) {
            round = firstRounds[0] as any;
          }
        }
        
        // Get creator profile
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', round.user_id)
          .single();
        
        // Count holes entered
        const { count: holesEntered } = await supabase
          .from('holes')
          .select('*', { count: 'exact', head: true })
          .eq('round_id', round.id);
        
        setActiveRound({
          id: round.id,
          course_name: round.course_name,
          round_name: round.round_name,
          creator_id: round.user_id,
          creator_name: creatorProfile?.display_name || creatorProfile?.username || 'A friend',
          holes_played: round.holes_played,
          holes_entered: holesEntered || 0
        });
        setShowJoinDialog(true);
      }
    } catch (error) {
      console.error('Error checking for active rounds:', error);
    }
  };

  const handleJoinRound = () => {
    if (activeRound) {
      navigate(`/rounds/${activeRound.id}/track`);
    }
    setShowJoinDialog(false);
  };

  const handleDeclineJoin = () => {
    setShowJoinDialog(false);
    setActiveRound(null);
  };

  const initializeSetup = async () => {
    // Fetch current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // No user, just fetch round count (saved state restoration happens below for logged-in users)
      fetchRoundCount();
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    setCurrentUser(profile);

    // Get default tee from app preferences
    let defaultTee = DEFAULT_MEN_TEE;
    try {
      const savedPrefs = localStorage.getItem('appPreferences');
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.defaultTee) {
          defaultTee = prefs.defaultTee;
        }
      }
    } catch (e) {
      console.error("Error reading app preferences:", e);
    }

    // Create current user player object
    const currentUserPlayer: Player = {
      odId: user.id,
      teeColor: defaultTee,
      displayName: profile?.display_name || profile?.username || "You",
      username: profile?.username || "",
      avatarUrl: profile?.avatar_url,
      handicap: parseHandicap(profile?.handicap),
      isTemporary: false,
    };

    // Restore saved state first
    const savedCourse = sessionStorage.getItem('selectedCourse');
    const savedHoles = sessionStorage.getItem('selectedHoles');
    const savedRoundName = sessionStorage.getItem('roundName');
    const savedDate = sessionStorage.getItem('datePlayer');
    const savedGroups = sessionStorage.getItem('playGroups');
    const savedAIConfig = sessionStorage.getItem('aiGameConfig');
    const savedGameFormat = sessionStorage.getItem('gameFormat');
    const savedEventId = sessionStorage.getItem('selectedEventId');

    if (savedCourse) setSelectedCourse(JSON.parse(savedCourse));

    setSetupState(prev => {
      const updated = { ...prev, teeColor: defaultTee };
      if (savedHoles) updated.selectedHoles = savedHoles as HoleCount;
      if (savedRoundName) updated.roundName = savedRoundName;
      if (savedDate) updated.datePlayed = savedDate;
      if (savedGameFormat) updated.gameFormat = savedGameFormat as any;
      if (savedEventId) updated.selectedEventId = savedEventId;
      if (savedAIConfig) {
        const config = JSON.parse(savedAIConfig);
        updated.aiConfigApplied = true;
        updated.aiAssumptions = config.assumptions;
        updated.aiConfigSummary = `${config.baseFormat?.replace('_', ' ')} with ${config.totalHoles} holes`;
      }

      // Handle groups - ensure current user is always in first group
      let groups = savedGroups ? JSON.parse(savedGroups) : prev.groups;
      
      // Check if current user already exists in any group
      const userExistsInGroups = groups.some((g: PlayerGroup) => 
        g.players.some((p: Player) => p.odId === user.id)
      );

      if (!userExistsInGroups) {
        // Add current user to first group
        if (groups.length > 0) {
          groups[0] = {
            ...groups[0],
            players: [currentUserPlayer, ...groups[0].players]
          };
        } else {
          groups = [{
            ...createDefaultGroup(0),
            players: [currentUserPlayer]
          }];
        }
      } else {
        // Update current user's info in case profile changed
        groups = groups.map((g: PlayerGroup) => ({
          ...g,
          players: g.players.map((p: Player) => 
            p.odId === user.id ? { ...currentUserPlayer, teeColor: p.teeColor || defaultTee } : p
          )
        }));
      }

      updated.groups = groups;
      return updated;
    });

    // Pre-select recently played course (only if no saved course in session)
    if (!savedCourse) {
      await fetchRecentCourse(user.id);
    }

    // Fetch round count for default name
    if (!savedRoundName) {
      fetchRoundCount();
    }
  };

  const fetchRecentCourse = async (userId: string) => {
    try {
      // Fetch most recent round with a course
      const { data: recentRound } = await supabase
        .from("rounds")
        .select("course_name")
        .eq("user_id", userId)
        .order("date_played", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentRound?.course_name) {
        // Find the course in database
        const { data: course } = await supabase
          .from("courses")
          .select("id, name, location")
          .eq("name", recentRound.course_name)
          .maybeSingle();

        if (course) {
          setSelectedCourse({ id: course.id, name: course.name, location: course.location || "" });
        }
      }
    } catch (error) {
      console.error("Error fetching recent course:", error);
    }
  };

  const fetchRoundCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const savedRoundName = sessionStorage.getItem('roundName');
      if (!savedRoundName) {
        const defaultName = await getDefaultRoundName(user.id);
        setSetupState(prev => ({ ...prev, roundName: defaultName }));
      }
    } catch (error) {
      console.error("Error fetching round count:", error);
    }
  };

  const fetchCourseTees = async (courseId: string) => {
    try {
      const DEFAULT_TEE_LABELS: Record<string, string> = {
        black: "Black",
        blue: "Blue",
        white: "White",
        silver: "Silver",
        gold: "Gold",
        yellow: "Yellow",
        red: "Red",
        orange: "Orange",
      };

      const STANDARD_TEE_ORDER = ["black", "blue", "white", "silver", "gold", "yellow", "red", "orange"];
      const TEE_DISTANCE_COLUMNS: Record<string, string> = {
        black: "black_distance",
        blue: "blue_distance",
        white: "white_distance",
        silver: "silver_distance",
        gold: "gold_distance",
        yellow: "yellow_distance",
        red: "red_distance",
        orange: "orange_distance",
      };

      // Fetch course for tee names
      const { data: courseData } = await supabase
        .from("courses")
        .select("tee_names")
        .eq("id", courseId)
        .single();
      
      const { data, error } = await supabase
        .from("course_holes")
        .select("*")
        .eq("course_id", courseId)
        .order("hole_number");

      if (error) throw error;

      if (data && data.length > 0) {
        const firstHole = data[0];
        const tees: string[] = [];
        if (firstHole.black_distance) tees.push("black");
        if (firstHole.blue_distance) tees.push("blue");
        if (firstHole.white_distance) tees.push("white");
        if (firstHole.silver_distance) tees.push("silver");
        if (firstHole.gold_distance) tees.push("gold");
        if (firstHole.yellow_distance) tees.push("yellow");
        if (firstHole.red_distance) tees.push("red");
        if (firstHole.orange_distance) tees.push("orange");

        // Prefer ordering tees by total distance (robust for 6+ tees), fallback to standard order
        const totals: Record<string, number> = {};
        for (const tee of tees) totals[tee] = 0;
        for (const hole of (data as any[])) {
          for (const tee of tees) {
            const col = TEE_DISTANCE_COLUMNS[tee];
            const v = col ? hole?.[col] : null;
            if (typeof v === "number" && Number.isFinite(v)) totals[tee] += v;
          }
        }
        const orderedAvailable = [...tees].sort((a, b) => (totals[b] || 0) - (totals[a] || 0));
        // If totals are all equal (e.g. missing), fall back to standard color ordering
        const allEqual = orderedAvailable.length > 1
          ? orderedAvailable.every(t => (totals[t] || 0) === (totals[orderedAvailable[0]] || 0))
          : false;
        const finalAvailable = allEqual ? STANDARD_TEE_ORDER.filter(t => tees.includes(t)) : orderedAvailable;

        setAvailableCourseTees(finalAvailable.length > 0 ? finalAvailable : STANDARD_TEE_OPTIONS.map(t => t.value));
        setTeeCount(finalAvailable.length || tees.length || 5);

        // Build tee labels that include ONLY tees available for this course
        const rawTeeNames = (courseData?.tee_names || null) as any;
        const normalizedTeeNames: Record<string, string> = {};
        if (rawTeeNames && typeof rawTeeNames === "object" && !Array.isArray(rawTeeNames)) {
          // Object format: {"black": "Black", "blue": "Blue", ...}
          for (const [k, v] of Object.entries(rawTeeNames)) {
            if (!k) continue;
            normalizedTeeNames[String(k).toLowerCase()] = String(v);
          }
        } else if (Array.isArray(rawTeeNames)) {
          // Array format: ["Cardinal", "Black", "White", "Blue", "Family"]
          // Map array indices to ordered tee keys (by distance, longest to shortest)
          // The ordered tees are already sorted by distance: ["gold", "black", "white", "blue", "red"]
          // Map them to the array in order: [0] -> gold, [1] -> black, [2] -> white, [3] -> blue, [4] -> red
          const orderedTeesForMapping = finalAvailable.length > 0 ? finalAvailable : tees;
          for (let i = 0; i < rawTeeNames.length && i < orderedTeesForMapping.length; i++) {
            const teeKey = orderedTeesForMapping[i].toLowerCase();
            const teeName = String(rawTeeNames[i]);
            if (teeKey && teeName) {
              normalizedTeeNames[teeKey] = teeName;
            }
          }
        }

        const filteredCourseTeeNames: Record<string, string> = {};
        for (const key of (finalAvailable.length > 0 ? finalAvailable : tees)) {
          filteredCourseTeeNames[key] = normalizedTeeNames[key] || DEFAULT_TEE_LABELS[key] || key;
        }
        setCourseTeeNames(Object.keys(filteredCourseTeeNames).length > 0 ? filteredCourseTeeNames : null);
        
        // Apply user's preferred default tee (supports difficulty prefs like "longest") and ensure it's valid.
        const preferredRaw = (setupState.teeColor || DEFAULT_MEN_TEE).toLowerCase();
        const mapped = normalizeValue(preferredRaw, finalAvailable.length > 0 ? finalAvailable : tees);
        const effective = (finalAvailable.includes(mapped) ? mapped : (finalAvailable[0] || mapped || "white"));
        if (setupState.teeColor !== effective) {
          handleDefaultTeeChange(effective);
        }

        setCourseHoles(data.map(h => ({
          holeNumber: h.hole_number,
          par: h.par,
          strokeIndex: h.stroke_index
        })));
      }
    } catch (error) {
      console.error("Error fetching tees:", error);
      setTeeCount(5);
      setCourseTeeNames(null);
      setAvailableCourseTees(STANDARD_TEE_OPTIONS.map(t => t.value));
    }
  };

  // Group management
  const addGroup = () => {
    setSetupState(prev => ({
      ...prev,
      groups: [...prev.groups, createDefaultGroup(prev.groups.length)]
    }));
  };

  const updateGroupName = (groupId: string, name: string) => {
    setSetupState(prev => ({
      ...prev,
      groups: prev.groups.map(g => g.id === groupId ? { ...g, name } : g)
    }));
  };

  const deleteGroup = (groupId: string) => {
    setSetupState(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.id !== groupId)
    }));
  };

  const addPlayerToGroup = (groupId: string, player: Player) => {
    player.teeColor = player.teeColor || setupState.teeColor || "medium";
    setSetupState(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId ? { ...g, players: [...g.players, player] } : g
      )
    }));
    setAddPlayerDialogOpen(false);
  };

  const removePlayerFromGroup = (groupId: string, playerId: string) => {
    setSetupState(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId ? { ...g, players: g.players.filter(p => p.odId !== playerId) } : g
      )
    }));
  };

  const updatePlayerTee = (groupId: string, playerId: string, tee: string) => {
    setSetupState(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId
          ? { ...g, players: g.players.map(p => p.odId === playerId ? { ...p, teeColor: tee } : p) }
          : g
      )
    }));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceGroupId = result.source.droppableId;
    const destGroupId = result.destination.droppableId;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceGroupId === destGroupId) {
      // Reorder within same group
      setSetupState(prev => ({
        ...prev,
        groups: prev.groups.map(g => {
          if (g.id !== sourceGroupId) return g;
          const newPlayers = [...g.players];
          const [removed] = newPlayers.splice(sourceIndex, 1);
          newPlayers.splice(destIndex, 0, removed);
          return { ...g, players: newPlayers };
        })
      }));
    } else {
      // Move player between groups
      setSetupState(prev => {
        const sourceGroup = prev.groups.find(g => g.id === sourceGroupId);
        if (!sourceGroup) return prev;

        const player = sourceGroup.players[sourceIndex];
        if (!player) return prev;

        return {
          ...prev,
          groups: prev.groups.map(g => {
            if (g.id === sourceGroupId) {
              // Remove from source group
              return { ...g, players: g.players.filter((_, idx) => idx !== sourceIndex) };
            } else if (g.id === destGroupId) {
              // Add to destination group at the correct index
              const newPlayers = [...g.players];
              newPlayers.splice(destIndex, 0, player);
              return { ...g, players: newPlayers };
            }
            return g;
          })
        };
      });
    }
  };

  // Player edit handlers
  const handlePlayerClick = (groupId: string, player: Player) => {
    setEditingPlayer(player);
    setEditingPlayerGroupId(groupId);
    setPlayerEditSheetOpen(true);
  };

  const handleSavePlayer = (updatedPlayer: Player) => {
    if (!editingPlayerGroupId) return;
    
    setSetupState(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === editingPlayerGroupId
          ? { ...g, players: g.players.map(p => p.odId === updatedPlayer.odId ? updatedPlayer : p) }
          : g
      )
    }));
  };

  // Update all players' tees when default tee changes
  const handleDefaultTeeChange = (tee: string) => {
    setSetupState(prev => ({
      ...prev,
      teeColor: tee,
      groups: prev.groups.map(g => ({
        ...g,
        players: g.players.map(p => ({ ...p, teeColor: tee }))
      }))
    }));
  };

  // AI config handler
  const handleApplyAIConfig = (config: GameConfiguration) => {
    // Map base format to our supported formats
    const formatMap: Record<string, typeof setupState.gameFormat> = {
      'stroke_play': 'stroke_play',
      'stableford': 'stroke_play',
      'copenhagen': 'copenhagen',
      'match_play': 'match_play',
      'best_ball': 'best_ball',
      'scramble': 'scramble',
      'skins': 'skins',
      'umbriago': 'umbriago',
      'wolf': 'wolf',
      'custom': 'stroke_play',
    };
    const format = formatMap[config.baseFormat] || 'stroke_play';

    // Map hole count
    let selectedHoles: HoleCount = '18';
    if (config.totalHoles === 9) {
      // Check if it's front or back 9 based on hole numbers
      if (config.holes.length > 0) {
        const firstHole = config.holes[0].holeNumber;
        selectedHoles = firstHole <= 9 ? 'front9' : 'back9';
      } else {
        selectedHoles = 'front9';
      }
    }

    // Build players from AI config if provided
    let updatedGroups = setupState.groups;
    if (config.playerNames && config.playerNames.length > 0) {
      const aiPlayers: Player[] = config.playerNames.map((name, idx) => {
        const teeAssignment = config.teeAssignments?.find(t => t.playerIndex === idx);
        const handicapAdjustment = config.handicapAdjustments?.find(h => h.playerIndex === idx);
        
        return {
          odId: `ai-player-${idx}-${Date.now()}`,
          displayName: name,
          username: '',
          teeColor: teeAssignment?.defaultTee || setupState.teeColor || 'medium',
          handicap: handicapAdjustment?.adjustedStrokes ?? null,
          isTemporary: true,
          avatarUrl: undefined,
        };
      });

      // Keep current user if exists, add AI players
      const currentUserPlayer = setupState.groups[0]?.players?.[0];
      const playersToAdd = currentUserPlayer 
        ? [currentUserPlayer, ...aiPlayers.filter(p => p.displayName.toLowerCase() !== currentUserPlayer.displayName?.toLowerCase())]
        : aiPlayers;

      updatedGroups = [{
        ...setupState.groups[0],
        players: playersToAdd.slice(0, config.playerCount || playersToAdd.length)
      }];
    }

    // Apply tee assignments to existing players if no new players provided
    if (!config.playerNames?.length && config.teeAssignments?.length > 0) {
      updatedGroups = setupState.groups.map(group => ({
        ...group,
        players: group.players.map((player, idx) => {
          const teeAssignment = config.teeAssignments?.find(t => 
            t.playerName?.toLowerCase() === player.displayName?.toLowerCase() || t.playerIndex === idx
          );
          return teeAssignment ? { ...player, teeColor: teeAssignment.defaultTee } : player;
        })
      }));
    }

    setSetupState(prev => ({
      ...prev,
      gameFormat: format as any,
      selectedHoles,
      groups: updatedGroups,
      strokePlaySettings: {
        mulligansPerPlayer: config.mulligansPerPlayer || 0,
        handicapEnabled: false,
        gimmesEnabled: config.gimmesEnabled || false,
      },
      aiConfigApplied: true,
      aiConfigSummary: `${config.baseFormat?.replace('_', ' ')} with ${config.totalHoles} holes`,
      aiAssumptions: config.assumptions,
    }));

    sessionStorage.setItem('aiGameConfig', JSON.stringify(config));
    
    toast({
      title: "AI Configuration Applied",
      description: `${config.baseFormat.replace('_', ' ')} with ${config.totalHoles} holes configured!`,
    });
  };

  // Save state before navigation
  const saveState = () => {
    if (selectedCourse) sessionStorage.setItem('selectedCourse', JSON.stringify(selectedCourse));
    sessionStorage.setItem('selectedHoles', setupState.selectedHoles);
    sessionStorage.setItem('roundName', setupState.roundName);
    sessionStorage.setItem('datePlayer', setupState.datePlayed);
    sessionStorage.setItem('playGroups', JSON.stringify(setupState.groups));
    sessionStorage.setItem('gameFormat', setupState.gameFormat);
    if (setupState.selectedEventId) sessionStorage.setItem('selectedEventId', setupState.selectedEventId);
    else sessionStorage.removeItem('selectedEventId');
  };

  const handleCreateEvent = async () => {
    const name = newEventName.trim();
    if (!name) {
      toast({ title: "Event name required", description: "Enter a name for the event", variant: "destructive" });
      return;
    }
    setCreateEventLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Not signed in", variant: "destructive" });
        return;
      }
      const { data: newEvent, error } = await supabase
        .from("events")
        .insert({
          name,
          creator_id: user.id,
          game_type: "round",
        })
        .select("id, name")
        .single();
      if (error) throw error;
      setEvents((prev) => [{ id: newEvent.id, name: newEvent.name }, ...prev]);
      setSetupState((prev) => ({ ...prev, selectedEventId: newEvent.id }));
      sessionStorage.setItem("selectedEventId", newEvent.id);
      setNewEventName("");
      setShowCreateEventDialog(false);
      toast({ title: "Event created", description: `"${newEvent.name}" is selected. Your round will be added to this event.` });
    } catch (err: any) {
      toast({ title: "Could not create event", description: err?.message || "Please try again", variant: "destructive" });
    } finally {
      setCreateEventLoading(false);
    }
  };

  const getHolesPlayed = (holeCount: HoleCount): number => {
    switch (holeCount) {
      case "front9": return 9;
      case "back9": return 9;
      default: return 18;
    }
  };

  const getTotalPlayers = () => setupState.groups.reduce((acc, g) => acc + g.players.length, 0);

  const getAllPlayerIds = () => setupState.groups.flatMap(g => g.players.map(p => p.odId));

  // Validation for player requirements per game format - validates per group for all formats
  const getPlayerValidationError = (): string | null => {
    const format = setupState.gameFormat;
    const groups = setupState.groups;
    const nonEmptyGroups = groups.filter(g => g.players.length > 0);
    
    if (nonEmptyGroups.length === 0) {
      return "Add at least 1 player to continue.";
    }

    const req = GAME_FORMAT_PLAYER_REQUIREMENTS[format];
    if (!req) return null;

    const formatName = format.replace(/_/g, " ");
    const capitalizedFormat = formatName.charAt(0).toUpperCase() + formatName.slice(1);

    // ALL formats now validate per group - each group must meet the requirements
    for (const group of nonEmptyGroups) {
      const playerCount = group.players.length;
      
      // Check for allowed counts (e.g., match play: 2 or 4)
      if (req.allowedCounts && !req.allowedCounts.includes(playerCount)) {
        const allowedStr = req.allowedCounts.join(" or ");
        return `${group.name} needs exactly ${allowedStr} players for ${capitalizedFormat} (has ${playerCount})`;
      }
      
      if (req.exact && playerCount !== req.exact) {
        return `${group.name} needs exactly ${req.exact} players for ${capitalizedFormat} (has ${playerCount})`;
      }
      
      if (playerCount < req.min) {
        return `${group.name} needs at least ${req.min} players for ${capitalizedFormat} (has ${playerCount})`;
      }
      
      if (playerCount > req.max) {
        return `${group.name} can have at most ${req.max} players for ${capitalizedFormat} (has ${playerCount})`;
      }
    }

    return null;
  };

  const playerValidationError = getPlayerValidationError();

  const handleStartRound = async () => {
    if (!selectedCourse) {
      toast({ title: "Course required", description: "Please select a course", variant: "destructive" });
      return;
    }

    // Validate player count for game format
    if (playerValidationError) {
      toast({ title: "Invalid player count", description: playerValidationError, variant: "destructive" });
      return;
    }

    saveState();

    // Store players for downstream pages (backwards compatibility)
    const allPlayers = setupState.groups.flatMap(g => g.players);
    sessionStorage.setItem('roundPlayers', JSON.stringify(allPlayers.slice(1))); // Exclude current user
    sessionStorage.setItem('userTeeColor', allPlayers[0]?.teeColor || setupState.teeColor);

    if (setupState.gameFormat === "umbriago") {
      navigate('/umbriago/setup');
      return;
    }
    if (setupState.gameFormat === "wolf") {
      navigate('/wolf/setup');
      return;
    }
    if (setupState.gameFormat === "copenhagen") {
      navigate('/copenhagen/setup');
      return;
    }
    if (setupState.gameFormat === "match_play") {
      navigate('/match-play/setup');
      return;
    }
    if (setupState.gameFormat === "best_ball") {
      navigate('/best-ball/setup');
      return;
    }
    if (setupState.gameFormat === "scramble") {
      navigate('/scramble/setup');
      return;
    }
    if (setupState.gameFormat === "skins") {
      navigate('/skins/setup');
      return;
    }
    if (setupState.gameFormat === "stroke_play") {
      navigate('/stroke-play/setup');
      return;
    }

    // Default: start tracking
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get the round name - if empty, generate "Round X" based on count
      let roundName = setupState.roundName;
      if (!roundName) {
        const { count } = await supabase
          .from("rounds")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        roundName = `Round ${(count || 0) + 1}`;
      }

      const { data: round, error } = await supabase
        .from("rounds")
        .insert([{
          user_id: user.id,
          course_name: selectedCourse.name,
          round_name: roundName,
          tee_set: setupState.teeColor,
          holes_played: getHolesPlayed(setupState.selectedHoles as HoleCount),
          origin: 'play',
          date_played: setupState.datePlayed,
          ...(setupState.selectedEventId ? { event_id: setupState.selectedEventId } : {}),
        }])
        .select()
        .single();

      if (error) throw error;

      // Separate registered players and guest players
      const allPlayers = setupState.groups.flatMap(g => g.players);
      const registeredPlayers = allPlayers.filter(p => !p.isTemporary);
      const guestPlayers = allPlayers.filter(p => p.isTemporary);

      // Add registered players to database
      const registeredPlayersToAdd = registeredPlayers.map(p => ({
        round_id: round.id,
        user_id: p.odId,
        tee_color: p.teeColor,
        is_guest: false,
      }));

      // Add guest players to database (with null user_id and guest_name)
      const guestPlayersToAdd = guestPlayers.map(p => ({
        round_id: round.id,
        user_id: null,
        tee_color: p.teeColor,
        guest_name: p.displayName,
        handicap: p.handicap,
        is_guest: true,
      }));

      const allPlayersToAdd = [...registeredPlayersToAdd, ...guestPlayersToAdd];
      
      if (allPlayersToAdd.length > 0) {
        await supabase.from('round_players').insert(allPlayersToAdd);
      }

      // Clear storage
      sessionStorage.removeItem('roundPlayers');
      sessionStorage.removeItem('userTeeColor');
      sessionStorage.removeItem('selectedCourse');
      sessionStorage.removeItem('playGroups');
      sessionStorage.removeItem('aiGameConfig');
      sessionStorage.removeItem('selectedEventId');

      toast({ title: "Round started!", description: `Good luck at ${selectedCourse.name}` });
      navigate(`/rounds/${round.id}/track`);
    } catch (error: any) {
      toast({ title: "Error creating round", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      
      {/* Join Existing Game Dialog */}
      <AlertDialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Join Existing Round?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <span className="font-medium text-foreground">{activeRound?.creator_name}</span> has added you to a round at{" "}
                <span className="font-medium text-foreground">{activeRound?.course_name}</span>.
              </p>
              {activeRound && activeRound.holes_entered > 0 && (
                <p className="text-muted-foreground">
                  {activeRound.holes_entered} of {activeRound.holes_played} holes played.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeclineJoin}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleJoinRound}>Join Game</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        
        {/* Header Card - Round Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Create Game</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Event (optional) - must be selected before starting if linking to an event */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                Event
              </Label>
              <div className="flex gap-2">
                <Select
                  value={setupState.selectedEventId ?? "none"}
                  onValueChange={(v) => setSetupState(prev => ({ ...prev, selectedEventId: v === "none" ? null : v }))}
                  disabled={eventsLoading}
                >
                  <SelectTrigger className="flex-1 min-w-0">
                    <SelectValue placeholder={eventsLoading ? "Loading events..." : "No event (single round)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No event (single round)</SelectItem>
                    {events.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setShowCreateEventDialog(true)}
                  title="Create new event"
                >
                  <Plus className="h-4 w-4 mr-0.5" />
                  New Event
                </Button>
              </div>
            </div>

            {/* Round Name & Date Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Round Name</Label>
                <Input
                  value={setupState.roundName}
                  onChange={(e) => setSetupState(prev => ({ ...prev, roundName: e.target.value }))}
                  placeholder="Round 1"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(new Date(setupState.datePlayed + 'T12:00:00'), "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={new Date(setupState.datePlayed + 'T12:00:00')}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          setSetupState(prev => ({ 
                            ...prev, 
                            datePlayed: `${year}-${month}-${day}`
                          }));
                          setDatePopoverOpen(false);
                        }
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Course Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Course
              </Label>
              {!selectedCourse ? (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowCourseDialog(true)}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Select a course...
                </Button>
              ) : (
                <div className="p-3 rounded-lg border-2 border-primary bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{selectedCourse.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedCourse.location}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowCourseDialog(true)}>
                      Change
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Tee Selection (course-specific) */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tees</Label>
              <TeeSelector
                value={setupState.teeColor}
                onValueChange={(tee) => handleDefaultTeeChange(tee)}
                teeCount={availableCourseTees.length || 5}
                courseTeeNames={courseTeeNames}
                triggerClassName="w-full justify-between"
                disabled={!selectedCourse}
              />
            </div>

            {/* Holes Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs">Holes</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["18", "front9", "back9"] as const).map((holes) => (
                  <button
                    key={holes}
                    onClick={() => setSetupState(prev => ({ ...prev, selectedHoles: holes }))}
                    className={cn(
                      "p-2.5 rounded-lg border-2 text-center transition-all text-sm font-medium",
                      setupState.selectedHoles === holes
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {holes === "18" ? "Full 18" : holes === "front9" ? "Front 9" : "Back 9"}
                  </button>
                ))}
              </div>
            </div>

            {/* Round Type */}
            <div className="space-y-1.5">
              <Label className="text-xs">Round Type</Label>
              <Select 
                value={setupState.roundType} 
                onValueChange={(v) => setSetupState(prev => ({ ...prev, roundType: v as RoundType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select round type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fun_practice">Fun/Practice</SelectItem>
                  <SelectItem value="qualifying">Qualifying</SelectItem>
                  <SelectItem value="tournament">Tournament</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Course Scorecard */}
        {selectedCourse && (
          <CourseScorecard
            courseId={selectedCourse.id}
            selectedTee={setupState.teeColor}
            selectedHoles={setupState.selectedHoles === "custom" ? "18" : setupState.selectedHoles}
          />
        )}

        {/* AI Config Summary */}
        <AIConfigSummary
          isApplied={setupState.aiConfigApplied}
          summary={setupState.aiConfigSummary}
          assumptions={setupState.aiAssumptions}
        />

        {/* Groups & Players */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Groups & Players
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {getTotalPlayers()} player{getTotalPlayers() !== 1 ? "s" : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="space-y-3">
                {setupState.groups.map((group, index) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    groupIndex={index}
                    availableTees={selectedCourse ? availableCourseTees : STANDARD_TEE_OPTIONS.map(t => t.value)}
                    courseTeeNames={courseTeeNames}
                    canDelete={setupState.groups.length > 1}
                    onUpdateName={(name) => updateGroupName(group.id, name)}
                    onAddPlayer={() => {
                      setActiveGroupId(group.id);
                      setAddPlayerDialogOpen(true);
                    }}
                    onRemovePlayer={(playerId) => removePlayerFromGroup(group.id, playerId)}
                    onUpdatePlayerTee={(playerId, tee) => updatePlayerTee(group.id, playerId, tee)}
                    onDeleteGroup={() => deleteGroup(group.id)}
                    onPlayerClick={(player) => handlePlayerClick(group.id, player)}
                    enableDrag={true}
                  />
                ))}
              </div>
            </DragDropContext>
            
            <Button variant="outline" className="w-full" onClick={addGroup}>
              <Plus className="w-4 h-4 mr-2" />
              Add Group
            </Button>
          </CardContent>
        </Card>

        {/* Game Formats */}
        <Collapsible open={settingsExpanded} onOpenChange={setSettingsExpanded}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Game Formats</CardTitle>
                  {settingsExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {/* Game Format */}
                <div className="space-y-3">
                  {/* Individual Games */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Individual</p>
                    {[
                      { id: "stroke_play", label: "Stroke Play", desc: "Standard scoring" },
                      { id: "match_play", label: "Match Play", desc: "1v1 hole-by-hole" },
                      { id: "skins", label: "Skins", desc: "Win holes for skins" },
                      { id: "copenhagen", label: "Copenhagen", desc: "3 players, 6-point game" },
                    ].map((fmt) => (
                      <div key={fmt.id} className="relative">
                        <button
                          onClick={() => setSetupState(prev => ({ ...prev, gameFormat: fmt.id as any }))}
                          className={cn(
                            "w-full p-3 rounded-lg border-2 text-left transition-all pr-12",
                            setupState.gameFormat === fmt.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <p className="font-semibold text-sm">{fmt.label}</p>
                          <p className="text-xs text-muted-foreground">{fmt.desc}</p>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveState();
                            if (fmt.id === "stroke_play") navigate('/stroke-play/how-to-play');
                            else if (fmt.id === "match_play") navigate('/match-play/how-to-play');
                            else if (fmt.id === "skins") navigate('/skins/how-to-play');
                            else navigate('/copenhagen/how-to-play');
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted"
                        >
                          <Info size={16} className="text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Team Games */}
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Teams</p>
                    {[
                      { id: "best_ball", label: "Best Ball", desc: "Team match play or stroke play" },
                      { id: "scramble", label: "Scramble", desc: "Team plays best shot" },
                      { id: "umbriago", label: "Umbriago", desc: "2v2 team game" },
                      { id: "wolf", label: "🐺 Wolf", desc: "4-6 players, various teams" },
                    ].map((fmt) => (
                      <div key={fmt.id} className="relative">
                        <button
                          onClick={() => setSetupState(prev => ({ ...prev, gameFormat: fmt.id as any }))}
                          className={cn(
                            "w-full p-3 rounded-lg border-2 text-left transition-all pr-12",
                            setupState.gameFormat === fmt.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <p className="font-semibold text-sm">{fmt.label}</p>
                          <p className="text-xs text-muted-foreground">{fmt.desc}</p>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveState();
                            if (fmt.id === "best_ball") navigate('/best-ball/how-to-play');
                            else if (fmt.id === "scramble") navigate('/scramble/how-to-play');
                            else if (fmt.id === "wolf") navigate('/wolf/how-to-play');
                            else navigate('/umbriago/how-to-play');
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted"
                        >
                          <Info size={16} className="text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Start Button */}
        <div className="space-y-2">
          {playerValidationError && (
            <p className="text-sm text-destructive text-center">{playerValidationError}</p>
          )}
          <Button
            onClick={handleStartRound}
            disabled={loading || !selectedCourse || !!playerValidationError}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            {loading ? "Starting..." : "Continue"}
          </Button>
        </div>
      </div>

      {/* AI Assistant FAB */}
      <Button
        onClick={() => setShowAIAssistant(true)}
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg"
        size="icon"
      >
        <Sparkles className="w-6 h-6" />
      </Button>

      {/* Create new event dialog */}
      <Dialog open={showCreateEventDialog} onOpenChange={setShowCreateEventDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new event</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Name the event. This round will be linked to it when you start.
          </p>
          <div className="space-y-2">
            <Label htmlFor="new-event-name">Event name</Label>
            <Input
              id="new-event-name"
              placeholder="e.g. Weekend Championship"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateEvent()}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreateEventDialog(false)} disabled={createEventLoading}>
              Cancel
            </Button>
            <Button onClick={handleCreateEvent} disabled={createEventLoading || !newEventName.trim()}>
              {createEventLoading ? "Creating…" : "Create & select"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <AISetupAssistant
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        courseInfo={selectedCourse ? {
          courseName: selectedCourse.name,
          availableTees: courseTeeNames
            ? ["black", "blue", "white", "yellow", "red"].filter(k => courseTeeNames[k]).map(k => courseTeeNames[k])
            : STANDARD_TEE_OPTIONS.map(t => t.label),
          defaultHoles: getHolesPlayed(setupState.selectedHoles as HoleCount),
          courseHoles,
        } : undefined}
        onApplyConfig={handleApplyAIConfig}
      />

      <CourseSelectionDialog
        isOpen={showCourseDialog}
        onClose={() => setShowCourseDialog(false)}
        onSelectCourse={(course) => {
          setSelectedCourse(course);
          setShowCourseDialog(false);
        }}
      />

      <AddPlayerDialog
        isOpen={addPlayerDialogOpen}
        onClose={() => setAddPlayerDialogOpen(false)}
        onAddPlayer={(player) => activeGroupId && addPlayerToGroup(activeGroupId, player)}
        existingPlayerIds={getAllPlayerIds()}
        defaultTee={setupState.teeColor || DEFAULT_MEN_TEE}
        existingGuestDisplayNames={setupState.groups.flatMap((g) => g.players).filter((p) => p.isTemporary).map((p) => p.displayName)}
      />

      <PlayerEditSheet
        isOpen={playerEditSheetOpen}
        onClose={() => {
          setPlayerEditSheetOpen(false);
          setEditingPlayer(null);
          setEditingPlayerGroupId(null);
        }}
        player={editingPlayer}
        availableTees={STANDARD_TEE_OPTIONS.map(t => t.value)}
        courseTeeNames={courseTeeNames}
        onSave={handleSavePlayer}
      />
    </div>
  );
}

export default function RoundsPlay() {
  return (
    <AuthGuard>
      <RoundsPlayContent />
    </AuthGuard>
  );
}
