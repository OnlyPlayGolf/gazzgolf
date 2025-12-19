import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Users, MapPin } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SetupPlayerCard } from "@/components/play/SetupPlayerCard";
import { SetupAddPlayerButtons } from "@/components/play/SetupAddPlayerButtons";
import { SetupAddFriendSheet } from "@/components/play/SetupAddFriendSheet";
import { SetupAddGuestSheet } from "@/components/play/SetupAddGuestSheet";
import { SetupPlayerEditSheet } from "@/components/play/SetupPlayerEditSheet";
import { SkinsPlayer } from "@/types/skins";

interface Course {
  id: string;
  name: string;
  location: string | null;
}

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

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [holesPlayed, setHolesPlayed] = useState(18);
  const [skinValue, setSkinValue] = useState(1);
  const [carryoverEnabled, setCarryoverEnabled] = useState(true);
  const [useHandicaps, setUseHandicaps] = useState(false);
  const [handicapMode, setHandicapMode] = useState<'gross' | 'net'>('net');
  const [groups, setGroups] = useState<Group[]>([
    { id: '1', name: 'Group 1', players: [] }
  ]);
  const [loading, setLoading] = useState(false);

  // Sheet states
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showAddFriendSheet, setShowAddFriendSheet] = useState(false);
  const [showAddGuestSheet, setShowAddGuestSheet] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [defaultTee, setDefaultTee] = useState("medium");

  useEffect(() => {
    const loadData = async () => {
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

      // Fetch courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, name, location')
        .order('name');
      
      if (coursesData) setCourses(coursesData);

      // Load course from session storage
      const savedCourse = sessionStorage.getItem('selectedCourse');
      if (savedCourse) {
        try {
          const course = JSON.parse(savedCourse);
          const matchingCourse = coursesData?.find(c => c.name === course.name);
          if (matchingCourse) {
            setSelectedCourseId(matchingCourse.id);
          }
        } catch (e) {
          console.error("Error parsing saved course:", e);
        }
      } else if (location.state?.courseName) {
        const matchingCourse = coursesData?.find(c => c.name === location.state.courseName);
        if (matchingCourse) {
          setSelectedCourseId(matchingCourse.id);
        }
      } else if (coursesData && coursesData.length > 0) {
        setSelectedCourseId(coursesData[0].id);
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
              isCurrentUser: playerIdx === 0 && idx === 0,
            }))
          }));
          
          if (convertedGroups.some(g => g.players.length > 0)) {
            setGroups(convertedGroups);
          }
        } catch (e) {
          console.error("Error parsing saved groups:", e);
        }
      }
    };
    
    loadData();
  }, [location.state]);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

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
    
    if (!selectedCourse) {
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
          course_id: selectedCourseId,
          course_name: selectedCourse.name,
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
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rounds-play')} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Skins Setup</h1>
        </div>

        {/* Course Selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            Course
          </Label>
          <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a course" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Multi-Group Info Banner */}
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-primary">Skins Across All Groups</p>
                <p className="text-sm text-muted-foreground">
                  All {totalPlayers} players compete for skins together, regardless of which group they play in.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Game Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Game Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* Groups with Player Cards */}
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Input
                  value={group.name}
                  onChange={(e) => updateGroupName(group.id, e.target.value)}
                  className="font-semibold text-lg border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
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
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
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
        <Card className="bg-muted/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Total Players</span>
              <Badge variant="secondary">{totalPlayers}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Groups</span>
              <Badge variant="secondary">{groups.length}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Total Skins Available</span>
              <Badge variant="secondary">{holesPlayed}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Start Game */}
        <Button
          onClick={handleStartGame}
          disabled={loading || totalPlayers < 2 || !selectedCourse}
          className="w-full"
          size="lg"
        >
          {loading ? "Creating..." : "Start Skins Game"}
        </Button>
      </div>

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
