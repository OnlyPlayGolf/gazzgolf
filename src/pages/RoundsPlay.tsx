import { useState, useEffect } from "react";
import { Info, Sparkles, Calendar, MapPin, Users, Plus, ChevronDown, ChevronUp } from "lucide-react";
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
import { PlaySetupState, PlayerGroup, Player, createDefaultGroup, getInitialPlaySetupState } from "@/types/playSetup";
import { cn, parseHandicap } from "@/lib/utils";

type HoleCount = "18" | "front9" | "back9";

interface Course {
  id: string;
  name: string;
  location: string;
}

export default function RoundsPlay() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Core state
  const [setupState, setSetupState] = useState<PlaySetupState>(getInitialPlaySetupState());
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availableTees, setAvailableTees] = useState<string[]>([]);
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

  useEffect(() => {
    initializeSetup();
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

  const initializeSetup = async () => {
    // Fetch current user
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setCurrentUser(profile);
      
      // Add current user to first group
      if (profile) {
        const currentUserPlayer: Player = {
          odId: user.id,
          teeColor: "",
          displayName: profile.display_name || profile.username || "You",
          username: profile.username || "",
          avatarUrl: profile.avatar_url,
          handicap: parseHandicap(profile.handicap),
          isTemporary: false,
        };
        
        setSetupState(prev => ({
          ...prev,
          groups: [{
            ...prev.groups[0],
            players: [currentUserPlayer]
          }]
        }));
      }
    }

    // Fetch round count for default name
    fetchRoundCount();
    
    // Restore saved state
    restoreSavedState();
  };

  const fetchRoundCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from("rounds")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const savedRoundName = sessionStorage.getItem('roundName');
      if (!savedRoundName) {
        setSetupState(prev => ({ ...prev, roundName: `Round ${(count || 0) + 1}` }));
      }
    } catch (error) {
      console.error("Error fetching round count:", error);
    }
  };

  const restoreSavedState = () => {
    const savedCourse = sessionStorage.getItem('selectedCourse');
    const savedHoles = sessionStorage.getItem('selectedHoles');
    const savedRoundName = sessionStorage.getItem('roundName');
    const savedDate = sessionStorage.getItem('datePlayer');
    const savedGroups = sessionStorage.getItem('playGroups');
    const savedAIConfig = sessionStorage.getItem('aiGameConfig');
    const savedGameFormat = sessionStorage.getItem('gameFormat');

    if (savedCourse) setSelectedCourse(JSON.parse(savedCourse));
    
    setSetupState(prev => {
      const updated = { ...prev };
      if (savedHoles) updated.selectedHoles = savedHoles as HoleCount;
      if (savedRoundName) updated.roundName = savedRoundName;
      if (savedDate) updated.datePlayed = savedDate;
      if (savedGroups) updated.groups = JSON.parse(savedGroups);
      if (savedGameFormat) updated.gameFormat = savedGameFormat as any;
      if (savedAIConfig) {
        const config = JSON.parse(savedAIConfig);
        updated.aiConfigApplied = true;
        updated.aiAssumptions = config.assumptions;
        updated.aiConfigSummary = `${config.baseFormat?.replace('_', ' ')} with ${config.totalHoles} holes`;
      }
      return updated;
    });
  };

  const fetchCourseTees = async (courseId: string) => {
    try {
      const { data, error } = await supabase
        .from("course_holes")
        .select("*")
        .eq("course_id", courseId)
        .order("hole_number");

      if (error) throw error;

      if (data && data.length > 0) {
        const firstHole = data[0];
        const tees: string[] = [];
        if (firstHole.white_distance) tees.push("White");
        if (firstHole.yellow_distance) tees.push("Yellow");
        if (firstHole.blue_distance) tees.push("Blue");
        if (firstHole.red_distance) tees.push("Red");
        if (firstHole.orange_distance) tees.push("Orange");

        setAvailableTees(tees);
        
        // Update default tee for all players
        if (tees.length > 0 && !setupState.teeColor) {
          setSetupState(prev => ({
            ...prev,
            teeColor: tees[0],
            groups: prev.groups.map(g => ({
              ...g,
              players: g.players.map(p => ({ ...p, teeColor: p.teeColor || tees[0] }))
            }))
          }));
        }

        setCourseHoles(data.map(h => ({
          holeNumber: h.hole_number,
          par: h.par,
          strokeIndex: h.stroke_index
        })));
      }
    } catch (error) {
      console.error("Error fetching tees:", error);
      setAvailableTees(["White", "Yellow", "Blue", "Red"]);
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
    player.teeColor = player.teeColor || setupState.teeColor || availableTees[0] || "White";
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
    const format = config.baseFormat === 'stroke_play' || config.baseFormat === 'stableford'
      ? 'stroke_play'
      : config.baseFormat === 'umbriago'
      ? 'umbriago'
      : config.baseFormat === 'wolf'
      ? 'wolf'
      : 'stroke_play';

    setSetupState(prev => ({
      ...prev,
      gameFormat: format as any,
      strokePlaySettings: {
        mulligansPerPlayer: config.mulligansPerPlayer || 0,
        handicapEnabled: config.useHandicaps,
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

  const handleStartRound = async () => {
    if (!selectedCourse) {
      toast({ title: "Course required", description: "Please select a course", variant: "destructive" });
      return;
    }

    if (getTotalPlayers() === 0) {
      toast({ title: "Players required", description: "Add at least one player", variant: "destructive" });
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

      const { data: round, error } = await supabase
        .from("rounds")
        .insert([{
          user_id: user.id,
          course_name: selectedCourse.name,
          tee_set: setupState.teeColor,
          holes_played: getHolesPlayed(setupState.selectedHoles as HoleCount),
          origin: 'play',
          date_played: setupState.datePlayed,
        }])
        .select()
        .single();

      if (error) throw error;

      // Add players
      const playersToAdd = setupState.groups.flatMap(g =>
        g.players
          .filter(p => !p.isTemporary)
          .map(p => ({ round_id: round.id, user_id: p.odId, tee_color: p.teeColor }))
      );

      if (playersToAdd.length > 0) {
        await supabase.from('round_players').insert(playersToAdd);
      }

      // Clear storage
      sessionStorage.removeItem('roundPlayers');
      sessionStorage.removeItem('userTeeColor');
      sessionStorage.removeItem('selectedCourse');
      sessionStorage.removeItem('playGroups');
      sessionStorage.removeItem('aiGameConfig');

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
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        
        {/* Header Card - Round Info */}
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
          </CardContent>
        </Card>

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
            <div className="space-y-3">
              {setupState.groups.map((group, index) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  groupIndex={index}
                  availableTees={availableTees.length > 0 ? availableTees : ["White", "Yellow", "Blue", "Red"]}
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
                {/* Tee Color */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Default Tee</Label>
                  <Select
                    value={setupState.teeColor}
                    onValueChange={handleDefaultTeeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tee" />
                    </SelectTrigger>
                    <SelectContent>
                      {(availableTees.length > 0 ? availableTees : ["White", "Yellow", "Blue", "Red"]).map((tee) => (
                        <SelectItem key={tee} value={tee}>{tee}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Game Format */}
                <div className="space-y-2">
                  <Label className="text-xs">Game Format</Label>
                  <div className="space-y-2">
                    {[
                      { id: "stroke_play", label: "Stroke Play", desc: "Standard scoring" },
                      { id: "umbriago", label: "Umbriago", desc: "2v2 team game" },
                      { id: "wolf", label: "🐺 Wolf", desc: "3-5 players, dynamic teams" },
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
                            if (fmt.id === "stroke_play") navigate('/stroke-play/settings');
                            else if (fmt.id === "umbriago") navigate('/umbriago/how-to-play');
                            else if (fmt.id === "copenhagen") navigate('/copenhagen/how-to-play');
                            else navigate('/wolf/how-to-play');
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
        <Button
          onClick={handleStartRound}
          disabled={loading || !selectedCourse}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {loading ? "Starting..." : "Start Round"}
        </Button>
      </div>

      {/* AI Assistant FAB */}
      <Button
        onClick={() => setShowAIAssistant(true)}
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg"
        size="icon"
      >
        <Sparkles className="w-6 h-6" />
      </Button>

      {/* Dialogs */}
      <AISetupAssistant
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        courseInfo={selectedCourse ? {
          courseName: selectedCourse.name,
          availableTees,
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
        defaultTee={setupState.teeColor || availableTees[0] || "White"}
      />

      <PlayerEditSheet
        isOpen={playerEditSheetOpen}
        onClose={() => {
          setPlayerEditSheetOpen(false);
          setEditingPlayer(null);
          setEditingPlayerGroupId(null);
        }}
        player={editingPlayer}
        availableTees={availableTees.length > 0 ? availableTees : ["White", "Yellow", "Blue", "Red"]}
        onSave={handleSavePlayer}
      />
    </div>
  );
}
