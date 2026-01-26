import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, MapPin, Users, Plus, ChevronDown, ChevronUp, Info, Calendar } from "lucide-react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { TeeSelector, STANDARD_TEE_OPTIONS, normalizeValue } from "@/components/TeeSelector";
import { GroupCard } from "@/components/play/GroupCard";
import { AddPlayerDialog } from "@/components/play/AddPlayerDialog";
import { PlayerEditSheet } from "@/components/play/PlayerEditSheet";
import { CourseSelectionDialog } from "@/components/CourseSelectionDialog";
import { Player, PlayerGroup, createDefaultGroup, RoundType } from "@/types/playSetup";
import { cn, parseHandicap } from "@/lib/utils";

type HoleCount = "18" | "front9" | "back9";

interface Course {
  id: string;
  name: string;
  location: string;
}

export default function GameSettingsDetail() {
  const { gameType, gameId } = useParams();
  const [searchParams] = useSearchParams();
  const returnPath = searchParams.get("returnPath") || `/rounds/${gameId}/settings`;
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Round Setup state
  const [roundName, setRoundName] = useState("");
  const [datePlayed, setDatePlayed] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedHoles, setSelectedHoles] = useState<HoleCount>("18");
  const [roundType, setRoundType] = useState<RoundType>("fun_practice");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  
  // Groups & Players state
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [groupsSnapshot, setGroupsSnapshot] = useState<PlayerGroup[]>([]); // Snapshot for rollback on error
  const [courseTeeNames, setCourseTeeNames] = useState<Record<string, string> | null>(null);
  const [availableCourseTees, setAvailableCourseTees] = useState<string[]>(STANDARD_TEE_OPTIONS.map(t => t.value));
  
  // Game Settings state
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [defaultTee, setDefaultTee] = useState("white");
  const [gameFormat, setGameFormat] = useState("stroke_play");
  
  // Use refs to always have latest values for save (avoids stale closure issues)
  const defaultTeeRef = useRef(defaultTee);
  const groupsRef = useRef(groups);
  
  // Keep refs in sync with state
  useEffect(() => { defaultTeeRef.current = defaultTee; }, [defaultTee]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  
  // Player management
  const [addPlayerDialogOpen, setAddPlayerDialogOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingPlayerGroupId, setEditingPlayerGroupId] = useState<string | null>(null);
  const [playerEditSheetOpen, setPlayerEditSheetOpen] = useState(false);

  useEffect(() => {
    if (gameId && gameType) {
      // Set loading false immediately to show UI, data will populate as it loads
      setLoading(false);
      fetchGameData();
    }
  }, [gameId, gameType]);

  useEffect(() => {
    if (selectedCourse?.id) {
      fetchCourseTees(selectedCourse.id);
    }
  }, [selectedCourse?.id]);

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

      const { data: courseData } = await supabase
        .from("courses")
        .select("tee_names")
        .eq("id", courseId)
        .single();

      const { data: holesData, error: holesError } = await supabase
        .from("course_holes")
        .select("*")
        .eq("course_id", courseId)
        .order("hole_number")
        ;

      if (holesError) throw holesError;

      const firstHole = holesData?.[0] as any;
      if (firstHole) {
        const tees: string[] = [];
        if (firstHole.black_distance) tees.push("black");
        if (firstHole.blue_distance) tees.push("blue");
        if (firstHole.white_distance) tees.push("white");
        if (firstHole.silver_distance) tees.push("silver");
        if (firstHole.gold_distance) tees.push("gold");
        if (firstHole.yellow_distance) tees.push("yellow");
        if (firstHole.red_distance) tees.push("red");
        if (firstHole.orange_distance) tees.push("orange");

        const totals: Record<string, number> = {};
        for (const tee of tees) totals[tee] = 0;
        for (const hole of (holesData || []) as any[]) {
          for (const tee of tees) {
            const col = TEE_DISTANCE_COLUMNS[tee];
            const v = col ? hole?.[col] : null;
            if (typeof v === "number" && Number.isFinite(v)) totals[tee] += v;
          }
        }
        const orderedAvailable = [...tees].sort((a, b) => (totals[b] || 0) - (totals[a] || 0));
        const allEqual = orderedAvailable.length > 1
          ? orderedAvailable.every(t => (totals[t] || 0) === (totals[orderedAvailable[0]] || 0))
          : false;
        const finalAvailable = allEqual ? STANDARD_TEE_ORDER.filter(t => tees.includes(t)) : orderedAvailable;

        setAvailableCourseTees(finalAvailable.length > 0 ? finalAvailable : STANDARD_TEE_OPTIONS.map(t => t.value));

        // Normalize tee_names from DB (object or array) and filter to available tees only
        const rawTeeNames = (courseData?.tee_names || null) as any;
        const normalizedTeeNames: Record<string, string> = {};
        if (rawTeeNames && typeof rawTeeNames === "object" && !Array.isArray(rawTeeNames)) {
          for (const [k, v] of Object.entries(rawTeeNames)) {
            if (!k) continue;
            normalizedTeeNames[String(k).toLowerCase()] = String(v);
          }
        } else if (Array.isArray(rawTeeNames)) {
          for (const v of rawTeeNames) {
            if (!v) continue;
            normalizedTeeNames[String(v).toLowerCase()] = String(v);
          }
        }

        const filteredCourseTeeNames: Record<string, string> = {};
        for (const key of (finalAvailable.length > 0 ? finalAvailable : tees)) {
          filteredCourseTeeNames[key] = normalizedTeeNames[key] || DEFAULT_TEE_LABELS[key] || key;
        }
        setCourseTeeNames(Object.keys(filteredCourseTeeNames).length > 0 ? filteredCourseTeeNames : null);

        // Apply user's preferred default tee (supports difficulty prefs like "longest") and ensure it's valid,
        // and keep players in sync.
        const preferredRaw = (defaultTee || "").toLowerCase();
        const mapped = normalizeValue(preferredRaw, finalAvailable.length > 0 ? finalAvailable : tees);
        const effective = (finalAvailable.includes(mapped) ? mapped : (finalAvailable[0] || mapped || "white"));
        if (defaultTee !== effective) {
          handleDefaultTeeChange(effective);
        }
      } else {
        setAvailableCourseTees(STANDARD_TEE_OPTIONS.map(t => t.value));
        setCourseTeeNames((courseData?.tee_names as any) || null);
      }
    } catch (error) {
      console.error("Error fetching course tees:", error);
      setCourseTeeNames(null);
      setAvailableCourseTees(STANDARD_TEE_OPTIONS.map(t => t.value));
    }
  };

  const fetchGameData = async () => {
    try {
      switch (gameType) {
        case "round":
          await fetchRoundData();
          break;
        case "skins":
          await fetchSkinsData();
          break;
        case "match-play":
          await fetchMatchPlayData();
          break;
        case "best-ball":
          await fetchBestBallData();
          break;
        case "copenhagen":
          await fetchCopenhagenData();
          break;
        case "wolf":
          await fetchWolfData();
          break;
        case "scramble":
          await fetchScrambleData();
          break;
        case "umbriago":
          await fetchUmbriagioData();
          break;
        default:
          await fetchRoundData();
      }
    } catch (error) {
      console.error("Error fetching game data:", error);
    }
  };

  const fetchRoundData = async () => {
    const { data: roundData } = await supabase
      .from("rounds")
      .select("*")
      .eq("id", gameId)
      .single();

    if (roundData) {
      setRoundName(roundData.round_name || "");
      setDatePlayed(roundData.date_played);
      setSelectedHoles(roundData.holes_played === 18 ? "18" : roundData.starting_hole === 1 ? "front9" : "back9");
      const teeValue = roundData.tee_set || "white";
      setDefaultTee(teeValue);
      defaultTeeRef.current = teeValue; // Update ref immediately
      setRoundType((roundData.round_type as RoundType) || "fun_practice");
      setGameFormat(gameType === "skins" ? "skins" : "stroke_play");

      // Fetch and count rounds by event_id
      if (roundData.event_id) {
        setEventId(roundData.event_id);
        eventIdRef.current = roundData.event_id; // Update ref immediately
        const { data: eventRounds, count } = await supabase
          .from("rounds")
          .select("*", { count: "exact" })
          .eq("event_id", roundData.event_id);
        
        if (count !== null) {
          setNumberOfRounds(count);
        } else {
          setNumberOfRounds(1);
        }
      } else {
        setEventId(null);
        eventIdRef.current = null; // Update ref immediately
        setNumberOfRounds(1);
      }

      // Fetch course by name
      const { data: courseData } = await supabase
        .from("courses")
        .select("id, name, location")
        .eq("name", roundData.course_name)
        .maybeSingle();

      if (courseData) {
        setSelectedCourse({ id: courseData.id, name: courseData.name, location: courseData.location || "" });
      } else {
        setSelectedCourse({ id: "", name: roundData.course_name, location: "" });
      }
    }

    // Fetch game groups
    const { data: gameGroups } = await supabase
      .from("game_groups")
      .select("*")
      .eq("round_id", gameId)
      .order("group_index");

    // Fetch players with group_id
    const { data: playersData } = await supabase
      .from("round_players")
      .select("id, user_id, handicap, tee_color, guest_name, is_guest, group_id")
      .eq("round_id", gameId);

    if (playersData && playersData.length > 0) {
      const userIds = playersData.filter(p => p.user_id).map(p => p.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, handicap")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      // Create a map from player identifier to group_id for efficient lookup
      const playerToGroupMap = new Map<string, string | null>();
      playersData.forEach(p => {
        const playerKey = p.user_id || p.id;
        playerToGroupMap.set(playerKey, p.group_id);
        console.log(`Loaded player ${p.user_id || p.guest_name || p.id} with group_id: ${p.group_id}`);
      });
      
      const allPlayers: Player[] = playersData.map(p => {
        const profile = p.user_id ? profilesMap.get(p.user_id) : null;
        return {
          odId: p.user_id || p.id,
          displayName: p.is_guest ? (p.guest_name || "Guest") : (profile?.display_name || profile?.username || "Player"),
          username: profile?.username || "",
          avatarUrl: profile?.avatar_url || undefined,
          teeColor: p.tee_color || defaultTee,
          handicap: p.handicap ?? parseHandicap(profile?.handicap),
          isTemporary: p.is_guest || false,
        };
      });

      // Reconstruct groups from database
      if (gameGroups && gameGroups.length > 0) {
        console.log(`Loading ${gameGroups.length} groups from database:`, gameGroups.map(gg => ({ id: gg.id, name: gg.group_name })));
        // Multiple groups exist - organize players by group_id
        const reconstructedGroups: PlayerGroup[] = gameGroups.map((gg, idx) => {
          const groupPlayers = allPlayers.filter(p => {
            const playerGroupId = playerToGroupMap.get(p.odId);
            const matches = playerGroupId === gg.id;
            if (matches) {
              console.log(`Assigning player ${p.displayName} to group ${gg.group_name} (id: ${gg.id})`);
            }
            return matches;
          });
          
          console.log(`Group ${gg.group_name} (id: ${gg.id}) has ${groupPlayers.length} players`);
          
          return {
            id: gg.id,
            name: gg.group_name || `Group ${String.fromCharCode(65 + idx)}`,
            players: groupPlayers,
            startingHole: gg.starting_hole || undefined,
            teeTime: gg.tee_time || undefined,
          };
        });
        
        // Find players without a group_id and assign them to the first group
        const playersWithoutGroup = allPlayers.filter(p => {
          const playerGroupId = playerToGroupMap.get(p.odId);
          return !playerGroupId;
        });
        
        // Add unassigned players to the first group
        if (playersWithoutGroup.length > 0 && reconstructedGroups.length > 0) {
          reconstructedGroups[0].players = [...reconstructedGroups[0].players, ...playersWithoutGroup];
        }
        
        setGroups(reconstructedGroups);
        setGroupsSnapshot(JSON.parse(JSON.stringify(reconstructedGroups))); // Initialize snapshot
      } else {
        // No groups exist (single group case) - put all players in one group
        const singleGroup = [{ ...createDefaultGroup(0), players: allPlayers }];
        setGroups(singleGroup);
        setGroupsSnapshot(JSON.parse(JSON.stringify(singleGroup))); // Initialize snapshot
      }
    } else {
      // No players - create empty default group
      const emptyGroup = [createDefaultGroup(0)];
      setGroups(emptyGroup);
      setGroupsSnapshot(JSON.parse(JSON.stringify(emptyGroup))); // Initialize snapshot
    }
  };

  const fetchSkinsData = async () => {
    const { data: skinsData } = await supabase
      .from("skins_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (skinsData) {
      setRoundName(skinsData.round_name || "");
      setDatePlayed(skinsData.date_played);
      setSelectedHoles(skinsData.holes_played === 18 ? "18" : "front9");
      setGameFormat("skins");

      // Fetch course by name or id
      let courseData = null;
      if (skinsData.course_id) {
        const { data } = await supabase
          .from("courses")
          .select("id, name, location")
          .eq("id", skinsData.course_id)
          .maybeSingle();
        courseData = data;
      } else if (skinsData.course_name) {
        const { data } = await supabase
          .from("courses")
          .select("id, name, location")
          .eq("name", skinsData.course_name)
          .maybeSingle();
        courseData = data;
      }

      if (courseData) {
        setSelectedCourse({ id: courseData.id, name: courseData.name, location: courseData.location || "" });
      } else {
        setSelectedCourse({ id: "", name: skinsData.course_name, location: "" });
      }

      // Parse players from JSON
      const rawPlayers = skinsData.players;
      const parsedPlayers: Player[] = Array.isArray(rawPlayers) 
        ? rawPlayers.map((p: any) => ({
            odId: p.odId || p.id || p.name,
            displayName: p.displayName || p.name || 'Player',
            username: p.username || "",
            avatarUrl: p.avatarUrl || undefined,
            teeColor: p.tee || p.teeColor || "white",
            handicap: p.handicap,
            isTemporary: p.isGuest || false,
          }))
        : [];
      
      if (parsedPlayers.length > 0) {
        setDefaultTee(parsedPlayers[0].teeColor || "white");
      }
      
      setGroups([{ ...createDefaultGroup(0), players: parsedPlayers }]);
    } else {
      setGroups([createDefaultGroup(0)]);
    }
  };

  const fetchMatchPlayData = async () => {
    const { data } = await supabase
      .from("match_play_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      setRoundName(data.round_name || "");
      setDatePlayed(data.date_played);
      setSelectedHoles(data.holes_played === 18 ? "18" : "front9");
      setDefaultTee(data.tee_set || "white");
      setGameFormat("match_play");

      const { data: courseData } = await supabase
        .from("courses")
        .select("id, name, location")
        .eq("name", data.course_name)
        .maybeSingle();

      if (courseData) {
        setSelectedCourse({ id: courseData.id, name: courseData.name, location: courseData.location || "" });
      } else {
        setSelectedCourse({ id: "", name: data.course_name, location: "" });
      }

      const players: Player[] = [
        { odId: "player1", displayName: data.player_1, username: "", teeColor: data.player_1_tee || defaultTee, handicap: data.player_1_handicap, isTemporary: false },
        { odId: "player2", displayName: data.player_2, username: "", teeColor: data.player_2_tee || defaultTee, handicap: data.player_2_handicap, isTemporary: false },
      ];
      setGroups([{ ...createDefaultGroup(0), players }]);
    }
  };

  const fetchBestBallData = async () => {
    const { data } = await supabase
      .from("best_ball_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      setRoundName(data.round_name || "");
      setDatePlayed(data.date_played);
      setSelectedHoles(data.holes_played === 18 ? "18" : "front9");
      
      const teamAPlayersData = Array.isArray(data.team_a_players) ? data.team_a_players : [];
      const teamBPlayersData = Array.isArray(data.team_b_players) ? data.team_b_players : [];
      // Extract tee from first player if available, otherwise use default
      const firstPlayerTee = (teamAPlayersData[0] as any)?.teeColor || (teamBPlayersData[0] as any)?.teeColor || "white";
      setDefaultTee(firstPlayerTee);
      setGameFormat("best_ball");

      const { data: courseData } = await supabase
        .from("courses")
        .select("id, name, location")
        .eq("name", data.course_name)
        .maybeSingle();

      if (courseData) {
        setSelectedCourse({ id: courseData.id, name: courseData.name, location: courseData.location || "" });
      } else {
        setSelectedCourse({ id: "", name: data.course_name, location: "" });
      }
      
      const allPlayers: Player[] = [
        ...teamAPlayersData.map((p: any) => ({ odId: p.odId || p.id, displayName: p.displayName, username: "", teeColor: p.teeColor || firstPlayerTee, handicap: p.handicap, isTemporary: false })),
        ...teamBPlayersData.map((p: any) => ({ odId: p.odId || p.id, displayName: p.displayName, username: "", teeColor: p.teeColor || firstPlayerTee, handicap: p.handicap, isTemporary: false })),
      ];
      setGroups([{ ...createDefaultGroup(0), players: allPlayers }]);
    }
  };

  const fetchCopenhagenData = async () => {
    const { data } = await supabase
      .from("copenhagen_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      setRoundName(data.round_name || "");
      setDatePlayed(data.date_played);
      setSelectedHoles(data.holes_played === 18 ? "18" : "front9");
      setDefaultTee(data.tee_set || "white");
      setGameFormat("copenhagen");

      const { data: courseData } = await supabase
        .from("courses")
        .select("id, name, location")
        .eq("name", data.course_name)
        .maybeSingle();

      if (courseData) {
        setSelectedCourse({ id: courseData.id, name: courseData.name, location: courseData.location || "" });
      } else {
        setSelectedCourse({ id: "", name: data.course_name, location: "" });
      }

      const players: Player[] = [
        { odId: "player1", displayName: data.player_1, username: "", teeColor: data.player_1_tee || defaultTee, handicap: data.player_1_handicap, isTemporary: false },
        { odId: "player2", displayName: data.player_2, username: "", teeColor: data.player_2_tee || defaultTee, handicap: data.player_2_handicap, isTemporary: false },
        { odId: "player3", displayName: data.player_3, username: "", teeColor: data.player_3_tee || defaultTee, handicap: data.player_3_handicap, isTemporary: false },
      ];
      setGroups([{ ...createDefaultGroup(0), players }]);
    }
  };

  const fetchWolfData = async () => {
    const { data } = await supabase
      .from("wolf_games" as any)
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      const wolfData = data as any;
      setRoundName(wolfData.round_name || "");
      setDatePlayed(wolfData.date_played);
      setSelectedHoles(wolfData.holes_played === 18 ? "18" : "front9");
      setDefaultTee(wolfData.tee_set || "white");
      setGameFormat("wolf");

      const { data: courseData } = await supabase
        .from("courses")
        .select("id, name, location")
        .eq("name", wolfData.course_name)
        .maybeSingle();

      if (courseData) {
        setSelectedCourse({ id: courseData.id, name: courseData.name, location: courseData.location || "" });
      } else {
        setSelectedCourse({ id: "", name: wolfData.course_name, location: "" });
      }

      const playerNames = [wolfData.player_1, wolfData.player_2, wolfData.player_3, wolfData.player_4, wolfData.player_5].filter(Boolean);
      const players: Player[] = playerNames.map((name: string, idx: number) => ({
        odId: `player${idx + 1}`,
        displayName: name,
        username: "",
        teeColor: defaultTee,
        isTemporary: false,
      }));
      setGroups([{ ...createDefaultGroup(0), players }]);
    }
  };

  const fetchScrambleData = async () => {
    const { data } = await supabase
      .from("scramble_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      setRoundName(data.round_name || "");
      setDatePlayed(data.date_played);
      setSelectedHoles(data.holes_played === 18 ? "18" : "front9");
      setDefaultTee(data.tee_set || "white");
      setGameFormat("scramble");

      const { data: courseData } = await supabase
        .from("courses")
        .select("id, name, location")
        .eq("name", data.course_name)
        .maybeSingle();

      if (courseData) {
        setSelectedCourse({ id: courseData.id, name: courseData.name, location: courseData.location || "" });
      } else {
        setSelectedCourse({ id: "", name: data.course_name, location: "" });
      }

      const teams = Array.isArray(data.teams) ? data.teams : [];
      const allPlayers: Player[] = teams.flatMap((team: any) => 
        team.players?.map((p: any) => ({ odId: p.id || p.odId, displayName: p.name, username: "", teeColor: p.tee || defaultTee, handicap: p.handicap, isTemporary: false })) || []
      );
      setGroups([{ ...createDefaultGroup(0), players: allPlayers }]);
    }
  };

  const fetchUmbriagioData = async () => {
    const { data } = await supabase
      .from("umbriago_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      setRoundName(data.round_name || "");
      setDatePlayed(data.date_played);
      setSelectedHoles(data.holes_played === 18 ? "18" : "front9");
      setDefaultTee(data.tee_set || "white");
      setGameFormat("umbriago");

      const { data: courseData } = await supabase
        .from("courses")
        .select("id, name, location")
        .eq("name", data.course_name)
        .maybeSingle();

      if (courseData) {
        setSelectedCourse({ id: courseData.id, name: courseData.name, location: courseData.location || "" });
      } else {
        setSelectedCourse({ id: "", name: data.course_name, location: "" });
      }

      const players: Player[] = [
        { odId: "teamA1", displayName: data.team_a_player_1, username: "", teeColor: defaultTee, isTemporary: false },
        { odId: "teamA2", displayName: data.team_a_player_2, username: "", teeColor: defaultTee, isTemporary: false },
        { odId: "teamB1", displayName: data.team_b_player_1, username: "", teeColor: defaultTee, isTemporary: false },
        { odId: "teamB2", displayName: data.team_b_player_2, username: "", teeColor: defaultTee, isTemporary: false },
      ];
      setGroups([{ ...createDefaultGroup(0), players }]);
    }
  };

  const handleBack = () => {
    // Navigate immediately
    navigate(returnPath);
    
    // Save changes in the background (don't await)
    (async () => {
      try {
        await saveChanges();
      } catch (error) {
        // Error already handled in saveChanges with toast
        console.error("Background save error:", error);
      }
    })();
  };

  const saveChanges = async () => {
    setSaving(true);
    // Create snapshot for rollback on error
    setGroupsSnapshot(JSON.parse(JSON.stringify(groups)));
    
    try {
      switch (gameType) {
        case "round":
          await saveRoundChanges();
          break;
        case "skins":
          await saveSkinsChanges();
          break;
        case "match-play":
          await saveMatchPlayChanges();
          break;
        case "best-ball":
          await saveBestBallChanges();
          break;
        case "copenhagen":
          await saveCopenhagenChanges();
          break;
        case "wolf":
          await saveWolfChanges();
          break;
        case "scramble":
          await saveScrambleChanges();
          break;
        case "umbriago":
          await saveUmbriagioChanges();
          break;
      }
      // After successful save, refetch data from DB to ensure state is in sync
      await fetchGameData();
      toast({ title: "Success", description: "Changes saved successfully" });
    } catch (error: any) {
      console.error("Error saving changes:", error);
      // Rollback to snapshot on error
      setGroups(groupsSnapshot);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to save changes. Changes have been reverted.", 
        variant: "destructive" 
      });
      throw error; // Re-throw to allow caller to handle
    } finally {
      setSaving(false);
    }
  };

  const saveRoundChanges = async () => {
    try {
      const holesPlayed = selectedHoles === "18" ? 18 : 9;
      const startingHole = selectedHoles === "back9" ? 10 : 1;
      const currentDefaultTee = defaultTeeRef.current;
      const currentGroups = groupsRef.current;
      const currentEventId = eventIdRef.current;
      
      const { error: roundUpdateError } = await supabase
        .from("rounds")
        .update({
          round_name: roundName || null,
          date_played: datePlayed,
          course_name: selectedCourse?.name || "",
          holes_played: holesPlayed,
          starting_hole: startingHole,
          tee_set: currentDefaultTee,
          round_type: roundType,
          event_id: currentEventId,
        })
        .eq("id", gameId);

      if (roundUpdateError) {
        console.error("Error updating round:", roundUpdateError);
        throw roundUpdateError;
      }

    // Fetch existing game groups
    const { data: existingGroups } = await supabase
      .from("game_groups")
      .select("id")
      .eq("round_id", gameId);

    const existingGroupIds = new Set(existingGroups?.map(g => g.id) || []);
    const hasMultipleGroups = currentGroups.length > 1;

    console.log(`Saving ${currentGroups.length} groups. hasMultipleGroups: ${hasMultipleGroups}`);
    console.log('Current groups:', currentGroups.map((g, i) => ({ index: i, name: g.name, id: g.id, playerCount: g.players.length })));

    // Map to store groupId for each group index
    const groupIdByIndex = new Map<number, string | null>();

    // First pass: Update/create groups and store their IDs
    for (let i = 0; i < currentGroups.length; i++) {
      const group = currentGroups[i];
      let gameGroupId: string | null = null;

      if (hasMultipleGroups) {
        // Multiple groups - create or update game_groups entry
        if (group.id && existingGroupIds.has(group.id)) {
          // Update existing group
          const { data: updatedGroup, error: updateError } = await supabase
            .from("game_groups")
            .update({
              group_name: group.name,
              group_index: i,
              starting_hole: group.startingHole || null,
              tee_time: group.teeTime || null,
            })
            .eq("id", group.id)
            .select()
            .single();
          
          if (updateError) {
            console.error("Error updating group:", updateError, { groupId: group.id, groupName: group.name });
            throw updateError;
          }
          
          if (!updatedGroup) {
            throw new Error(`Failed to update group: ${group.name}`);
          }
          
          gameGroupId = updatedGroup.id;
          console.log(`Updated group ${group.name} (index ${i}) with id: ${gameGroupId}`);
        } else {
          // Create new group
          const { data: newGroup, error: insertError } = await supabase
            .from("game_groups")
            .insert({
              round_id: gameId,
              group_name: group.name,
              group_index: i,
              starting_hole: group.startingHole || null,
              tee_time: group.teeTime || null,
            })
            .select()
            .single();
          
          if (insertError) {
            console.error("Error creating group:", insertError, { groupName: group.name, groupIndex: i });
            throw insertError;
          }
          
          if (!newGroup) {
            throw new Error(`Failed to create group: ${group.name}`);
          }
          
          gameGroupId = newGroup.id;
          console.log(`Created new group ${group.name} (index ${i}) with id: ${gameGroupId}`);
        }
      }
      // If single group, gameGroupId remains null (no game_groups entry needed)
      groupIdByIndex.set(i, gameGroupId);
    }

    // Validate that all groups have valid IDs when in multiple groups mode
    if (hasMultipleGroups) {
      for (let i = 0; i < currentGroups.length; i++) {
        const gameGroupId = groupIdByIndex.get(i);
        if (!gameGroupId) {
          const groupName = currentGroups[i]?.name || `Group ${i + 1}`;
          console.error(`Group at index ${i} (${groupName}) does not have a valid ID`);
          throw new Error(`Failed to create/update group: ${groupName}. Please try again.`);
        }
      }
    }

    // Fetch all existing players for this round to track what needs to be inserted/updated/deleted
    const { data: existingPlayers } = await supabase
      .from("round_players")
      .select("id, user_id, is_guest, guest_name")
      .eq("round_id", gameId);

    // Create maps for quick lookup
    // Map by user_id for registered players
    const existingPlayersByUserId = new Map<string, typeof existingPlayers[0]>();
    // Map by id for guest players (odId matches the round_players.id for guests)
    const existingPlayersById = new Map<string, typeof existingPlayers[0]>();
    
    (existingPlayers || []).forEach(p => {
      if (p.user_id) {
        existingPlayersByUserId.set(p.user_id, p);
      }
      existingPlayersById.set(p.id, p);
    });

    // Track which players from DB are still in state (to identify deletions)
    const playersInState = new Set<string>();

    // Process all players from all groups
    for (let i = 0; i < currentGroups.length; i++) {
      const group = currentGroups[i];
      const gameGroupId = groupIdByIndex.get(i) || null;

      // Process each player in this group
      for (const player of group.players) {
        let existingPlayer: typeof existingPlayers[0] | undefined;
        
        // Try to find existing player
        // For registered players: match by user_id
        if (!player.isTemporary && player.odId) {
          existingPlayer = existingPlayersByUserId.get(player.odId);
        }
        // For guest players: odId is the round_players.id
        if (!existingPlayer && player.isTemporary) {
          existingPlayer = existingPlayersById.get(player.odId);
        }

        if (existingPlayer) {
          // UPDATE existing player
          playersInState.add(existingPlayer.id);
          console.log(`Updating player ${player.displayName} (${player.odId}) in group ${i} (${group.name}) with group_id: ${gameGroupId}`);
          const { error: updateError } = await supabase
            .from("round_players")
            .update({ 
              tee_color: player.teeColor, 
              handicap: player.handicap,
              group_id: gameGroupId,
            })
            .eq("id", existingPlayer.id);
          
          if (updateError) {
            console.error("Error updating player:", updateError, { playerId: existingPlayer.id, playerOdId: player.odId, teeColor: player.teeColor, groupId: gameGroupId });
            throw updateError;
          }
        } else {
          // INSERT new player
          if (player.isTemporary) {
            // Guest player
            console.log(`Inserting guest player ${player.displayName} in group ${i} (${group.name}) with group_id: ${gameGroupId}`);
            const { data: newPlayer, error: insertError } = await supabase
              .from("round_players")
              .insert({
                round_id: gameId,
                user_id: null,
                is_guest: true,
                guest_name: player.displayName,
                tee_color: player.teeColor,
                handicap: player.handicap,
                group_id: gameGroupId,
              })
              .select()
              .single();
            
            if (insertError) {
              console.error("Error inserting guest player:", insertError, { groupId: gameGroupId });
              throw insertError;
            }
            
            if (newPlayer) {
              playersInState.add(newPlayer.id);
              // Update player's odId in state to match database ID for future saves
              // Note: This doesn't update the current groups state, but that's okay
              // since we're about to navigate away. The next time the page loads,
              // the player will have the correct ID from the database.
            }
          } else {
            // Registered player
            console.log(`Inserting registered player ${player.displayName} (${player.odId}) in group ${i} (${group.name}) with group_id: ${gameGroupId}`);
            const { data: newPlayer, error: insertError } = await supabase
              .from("round_players")
              .insert({
                round_id: gameId,
                user_id: player.odId,
                is_guest: false,
                tee_color: player.teeColor,
                handicap: player.handicap,
                group_id: gameGroupId,
              })
              .select()
              .single();
            
            if (insertError) {
              console.error("Error inserting registered player:", insertError, { playerOdId: player.odId, teeColor: player.teeColor });
              throw insertError;
            }
            
            if (newPlayer) {
              playersInState.add(newPlayer.id);
            }
          }
        }
      }
    }

    // DELETE players that are in DB but not in state
    const playersToDelete = (existingPlayers || []).filter(p => !playersInState.has(p.id));
    if (playersToDelete.length > 0) {
      const idsToDelete = playersToDelete.map(p => p.id);
      const { error: deleteError } = await supabase
        .from("round_players")
        .delete()
        .in("id", idsToDelete);
      
      if (deleteError) {
        console.error("Error deleting players:", deleteError);
        throw deleteError;
      }
    }

    // Delete groups that no longer exist
    // Only delete groups that are explicitly removed (exist in DB but not in current state)
    // Don't delete all groups just because current state shows 1 group - preserve existing groups
    // 
    // Key fix: Only delete groups if we're in "multiple groups mode" (hasMultipleGroups = true)
    // OR if we're explicitly transitioning from multiple to single (had groups before, now have 1)
    // This prevents accidental deletion when state incorrectly shows 1 group due to loading issues
    if (hasMultipleGroups) {
      // Multiple groups mode - delete groups that are no longer in current state
      const currentGroupIds = new Set(
        currentGroups
          .map(g => g.id)
          .filter((id): id is string => id !== undefined && existingGroupIds.has(id))
      );

      for (const existingId of existingGroupIds) {
        if (!currentGroupIds.has(existingId)) {
          await supabase
            .from("game_groups")
            .delete()
            .eq("id", existingId);
        }
      }
    } else {
      // Single group mode
      // Only delete all groups if:
      // 1. We had groups before (existingGroupIds.size > 0), AND
      // 2. The current single group doesn't have an ID that matches any existing group
      // This means the user explicitly consolidated groups
      const currentGroupHasId = currentGroups.length > 0 && 
        currentGroups[0]?.id && 
        existingGroupIds.has(currentGroups[0].id);
      
      // If we had multiple groups before and now have 1, and that 1 group doesn't match
      // any existing group, then user consolidated - delete all groups
      // Otherwise, preserve existing groups (they might be needed if state is incorrect)
      if (existingGroupIds.size > 1 && !currentGroupHasId) {
        // User explicitly consolidated from multiple to single - delete all groups
        await supabase
          .from("game_groups")
          .delete()
          .eq("round_id", gameId);
      }
      // If existingGroupIds.size <= 1, we never had multiple groups, so nothing to delete
      // If currentGroupHasId is true, the single group matches an existing group, so preserve it
    }
    } catch (error: any) {
      console.error("Error in saveRoundChanges:", error);
      throw error; // Re-throw to be caught by saveChanges wrapper
    }
  };

  const saveSkinsChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    const currentGroups = groupsRef.current;
    const allPlayers = currentGroups[0]?.players || [];
    
    // Format players for skins_games JSON
    const playersJson = allPlayers.map(p => ({
      odId: p.odId,
      name: p.displayName,
      displayName: p.displayName,
      handicap: p.handicap,
      tee: p.teeColor,
      avatarUrl: p.avatarUrl,
      isGuest: p.isTemporary,
    }));

    await supabase
      .from("skins_games")
      .update({
        round_name: roundName || null,
        date_played: datePlayed,
        course_name: selectedCourse?.name || "",
        course_id: selectedCourse?.id || null,
        holes_played: holesPlayed,
        players: playersJson,
      })
      .eq("id", gameId);
  };

  const saveMatchPlayChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    // Use refs to get latest values (avoids stale closure)
    const currentGroups = groupsRef.current;
    const currentDefaultTee = defaultTeeRef.current;
    const players = currentGroups[0]?.players || [];
    
    // Get player tees, falling back to defaultTee if not set
    const player1Tee = players[0]?.teeColor || currentDefaultTee;
    const player2Tee = players[1]?.teeColor || currentDefaultTee;
    
    await supabase
      .from("match_play_games")
      .update({
        round_name: roundName || null,
        date_played: datePlayed,
        course_name: selectedCourse?.name || "",
        holes_played: holesPlayed,
        tee_set: currentDefaultTee,
        player_1: players[0]?.displayName,
        player_1_tee: player1Tee,
        player_1_handicap: players[0]?.handicap,
        player_2: players[1]?.displayName,
        player_2_tee: player2Tee,
        player_2_handicap: players[1]?.handicap,
      })
      .eq("id", gameId);
  };

  const saveBestBallChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    const currentGroups = groupsRef.current;
    const currentDefaultTee = defaultTeeRef.current;
    
    // Get current game data to preserve team structure
    const { data: currentGame } = await supabase
      .from("best_ball_games")
      .select("team_a_players, team_b_players")
      .eq("id", gameId)
      .single();

    if (currentGame) {
      const teamAPlayers = Array.isArray(currentGame.team_a_players) ? currentGame.team_a_players : [];
      const teamBPlayers = Array.isArray(currentGame.team_b_players) ? currentGame.team_b_players : [];
      const allPlayers = currentGroups[0]?.players || [];
      
      // Update tees in existing team structures
      const updatedTeamA = teamAPlayers.map((p: any) => {
        const updated = allPlayers.find(ap => ap.odId === p.odId || ap.odId === p.id);
        return updated ? { ...p, teeColor: updated.teeColor, handicap: updated.handicap } : p;
      });
      const updatedTeamB = teamBPlayers.map((p: any) => {
        const updated = allPlayers.find(ap => ap.odId === p.odId || ap.odId === p.id);
        return updated ? { ...p, teeColor: updated.teeColor, handicap: updated.handicap } : p;
      });

      await supabase
        .from("best_ball_games")
        .update({
          round_name: roundName || null,
          date_played: datePlayed,
          course_name: selectedCourse?.name || "",
          holes_played: holesPlayed,
          tee_set: currentDefaultTee,
          team_a_players: updatedTeamA,
          team_b_players: updatedTeamB,
        })
        .eq("id", gameId);
    }
  };

  const saveCopenhagenChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    const currentGroups = groupsRef.current;
    const currentDefaultTee = defaultTeeRef.current;
    const players = currentGroups[0]?.players || [];
    
    await supabase
      .from("copenhagen_games")
      .update({
        round_name: roundName || null,
        date_played: datePlayed,
        course_name: selectedCourse?.name || "",
        holes_played: holesPlayed,
        tee_set: currentDefaultTee,
        player_1_tee: players[0]?.teeColor || currentDefaultTee,
        player_1_handicap: players[0]?.handicap,
        player_2_tee: players[1]?.teeColor || currentDefaultTee,
        player_2_handicap: players[1]?.handicap,
        player_3_tee: players[2]?.teeColor || currentDefaultTee,
        player_3_handicap: players[2]?.handicap,
      })
      .eq("id", gameId);
  };

  const saveWolfChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    const currentDefaultTee = defaultTeeRef.current;
    
    await supabase
      .from("wolf_games" as any)
      .update({
        round_name: roundName || null,
        date_played: datePlayed,
        course_name: selectedCourse?.name || "",
        holes_played: holesPlayed,
        tee_set: currentDefaultTee,
      })
      .eq("id", gameId);
  };

  const saveScrambleChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    const currentDefaultTee = defaultTeeRef.current;
    const currentGroups = groupsRef.current;
    
    // Get current game data to preserve team structure
    const { data: currentGame } = await supabase
      .from("scramble_games")
      .select("teams")
      .eq("id", gameId)
      .single();

    if (currentGame) {
      const teams = Array.isArray(currentGame.teams) ? currentGame.teams : [];
      const allPlayers = currentGroups[0]?.players || [];
      
      // Update tees in existing team structures
      const updatedTeams = teams.map((team: any) => ({
        ...team,
        players: team.players?.map((p: any) => {
          const updated = allPlayers.find(ap => ap.odId === p.id || ap.odId === p.odId);
          return updated ? { ...p, tee: updated.teeColor, handicap: updated.handicap } : p;
        }) || []
      }));

      await supabase
        .from("scramble_games")
        .update({
          round_name: roundName || null,
          date_played: datePlayed,
          course_name: selectedCourse?.name || "",
          holes_played: holesPlayed,
          tee_set: currentDefaultTee,
          teams: updatedTeams,
        })
        .eq("id", gameId);
    }
  };

  const saveUmbriagioChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    const currentDefaultTee = defaultTeeRef.current;
    
    await supabase
      .from("umbriago_games")
      .update({
        round_name: roundName || null,
        date_played: datePlayed,
        course_name: selectedCourse?.name || "",
        holes_played: holesPlayed,
        tee_set: currentDefaultTee,
      })
      .eq("id", gameId);
  };

  // Group management
  const addGroup = () => {
    setGroups(prev => [...prev, createDefaultGroup(prev.length)]);
  };

  const updateGroupName = (groupId: string, name: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g));
  };

  const deleteGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const addPlayerToGroup = (groupId: string, player: Player) => {
    player.teeColor = player.teeColor || defaultTee;
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, players: [...g.players, player] } : g
    ));
    setAddPlayerDialogOpen(false);
  };

  const removePlayerFromGroup = (groupId: string, playerId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, players: g.players.filter(p => p.odId !== playerId) } : g
    ));
  };

  const updatePlayerTee = (groupId: string, playerId: string, tee: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, players: g.players.map(p => p.odId === playerId ? { ...p, teeColor: tee } : p) }
        : g
    ));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceGroupId = result.source.droppableId;
    const destGroupId = result.destination.droppableId;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceGroupId === destGroupId) {
      // Reorder within same group
      setGroups(prev => prev.map(g => {
        if (g.id !== sourceGroupId) return g;
        const newPlayers = [...g.players];
        const [removed] = newPlayers.splice(sourceIndex, 1);
        newPlayers.splice(destIndex, 0, removed);
        return { ...g, players: newPlayers };
      }));
    } else {
      // Move player between groups
      setGroups(prev => {
        const sourceGroup = prev.find(g => g.id === sourceGroupId);
        if (!sourceGroup) return prev;

        const player = sourceGroup.players[sourceIndex];
        if (!player) return prev;

        return prev.map(g => {
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
        });
      });
    }
  };

  const handlePlayerClick = (groupId: string, player: Player) => {
    setEditingPlayer(player);
    setEditingPlayerGroupId(groupId);
    setPlayerEditSheetOpen(true);
  };

  const handleSavePlayer = (updatedPlayer: Player) => {
    if (!editingPlayerGroupId) return;
    setGroups(prev => prev.map(g =>
      g.id === editingPlayerGroupId
        ? { ...g, players: g.players.map(p => p.odId === updatedPlayer.odId ? updatedPlayer : p) }
        : g
    ));
  };

  const handleDefaultTeeChange = (tee: string) => {
    setDefaultTee(tee);
    setGroups(prev => prev.map(g => ({
      ...g,
      players: g.players.map(p => ({ ...p, teeColor: tee }))
    })));
  };

  const getTotalPlayers = () => {
    return groups.reduce((sum, g) => sum + g.players.length, 0);
  };

  const getAllPlayerIds = () => {
    return groups.flatMap(g => g.players.map(p => p.odId));
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="mr-2"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-lg font-semibold">Game Formats</h1>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4 pb-24">
        {/* Round Setup Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Create Game</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Round Name & Date Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Round Name</Label>
                <Input
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value)}
                  placeholder="Round 1"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(new Date(datePlayed + 'T12:00:00'), "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={new Date(datePlayed + 'T12:00:00')}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          setDatePlayed(`${year}-${month}-${day}`);
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
                value={defaultTee}
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
                    onClick={() => setSelectedHoles(holes)}
                    className={cn(
                      "p-2.5 rounded-lg border-2 text-center transition-all text-sm font-medium",
                      selectedHoles === holes
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
                value={roundType} 
                onValueChange={(v) => setRoundType(v as RoundType)}
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
                {groups.map((group, index) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    groupIndex={index}
                    availableTees={selectedCourse ? availableCourseTees : STANDARD_TEE_OPTIONS.map(t => t.value)}
                    courseTeeNames={courseTeeNames}
                    canDelete={groups.length > 1}
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
                          onClick={() => setGameFormat(fmt.id)}
                          className={cn(
                            "w-full p-3 rounded-lg border-2 text-left transition-all pr-12",
                            gameFormat === fmt.id
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
                          onClick={() => setGameFormat(fmt.id)}
                          className={cn(
                            "w-full p-3 rounded-lg border-2 text-left transition-all pr-12",
                            gameFormat === fmt.id
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
      </div>

      {/* Dialogs */}
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
        defaultTee={defaultTee}
      />

      <PlayerEditSheet
        isOpen={playerEditSheetOpen}
        onClose={() => {
          setPlayerEditSheetOpen(false);
          setEditingPlayer(null);
          setEditingPlayerGroupId(null);
        }}
        player={editingPlayer}
        availableTees={selectedCourse ? availableCourseTees : STANDARD_TEE_OPTIONS.map(t => t.value)}
        courseTeeNames={courseTeeNames}
        onSave={handleSavePlayer}
      />
    </div>
  );
}
