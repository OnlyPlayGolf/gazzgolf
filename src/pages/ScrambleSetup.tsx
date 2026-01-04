import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Settings } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrambleTeam, ScramblePlayer } from "@/types/scramble";
import { formatHandicap } from "@/lib/utils";
import { TeeSelector, DEFAULT_MEN_TEE } from "@/components/TeeSelector";
import { GAME_FORMAT_PLAYER_REQUIREMENTS } from "@/types/gameGroups";

interface Course {
  id: string;
  name: string;
  location: string | null;
  tee_names?: Record<string, string> | null;
}

export default function ScrambleSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Course from sessionStorage
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseTeeNames, setCourseTeeNames] = useState<Record<string, string> | null>(null);
  const [selectedHoles, setSelectedHoles] = useState<"18" | "front9" | "back9">("18");
  const [teeColor, setTeeColor] = useState(DEFAULT_MEN_TEE);
  
  // Teams
  const [teams, setTeams] = useState<ScrambleTeam[]>([]);
  
  // Game settings
  const [minDrivesPerPlayer, setMinDrivesPerPlayer] = useState<number | null>(null);
  const [useHandicaps, setUseHandicaps] = useState(false);
  const [scoringType, setScoringType] = useState<'gross' | 'net'>('gross');

  const teeCount = 5;

  useEffect(() => {
    loadSetupFromSession();
  }, []);

  const loadSetupFromSession = () => {
    // Load course info
    const savedCourse = sessionStorage.getItem('selectedCourse');
    if (savedCourse) {
      const course = JSON.parse(savedCourse);
      setSelectedCourse(course);
      if (course.tee_names) {
        setCourseTeeNames(course.tee_names);
      }
    }

    const savedHoles = sessionStorage.getItem('selectedHoles');
    if (savedHoles) {
      setSelectedHoles(savedHoles as "18" | "front9" | "back9");
    }

    const savedTee = sessionStorage.getItem('userTeeColor');
    if (savedTee) {
      setTeeColor(savedTee);
    }

    // Load groups from playGroups
    const savedGroups = sessionStorage.getItem('playGroups');
    if (savedGroups) {
      const groups = JSON.parse(savedGroups);
      if (Array.isArray(groups) && groups.length > 0) {
        const convertedTeams: ScrambleTeam[] = groups.map((group: any, index: number) => {
          const players: ScramblePlayer[] = (group.players || []).map((player: any) => ({
            id: player.odId || player.id,
            name: player.displayName || player.name,
            handicap: player.handicap ?? null,
            tee: player.teeColor || savedTee || teeColor,
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

  const getHolesPlayed = (): number => {
    switch (selectedHoles) {
      case "front9":
      case "back9":
        return 9;
      default:
        return 18;
    }
  };

  // Validate each team individually
  const validateTeams = () => {
    const teamsWithPlayers = teams.filter(t => t.players.length > 0);
    const req = GAME_FORMAT_PLAYER_REQUIREMENTS["scramble"];
    
    if (teamsWithPlayers.length === 0) {
      return { valid: false, message: "Add at least one team with players" };
    }

    for (const team of teamsWithPlayers) {
      if (team.players.length < req.min) {
        return { 
          valid: false, 
          message: `${team.name} needs at least ${req.min} players (has ${team.players.length})` 
        };
      }
      if (team.players.length > req.max) {
        return { 
          valid: false, 
          message: `${team.name} can have at most ${req.max} players (has ${team.players.length})` 
        };
      }
    }
    
    return { valid: true, message: null };
  };

  const teamValidation = validateTeams();
  const teamsWithPlayers = teams.filter(t => t.players.length > 0);

  const startGame = async () => {
    if (!selectedCourse) {
      toast({ title: "Course required", description: "Please go back and select a course", variant: "destructive" });
      return;
    }

    if (!teamValidation.valid) {
      toast({ title: "Invalid team setup", description: teamValidation.message, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get round name from session storage
      const savedRoundName = sessionStorage.getItem('roundName');

      const { data: game, error } = await supabase
        .from('scramble_games')
        .insert({
          user_id: user.id,
          course_name: selectedCourse.name,
          course_id: selectedCourse.id,
          round_name: savedRoundName || null,
          tee_set: teeColor,
          holes_played: getHolesPlayed(),
          teams: teamsWithPlayers as unknown as any,
          min_drives_per_player: minDrivesPerPlayer,
          use_handicaps: useHandicaps,
          scoring_type: scoringType,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Game started!", description: `Good luck at ${selectedCourse.name}` });
      navigate(`/scramble/${game.id}/play`);
    } catch (error: any) {
      toast({ title: "Error creating game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rounds-play')} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Scramble Setup</h1>
        </div>

        {/* Course Info - Compact */}
        {selectedCourse && (
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{selectedCourse.name}</span>
                <span className="text-muted-foreground text-sm ml-2">
                  {selectedHoles === "18" ? "18 holes" : selectedHoles === "front9" ? "Front 9" : "Back 9"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Teams Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users size={20} className="text-primary" />
              Teams (from Groups)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No groups found. Please add players to groups on the Play page first.
              </p>
            ) : (
              teams.map((team) => (
                <div key={team.id} className="p-3 rounded-lg border bg-card">
                  <h3 className="font-semibold mb-2">{team.name}</h3>
                  <div className="space-y-2">
                    {team.players.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No players in this team</p>
                    ) : (
                      team.players.map((player) => (
                        <div key={player.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{player.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {player.handicap !== null && player.handicap !== undefined && `HCP: ${formatHandicap(player.handicap)}`}
                              {player.tee && <span className="ml-2">Tee: {player.tee}</span>}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Game Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings size={20} className="text-primary" />
              Game Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Default Tee */}
            <div className="space-y-2">
              <Label>Default Tee Box</Label>
              <TeeSelector
                value={teeColor}
                onValueChange={setTeeColor}
                teeCount={teeCount}
                courseTeeNames={courseTeeNames}
              />
            </div>

            {/* Min Drives */}
            <div className="space-y-2">
              <Label>Minimum Drives per Player</Label>
              <Select value={minDrivesPerPlayer?.toString() || 'none'} onValueChange={(v) => setMinDrivesPerPlayer(v === 'none' ? null : parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select minimum drives" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (no minimum)</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Handicap toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="handicap">Use Handicaps</Label>
                <p className="text-xs text-muted-foreground">
                  Apply team handicaps to scoring
                </p>
              </div>
              <Switch
                id="handicap"
                checked={useHandicaps}
                onCheckedChange={setUseHandicaps}
              />
            </div>

            {/* Scoring Type (only when handicaps enabled) */}
            {useHandicaps && (
              <div className="space-y-2">
                <Label>Scoring Type</Label>
                <Select value={scoringType} onValueChange={(v) => setScoringType(v as 'gross' | 'net')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross">Gross</SelectItem>
                    <SelectItem value="net">Net</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {!teamValidation.valid && teamValidation.message && (
          <p className="text-sm text-destructive text-center">{teamValidation.message}</p>
        )}

        <Button onClick={startGame} disabled={loading || !selectedCourse || !teamValidation.valid} className="w-full" size="lg">
          {loading ? "Starting..." : "Start Scramble"}
        </Button>
      </div>
    </div>
  );
}
