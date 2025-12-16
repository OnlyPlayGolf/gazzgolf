import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Info, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrambleTeam, ScramblePlayer } from "@/types/scramble";
import { formatHandicap } from "@/lib/utils";

export default function ScrambleSetup() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<ScrambleTeam[]>([]);
  const [courseName, setCourseName] = useState("");
  const [courseId, setCourseId] = useState<string | undefined>();
  const [teeSet, setTeeSet] = useState("white");
  const [holesPlayed, setHolesPlayed] = useState(18);
  const [minDrivesPerPlayer, setMinDrivesPerPlayer] = useState<number | null>(null);
  const [useHandicaps, setUseHandicaps] = useState(false);
  const [scoringType, setScoringType] = useState<'gross' | 'net'>('gross');

  useEffect(() => {
    loadSetupFromSession();
  }, []);

  const loadSetupFromSession = () => {
    const roundSetup = sessionStorage.getItem('roundSetupState');
    if (roundSetup) {
      const setup = JSON.parse(roundSetup);
      if (setup.courseName) setCourseName(setup.courseName);
      if (setup.courseId) setCourseId(setup.courseId);
      if (setup.selectedTee) setTeeSet(setup.selectedTee);
      if (setup.holesPlayed) setHolesPlayed(setup.holesPlayed);
      
      // Convert groups to teams
      if (setup.groups && Array.isArray(setup.groups)) {
        const convertedTeams: ScrambleTeam[] = setup.groups.map((group: any, index: number) => {
          const players: ScramblePlayer[] = (group.players || []).map((player: any) => ({
            id: player.odId || player.id,
            name: player.displayName || player.name,
            handicap: player.handicap ?? null,
            tee: player.teeColor || setup.selectedTee || 'white',
            isGuest: player.isTemporary || false,
            userId: player.isTemporary ? undefined : player.odId || player.id
          }));
          
          return {
            id: group.id || `team-${index + 1}`,
            name: group.name || `Team ${index + 1}`,
            players
          };
        });
        
        setTeams(convertedTeams);
      }
    }
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
      toast.error("Please add at least 2 players in groups");
      return;
    }

    const teamsWithPlayers = teams.filter(t => t.players.length > 0);
    if (teamsWithPlayers.length < 1) {
      toast.error("At least 1 team must have players");
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
          <h2 className="text-lg font-semibold flex items-center gap-2"><Users size={20} />Teams (from Groups)</h2>
          
          {teams.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground">
                <p>No groups found. Please add players to groups on the Play page first.</p>
              </CardContent>
            </Card>
          ) : (
            teams.map((team) => (
              <Card key={team.id}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">{team.name}</h3>
                  <div className="space-y-2">
                    {team.players.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No players in this team</p>
                    ) : (
                      team.players.map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                              {player.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{player.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {player.handicap !== null && player.handicap !== undefined && `HCP: ${formatHandicap(player.handicap)}`}
                                {player.tee && <span className="ml-2">Tee: {player.tee}</span>}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
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
    </div>
  );
}
