import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, MapPin, Users, Plus, ChevronDown, ChevronUp, Info, Calendar } from "lucide-react";
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
import { TeeSelector, STANDARD_TEE_OPTIONS } from "@/components/TeeSelector";
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
  const [courseTeeNames, setCourseTeeNames] = useState<Record<string, string> | null>(null);
  
  // Game Settings state
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [defaultTee, setDefaultTee] = useState("white");
  const [gameFormat, setGameFormat] = useState("stroke_play");
  
  // Player management
  const [addPlayerDialogOpen, setAddPlayerDialogOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingPlayerGroupId, setEditingPlayerGroupId] = useState<string | null>(null);
  const [playerEditSheetOpen, setPlayerEditSheetOpen] = useState(false);

  useEffect(() => {
    if (gameId && gameType) {
      fetchGameData();
    }
  }, [gameId, gameType]);

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseTees(selectedCourse.id);
    }
  }, [selectedCourse]);

  const fetchCourseTees = async (courseId: string) => {
    try {
      const { data: courseData } = await supabase
        .from("courses")
        .select("tee_names")
        .eq("id", courseId)
        .single();
      
      if (courseData?.tee_names) {
        setCourseTeeNames(courseData.tee_names as Record<string, string>);
      } else {
        setCourseTeeNames(null);
      }
    } catch (error) {
      console.error("Error fetching course tees:", error);
      setCourseTeeNames(null);
    }
  };

  const fetchGameData = async () => {
    try {
      switch (gameType) {
        case "round":
        case "skins":
          await fetchRoundData();
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
    } finally {
      setLoading(false);
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
      setDefaultTee(roundData.tee_set || "white");
      setRoundType((roundData.round_type as RoundType) || "fun_practice");
      setGameFormat(gameType === "skins" ? "skins" : "stroke_play");

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

    // Fetch players
    const { data: playersData } = await supabase
      .from("round_players")
      .select("id, user_id, handicap, tee_color, guest_name, is_guest")
      .eq("round_id", gameId);

    if (playersData && playersData.length > 0) {
      const userIds = playersData.filter(p => p.user_id).map(p => p.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, handicap")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      const players: Player[] = playersData.map(p => {
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

      setGroups([{ ...createDefaultGroup(0), players }]);
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

  const handleBack = async () => {
    await saveChanges();
    navigate(returnPath);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      switch (gameType) {
        case "round":
        case "skins":
          await saveRoundChanges();
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
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveRoundChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    const startingHole = selectedHoles === "back9" ? 10 : 1;
    
    await supabase
      .from("rounds")
      .update({
        round_name: roundName || null,
        date_played: datePlayed,
        course_name: selectedCourse?.name || "",
        holes_played: holesPlayed,
        starting_hole: startingHole,
        tee_set: defaultTee,
        round_type: roundType,
      })
      .eq("id", gameId);

    // Update player tees
    for (const group of groups) {
      for (const player of group.players) {
        await supabase
          .from("round_players")
          .update({ tee_color: player.teeColor, handicap: player.handicap })
          .eq("round_id", gameId)
          .or(`user_id.eq.${player.odId},id.eq.${player.odId}`);
      }
    }
  };

  const saveMatchPlayChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    const players = groups[0]?.players || [];
    
    await supabase
      .from("match_play_games")
      .update({
        round_name: roundName || null,
        date_played: datePlayed,
        course_name: selectedCourse?.name || "",
        holes_played: holesPlayed,
        tee_set: defaultTee,
        player_1_tee: players[0]?.teeColor || defaultTee,
        player_1_handicap: players[0]?.handicap,
        player_2_tee: players[1]?.teeColor || defaultTee,
        player_2_handicap: players[1]?.handicap,
      })
      .eq("id", gameId);
  };

  const saveBestBallChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    
    // Get current game data to preserve team structure
    const { data: currentGame } = await supabase
      .from("best_ball_games")
      .select("team_a_players, team_b_players")
      .eq("id", gameId)
      .single();

    if (currentGame) {
      const teamAPlayers = Array.isArray(currentGame.team_a_players) ? currentGame.team_a_players : [];
      const teamBPlayers = Array.isArray(currentGame.team_b_players) ? currentGame.team_b_players : [];
      const allPlayers = groups[0]?.players || [];
      
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
          team_a_players: updatedTeamA,
          team_b_players: updatedTeamB,
        })
        .eq("id", gameId);
    }
  };

  const saveCopenhagenChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    const players = groups[0]?.players || [];
    
    await supabase
      .from("copenhagen_games")
      .update({
        round_name: roundName || null,
        date_played: datePlayed,
        course_name: selectedCourse?.name || "",
        holes_played: holesPlayed,
        tee_set: defaultTee,
        player_1_tee: players[0]?.teeColor || defaultTee,
        player_1_handicap: players[0]?.handicap,
        player_2_tee: players[1]?.teeColor || defaultTee,
        player_2_handicap: players[1]?.handicap,
        player_3_tee: players[2]?.teeColor || defaultTee,
        player_3_handicap: players[2]?.handicap,
      })
      .eq("id", gameId);
  };

  const saveWolfChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    
    await supabase
      .from("wolf_games" as any)
      .update({
        round_name: roundName || null,
        date_played: datePlayed,
        course_name: selectedCourse?.name || "",
        holes_played: holesPlayed,
        tee_set: defaultTee,
      })
      .eq("id", gameId);
  };

  const saveScrambleChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    
    // Get current game data to preserve team structure
    const { data: currentGame } = await supabase
      .from("scramble_games")
      .select("teams")
      .eq("id", gameId)
      .single();

    if (currentGame) {
      const teams = Array.isArray(currentGame.teams) ? currentGame.teams : [];
      const allPlayers = groups[0]?.players || [];
      
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
          tee_set: defaultTee,
          teams: updatedTeams,
        })
        .eq("id", gameId);
    }
  };

  const saveUmbriagioChanges = async () => {
    const holesPlayed = selectedHoles === "18" ? 18 : 9;
    
    await supabase
      .from("umbriago_games")
      .update({
        round_name: roundName || null,
        date_played: datePlayed,
        course_name: selectedCourse?.name || "",
        holes_played: holesPlayed,
        tee_set: defaultTee,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="mr-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">Game Settings</h1>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4 pb-24">
        {/* Round Setup Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Round Setup</CardTitle>
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
            <div className="space-y-3">
              {groups.map((group, index) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  groupIndex={index}
                  availableTees={STANDARD_TEE_OPTIONS.map(t => t.value)}
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
                />
              ))}
            </div>
            
            <Button variant="outline" className="w-full" onClick={addGroup}>
              <Plus className="w-4 h-4 mr-2" />
              Add Group
            </Button>
          </CardContent>
        </Card>

        {/* Game Settings */}
        <Collapsible open={settingsExpanded} onOpenChange={setSettingsExpanded}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Game Settings</CardTitle>
                  {settingsExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {/* Default Tee */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Default Tee</Label>
                  <TeeSelector
                    value={defaultTee}
                    onValueChange={handleDefaultTeeChange}
                    teeCount={5}
                    courseTeeNames={courseTeeNames}
                  />
                </div>

                {/* Game Format */}
                <div className="space-y-3">
                  <Label className="text-xs">Game Format</Label>
                  
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
        availableTees={STANDARD_TEE_OPTIONS.map(t => t.value)}
        courseTeeNames={courseTeeNames}
        onSave={handleSavePlayer}
      />
    </div>
  );
}
