import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CourseSelectionDialog } from "@/components/CourseSelectionDialog";
import { SetupPlayerCard } from "@/components/play/SetupPlayerCard";
import { SetupAddPlayerButtons } from "@/components/play/SetupAddPlayerButtons";
import { SetupAddFriendSheet } from "@/components/play/SetupAddFriendSheet";
import { SetupAddGuestSheet } from "@/components/play/SetupAddGuestSheet";
import { SetupPlayerEditSheet } from "@/components/play/SetupPlayerEditSheet";
import { SkinsPlayer } from "@/types/skins";

interface Player {
  odId: string;
  displayName: string;
  handicap?: number;
  teeColor?: string;
  isTemporary?: boolean;
  isCurrentUser?: boolean;
}

interface Group {
  id: string;
  name: string;
  players: Player[];
}

export default function SkinsSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [courseName, setCourseName] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [holesPlayed, setHolesPlayed] = useState(18);
  const [skinValue, setSkinValue] = useState(1);
  const [carryoverEnabled, setCarryoverEnabled] = useState(true);
  const [useHandicaps, setUseHandicaps] = useState(false);
  const [handicapMode, setHandicapMode] = useState<'gross' | 'net'>('net');
  const [groups, setGroups] = useState<Group[]>([
    { id: '1', name: 'Group 1', players: [] }
  ]);
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sheet states
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showAddFriendSheet, setShowAddFriendSheet] = useState(false);
  const [showAddGuestSheet, setShowAddGuestSheet] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [defaultTee, setDefaultTee] = useState("medium");

  // Load course and players from session storage (from RoundsPlay page)
  useEffect(() => {
    // Get default tee from app preferences
    try {
      const savedPrefs = localStorage.getItem('appPreferences');
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.defaultTee) {
          setDefaultTee(prefs.defaultTee);
        }
      }
    } catch (e) {
      console.error("Error reading app preferences:", e);
    }

    // Load course
    const savedCourse = sessionStorage.getItem('selectedCourse');
    if (savedCourse) {
      try {
        const course = JSON.parse(savedCourse);
        setCourseName(course.name);
        setCourseId(course.id || null);
      } catch (e) {
        console.error("Error parsing saved course:", e);
      }
    } else if (location.state?.courseName) {
      setCourseName(location.state.courseName);
      setCourseId(location.state.courseId || null);
    }

    // Load players from groups
    const savedGroups = sessionStorage.getItem('playGroups');
    if (savedGroups) {
      try {
        const playGroups = JSON.parse(savedGroups);
        const convertedGroups: Group[] = playGroups.map((pg: any, idx: number) => ({
          id: String(idx + 1),
          name: pg.name || `Group ${idx + 1}`,
          players: pg.players.map((p: any, playerIdx: number) => ({
            odId: p.odId || `player-${idx}-${playerIdx}-${Date.now()}`,
            displayName: p.displayName || p.username || 'Player',
            handicap: p.handicap ?? undefined,
            teeColor: p.teeColor || 'medium',
            isTemporary: p.isTemporary ?? true,
            isCurrentUser: playerIdx === 0 && idx === 0, // First player in first group is current user
          }))
        }));
        
        // Only set if we have players
        if (convertedGroups.some(g => g.players.length > 0)) {
          setGroups(convertedGroups);
        }
      } catch (e) {
        console.error("Error parsing saved groups:", e);
      }
    }
  }, [location.state]);

  const addGroup = () => {
    const newId = String(groups.length + 1);
    setGroups([...groups, { id: newId, name: `Group ${newId}`, players: [] }]);
  };

  const removeGroup = (groupId: string) => {
    if (groups.length <= 1) return;
    setGroups(groups.filter(g => g.id !== groupId));
  };

  const updateGroupName = (groupId: string, name: string) => {
    setGroups(groups.map(g => g.id === groupId ? { ...g, name } : g));
  };

  const handleAddPlayerToGroup = (groupId: string, player: Player) => {
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        return { ...g, players: [...g.players, player] };
      }
      return g;
    }));
    setShowAddFriendSheet(false);
    setShowAddGuestSheet(false);
  };

  const removePlayerFromGroup = (groupId: string, playerId: string) => {
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        return { ...g, players: g.players.filter(p => p.odId !== playerId) };
      }
      return g;
    }));
  };

  const handleEditPlayer = (groupId: string, player: Player) => {
    setEditingPlayer(player);
    setEditingGroupId(groupId);
    setShowEditSheet(true);
  };

  const handleSavePlayer = (updatedPlayer: Player) => {
    if (!editingGroupId) return;
    setGroups(groups.map(g => {
      if (g.id === editingGroupId) {
        return {
          ...g,
          players: g.players.map(p => p.odId === updatedPlayer.odId ? updatedPlayer : p)
        };
      }
      return g;
    }));
  };

  const openAddFriend = (groupId: string) => {
    setActiveGroupId(groupId);
    setShowAddFriendSheet(true);
  };

  const openAddGuest = (groupId: string) => {
    setActiveGroupId(groupId);
    setShowAddGuestSheet(true);
  };

  const getAllPlayers = (): Player[] => {
    return groups.flatMap(g => g.players);
  };

  const getAllPlayerIds = (): string[] => {
    return groups.flatMap(g => g.players.map(p => p.odId));
  };

  const convertToSkinsPlayers = (): SkinsPlayer[] => {
    return groups.flatMap(g => g.players.map(p => ({
      name: p.displayName,
      handicap: p.handicap ?? null,
      tee: p.teeColor || null,
      group_name: g.name,
    })));
  };

  const handleStartGame = async () => {
    const allPlayers = convertToSkinsPlayers();
    
    if (!courseName) {
      toast({ title: "Please select a course", variant: "destructive" });
      return;
    }
    
    if (allPlayers.length < 2) {
      toast({ title: "Please add at least 2 players", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please log in", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase
        .from("skins_games")
        .insert({
          user_id: user.id,
          course_id: courseId,
          course_name: courseName,
          holes_played: holesPlayed,
          skin_value: skinValue,
          carryover_enabled: carryoverEnabled,
          use_handicaps: useHandicaps,
          handicap_mode: handicapMode,
          players: allPlayers as any,
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Skins game created!" });
      navigate(`/skins/${(data as any).id}/play`);
    } catch (error: any) {
      toast({ title: "Error creating game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalPlayers = getAllPlayers().length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ChevronLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">Skins Setup</h1>
              <p className="text-sm text-muted-foreground">Individual vs Individual</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Multi-Group Info Banner */}
        <Card className="p-4 bg-primary/10 border-primary/20">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-primary">Skins Across All Groups</p>
              <p className="text-sm text-muted-foreground">
                All {totalPlayers} players compete for skins together, regardless of which group they play in.
              </p>
            </div>
          </div>
        </Card>

        {/* Course Selection */}
        <Card className="p-4">
          <Label className="font-semibold mb-2 block">Course</Label>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setShowCourseDialog(true)}
          >
            {courseName || "Select a course..."}
          </Button>
        </Card>

        {/* Game Settings */}
        <Card className="p-4 space-y-4">
          <h3 className="font-semibold">Game Settings</h3>
          
          <div className="flex items-center justify-between">
            <Label>Holes</Label>
            <div className="flex gap-2">
              <Button
                variant={holesPlayed === 9 ? "default" : "outline"}
                size="sm"
                onClick={() => setHolesPlayed(9)}
              >
                9
              </Button>
              <Button
                variant={holesPlayed === 18 ? "default" : "outline"}
                size="sm"
                onClick={() => setHolesPlayed(18)}
              >
                18
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Skin Value</Label>
            <Input
              type="number"
              value={skinValue}
              onChange={(e) => setSkinValue(Number(e.target.value) || 1)}
              className="w-24 text-right"
              min={1}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Carryover</Label>
              <p className="text-xs text-muted-foreground">Ties carry skin to next hole</p>
            </div>
            <Switch
              checked={carryoverEnabled}
              onCheckedChange={setCarryoverEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Use Handicaps</Label>
              <p className="text-xs text-muted-foreground">Apply net scoring</p>
            </div>
            <Switch
              checked={useHandicaps}
              onCheckedChange={setUseHandicaps}
            />
          </div>

          {useHandicaps && (
            <div className="flex items-center justify-between">
              <Label>Scoring Mode</Label>
              <div className="flex gap-2">
                <Button
                  variant={handicapMode === 'net' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHandicapMode('net')}
                >
                  Net
                </Button>
                <Button
                  variant={handicapMode === 'gross' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHandicapMode('gross')}
                >
                  Gross
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Groups with Player Cards */}
        {groups.map((group) => (
          <Card key={group.id} className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Input
                value={group.name}
                onChange={(e) => updateGroupName(group.id, e.target.value)}
                className="font-semibold text-lg border-0 p-0 h-auto focus-visible:ring-0"
              />
              {groups.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeGroup(group.id)}
                  className="text-destructive"
                >
                  <Trash2 size={18} />
                </Button>
              )}
            </div>

            {/* Player Cards */}
            <div className="space-y-2">
              {group.players.map((player) => (
                <SetupPlayerCard
                  key={player.odId}
                  player={player}
                  onEdit={() => handleEditPlayer(group.id, player)}
                  onRemove={!player.isCurrentUser ? () => removePlayerFromGroup(group.id, player.odId) : undefined}
                  showTee={true}
                />
              ))}
            </div>

            {/* Add Player Buttons */}
            <SetupAddPlayerButtons
              onAddFriend={() => openAddFriend(group.id)}
              onAddGuest={() => openAddGuest(group.id)}
            />
          </Card>
        ))}

        {/* Add Group Button */}
        <Button
          variant="outline"
          onClick={addGroup}
          className="w-full"
        >
          <Plus size={16} className="mr-2" />
          Add Another Group
        </Button>

        {/* Summary */}
        <Card className="p-4 bg-muted/50">
          <div className="flex items-center justify-between text-sm">
            <span>Total Players</span>
            <Badge variant="secondary">{totalPlayers}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span>Groups</span>
            <Badge variant="secondary">{groups.length}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span>Total Skins Available</span>
            <Badge variant="secondary">{holesPlayed}</Badge>
          </div>
        </Card>

        {/* Start Game */}
        <Button
          onClick={handleStartGame}
          disabled={loading || totalPlayers < 2 || !courseName}
          className="w-full"
          size="lg"
        >
          {loading ? "Creating..." : "Start Skins Game"}
        </Button>
      </div>

      {/* Course Selection Dialog */}
      <CourseSelectionDialog
        isOpen={showCourseDialog}
        onClose={() => setShowCourseDialog(false)}
        onSelectCourse={(course) => {
          setCourseName(course.name);
          setCourseId(course.id);
          setShowCourseDialog(false);
        }}
      />

      {/* Add Friend Sheet */}
      <SetupAddFriendSheet
        isOpen={showAddFriendSheet}
        onClose={() => setShowAddFriendSheet(false)}
        onAddPlayer={(player) => activeGroupId && handleAddPlayerToGroup(activeGroupId, player)}
        existingPlayerIds={getAllPlayerIds()}
        defaultTee={defaultTee}
      />

      {/* Add Guest Sheet */}
      <SetupAddGuestSheet
        isOpen={showAddGuestSheet}
        onClose={() => setShowAddGuestSheet(false)}
        onAddPlayer={(player) => activeGroupId && handleAddPlayerToGroup(activeGroupId, player)}
        defaultTee={defaultTee}
      />

      {/* Edit Player Sheet */}
      <SetupPlayerEditSheet
        isOpen={showEditSheet}
        onClose={() => setShowEditSheet(false)}
        player={editingPlayer}
        onSave={handleSavePlayer}
      />
    </div>
  );
}
