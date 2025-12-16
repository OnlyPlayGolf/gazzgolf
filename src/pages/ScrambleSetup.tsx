import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, GripVertical, Info, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrambleTeam, ScramblePlayer } from "@/types/scramble";
import { SetupAddFriendSheet } from "@/components/play/SetupAddFriendSheet";
import { SetupAddGuestSheet } from "@/components/play/SetupAddGuestSheet";
import { formatHandicap } from "@/lib/utils";

export default function ScrambleSetup() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<ScrambleTeam[]>([
    { id: '1', name: 'Team 1', players: [] },
    { id: '2', name: 'Team 2', players: [] },
  ]);
  const [courseName, setCourseName] = useState("");
  const [courseId, setCourseId] = useState<string | undefined>();
  const [teeSet, setTeeSet] = useState("white");
  const [holesPlayed, setHolesPlayed] = useState(18);
  const [minDrivesPerPlayer, setMinDrivesPerPlayer] = useState<number | null>(null);
  const [useHandicaps, setUseHandicaps] = useState(false);
  const [scoringType, setScoringType] = useState<'gross' | 'net'>('gross');
  
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    const roundSetup = sessionStorage.getItem('roundSetupState');
    if (roundSetup) {
      const setup = JSON.parse(roundSetup);
      if (setup.courseName) setCourseName(setup.courseName);
      if (setup.courseId) setCourseId(setup.courseId);
      if (setup.selectedTee) setTeeSet(setup.selectedTee);
      if (setup.holesPlayed) setHolesPlayed(setup.holesPlayed);
    }
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile && teams[0].players.length === 0) {
      const currentPlayer: ScramblePlayer = {
        id: user.id,
        name: profile.display_name || profile.username || 'You',
        handicap: profile.handicap ? parseFloat(profile.handicap) : null,
        tee: teeSet,
        isGuest: false,
        userId: user.id
      };
      setTeams(prev => {
        const newTeams = [...prev];
        newTeams[0] = { ...newTeams[0], players: [currentPlayer] };
        return newTeams;
      });
    }
  };

  const addTeam = () => {
    const newTeam: ScrambleTeam = {
      id: `${Date.now()}`,
      name: `Team ${teams.length + 1}`,
      players: []
    };
    setTeams([...teams, newTeam]);
  };

  const removeTeam = (teamId: string) => {
    if (teams.length <= 2) {
      toast.error("Minimum 2 teams required");
      return;
    }
    setTeams(teams.filter(t => t.id !== teamId));
  };

  const updateTeamName = (teamId: string, name: string) => {
    setTeams(teams.map(t => t.id === teamId ? { ...t, name } : t));
  };

  const openAddFriend = (teamId: string) => {
    setSelectedTeamId(teamId);
    setAddFriendOpen(true);
  };

  const openAddGuest = (teamId: string) => {
    setSelectedTeamId(teamId);
    setAddGuestOpen(true);
  };

  const getExistingPlayerIds = (): string[] => {
    return teams.flatMap(t => t.players.map(p => p.id));
  };

  const addPlayerToTeam = (player: { odId: string; displayName: string; handicap?: number; teeColor?: string; isTemporary?: boolean }) => {
    if (!selectedTeamId) return;
    const newPlayer: ScramblePlayer = {
      id: player.odId,
      name: player.displayName,
      handicap: player.handicap ?? null,
      tee: player.teeColor || teeSet,
      isGuest: player.isTemporary || false
    };
    setTeams(teams.map(t => {
      if (t.id === selectedTeamId) {
        return { ...t, players: [...t.players, newPlayer] };
      }
      return t;
    }));
  };

  const removePlayer = (teamId: string, playerId: string) => {
    setTeams(teams.map(t => {
      if (t.id === teamId) {
        return { ...t, players: t.players.filter(p => p.id !== playerId) };
      }
      return t;
    }));
  };

  const startGame = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in to start a game");
      return;
    }

    if (!courseName) {
      toast.error("Please select a course");
      return;
    }

    const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);
    if (totalPlayers < 2) {
      toast.error("Please add at least 2 players");
      return;
    }

    const teamsWithPlayers = teams.filter(t => t.players.length > 0);
    if (teamsWithPlayers.length < 2) {
      toast.error("At least 2 teams must have players");
      return;
    }

    const { data: game, error } = await supabase
      .from('scramble_games')
      .insert({
        user_id: user.id,
        course_name: courseName,
        course_id: courseId,
        tee_set: teeSet,
        holes_played: holesPlayed,
        teams: teamsWithPlayers as unknown as any,
        min_drives_per_player: minDrivesPerPlayer,
        use_handicaps: useHandicaps,
        scoring_type: scoringType,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating game:', error);
      toast.error("Failed to create game");
      return;
    }

    toast.success("Game started!");
    navigate(`/scramble/${game.id}/play`);
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold">Scramble Setup</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate('/scramble/how-to-play')} className="text-primary-foreground ml-auto">
            <Info size={20} />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>Course</Label>
              <p className="text-lg font-semibold">{courseName || 'Not selected'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Holes</Label>
                <Select value={holesPlayed.toString()} onValueChange={(v) => setHolesPlayed(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9">9 Holes</SelectItem>
                    <SelectItem value="18">18 Holes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default Tee</Label>
                <Select value={teeSet} onValueChange={setTeeSet}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="white">White</SelectItem>
                    <SelectItem value="yellow">Yellow</SelectItem>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="red">Red</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Users size={20} />Teams</h2>
            <Button variant="outline" size="sm" onClick={addTeam}><Plus size={16} className="mr-1" />Add Team</Button>
          </div>

          {teams.map((team) => (
            <Card key={team.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <GripVertical size={16} className="text-muted-foreground" />
                  <Input value={team.name} onChange={(e) => updateTeamName(team.id, e.target.value)} className="flex-1 font-semibold" />
                  {teams.length > 2 && (
                    <Button variant="ghost" size="icon" onClick={() => removeTeam(team.id)}><Trash2 size={16} className="text-destructive" /></Button>
                  )}
                </div>
                <div className="space-y-2">
                  {team.players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{player.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {player.handicap !== null && player.handicap !== undefined && `HCP: ${formatHandicap(player.handicap)}`}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removePlayer(team.id, player.id)}>
                        <Trash2 size={14} className="text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openAddFriend(team.id)}>Add Friend</Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openAddGuest(team.id)}>Add Guest</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold">Game Settings</h3>
            <div className="flex items-center justify-between">
              <div><Label>Min drives per player</Label></div>
              <Select value={minDrivesPerPlayer?.toString() || 'none'} onValueChange={(v) => setMinDrivesPerPlayer(v === 'none' ? null : parseInt(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Use Handicaps</Label>
              <Switch checked={useHandicaps} onCheckedChange={setUseHandicaps} />
            </div>
            {useHandicaps && (
              <div className="flex items-center justify-between">
                <Label>Scoring Type</Label>
                <Select value={scoringType} onValueChange={(v) => setScoringType(v as 'gross' | 'net')}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross">Gross</SelectItem>
                    <SelectItem value="net">Net</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={startGame} className="w-full" size="lg">Start Scramble</Button>
      </div>

      <SetupAddFriendSheet isOpen={addFriendOpen} onClose={() => setAddFriendOpen(false)} onAddPlayer={addPlayerToTeam} existingPlayerIds={getExistingPlayerIds()} defaultTee={teeSet} />
      <SetupAddGuestSheet isOpen={addGuestOpen} onClose={() => setAddGuestOpen(false)} onAddPlayer={addPlayerToTeam} defaultTee={teeSet} />
    </div>
  );
}
