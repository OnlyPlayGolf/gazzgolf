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
import { parseHandicap } from "@/lib/utils";
import { SetupPlayerCard } from "@/components/play/SetupPlayerCard";
import { SetupPlayerEditSheet } from "@/components/play/SetupPlayerEditSheet";
import { TeeSelector, STANDARD_TEE_OPTIONS, DEFAULT_MEN_TEE } from "@/components/TeeSelector";
import { PlayerGroup } from "@/types/playSetup";
import { validateAllGroupsForFormat, getFormatPlayerRequirementText } from "@/utils/groupValidation";

interface Course {
  id: string;
  name: string;
  location: string | null;
  tee_names?: Record<string, string> | null;
}

interface Player {
  odId: string;
  displayName: string;
  handicap?: number;
  teeColor?: string;
  isTemporary?: boolean;
  isCurrentUser?: boolean;
}

export default function StrokePlaySetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Course from sessionStorage
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseTeeNames, setCourseTeeNames] = useState<Record<string, string> | null>(null);
  const [selectedHoles, setSelectedHoles] = useState<"18" | "front9" | "back9">("18");
  const [teeColor, setTeeColor] = useState(DEFAULT_MEN_TEE);
  const [roundName, setRoundName] = useState<string>("");
  const [datePlayed, setDatePlayed] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Groups with players
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Game settings
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [gimmesEnabled, setGimmesEnabled] = useState(false);

  // Sheet states
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const teeCount = 5; // Standard tee options

  // Helper to get all players from all groups
  const getAllPlayers = (): Player[] => {
    return groups.flatMap(g => g.players.map(p => ({
      odId: p.odId,
      displayName: p.displayName,
      handicap: p.handicap,
      teeColor: p.teeColor,
      isTemporary: p.isTemporary,
      isCurrentUser: p.odId === currentUserId,
    })));
  };

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);
      
      // Get current user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username, handicap')
        .eq('id', user.id)
        .single();
      
      // Load course from sessionStorage
      const savedCourse = sessionStorage.getItem('selectedCourse');
      if (savedCourse) {
        const course = JSON.parse(savedCourse);
        setSelectedCourse(course);
        if (course.tee_names) {
          setCourseTeeNames(course.tee_names);
        }
      }
      
      // Load holes selection
      const savedHoles = sessionStorage.getItem('selectedHoles');
      if (savedHoles) {
        setSelectedHoles(savedHoles as "18" | "front9" | "back9");
      }
      
      // Load tee color
      const savedTee = sessionStorage.getItem('userTeeColor');
      if (savedTee) {
        setTeeColor(savedTee);
      }

      // Load round name
      const savedRoundName = sessionStorage.getItem('roundName');
      if (savedRoundName) {
        setRoundName(savedRoundName);
      }

      // Load date
      const savedDate = sessionStorage.getItem('datePlayer');
      if (savedDate) {
        setDatePlayed(savedDate);
      }
      
      // Load groups from sessionStorage
      const savedGroups = sessionStorage.getItem('playGroups');
      if (savedGroups) {
        const parsedGroups = JSON.parse(savedGroups) as PlayerGroup[];
        setGroups(parsedGroups);
      }
      
      // Load stroke play settings
      const savedSettings = sessionStorage.getItem('strokePlaySettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
        setHandicapEnabled(settings.handicapEnabled || false);
        setGimmesEnabled(settings.gimmesEnabled || false);
      }
    };
    loadData();
  }, []);

  const getHolesPlayed = (): number => {
    switch (selectedHoles) {
      case "front9":
      case "back9":
        return 9;
      default:
        return 18;
    }
  };

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    setGroups(prev => prev.map(g => ({
      ...g,
      players: g.players.map(p => p.odId === updatedPlayer.odId ? { ...p, ...updatedPlayer } : p)
    })));
  };

  const updateAllPlayersTee = (newTee: string) => {
    setTeeColor(newTee);
    setGroups(prev => prev.map(g => ({
      ...g,
      players: g.players.map(p => ({ ...p, teeColor: newTee }))
    })));
  };

  // Validate groups for stroke play
  const groupValidation = validateAllGroupsForFormat(groups, "stroke_play");

  const handleStartRound = async () => {
    if (!selectedCourse) {
      toast({ title: "Course required", description: "Please go back and select a course", variant: "destructive" });
      return;
    }

    if (!groupValidation.allValid) {
      toast({ title: "Invalid setup", description: groupValidation.errorMessage, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Determine starting hole based on selectedHoles
      const startingHole = selectedHoles === 'back9' ? 10 : 1;

      // Create the round
      const { data: round, error } = await supabase
        .from("rounds")
        .insert({
          user_id: user.id,
          course_name: selectedCourse.name,
          round_name: roundName || null,
          tee_set: teeColor,
          holes_played: getHolesPlayed(),
          starting_hole: startingHole,
          origin: 'play',
          date_played: datePlayed,
        })
        .select()
        .single();

      if (error) throw error;

      // Create game groups and add players with group references
      const hasMultipleGroups = groups.length > 1;
      const allGuestPlayers: Player[] = [];

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        let gameGroupId: string | null = null;

        // Only create game_groups record if there are multiple groups
        if (hasMultipleGroups) {
          const { data: gameGroup, error: groupError } = await supabase
            .from("game_groups")
            .insert({
              round_id: round.id,
              group_name: group.name,
              group_index: i,
              tee_time: group.teeTime || null,
              starting_hole: group.startingHole || null,
            })
            .select()
            .single();

          if (groupError) {
            console.error("Error creating game group:", groupError);
          } else {
            gameGroupId = gameGroup.id;
          }
        }

        // Add registered players to database
        const registeredPlayers = group.players.filter(p => !p.isTemporary);
        const guestPlayers = group.players.filter(p => p.isTemporary);

        const playersToAdd = registeredPlayers.map(p => ({
          round_id: round.id,
          user_id: p.odId,
          tee_color: p.teeColor || teeColor,
          handicap: p.handicap,
          group_id: gameGroupId,
        }));

        if (playersToAdd.length > 0) {
          const { error: playersError } = await supabase
            .from('round_players')
            .insert(playersToAdd);

          if (playersError) {
            console.error("Error adding players:", playersError);
          }
        }

        // Collect guest players with group info
        guestPlayers.forEach(p => {
          allGuestPlayers.push({
            ...p,
            odId: p.odId,
            displayName: p.displayName,
            handicap: p.handicap,
            teeColor: p.teeColor,
            isTemporary: true,
          });
        });
      }

      // Store guest players in localStorage for this round
      if (allGuestPlayers.length > 0) {
        localStorage.setItem(`roundGuestPlayers_${round.id}`, JSON.stringify(allGuestPlayers));
      }

      // Save settings to round-specific localStorage
      localStorage.setItem(`roundSettings_${round.id}`, JSON.stringify({
        mulligansPerPlayer,
        handicapEnabled,
        gimmesEnabled,
      }));

      // Clear setup sessionStorage
      sessionStorage.removeItem('roundPlayers');
      sessionStorage.removeItem('userTeeColor');
      sessionStorage.removeItem('selectedCourse');
      sessionStorage.removeItem('selectedHoles');
      sessionStorage.removeItem('roundName');
      sessionStorage.removeItem('datePlayer');
      sessionStorage.removeItem('playGroups');

      toast({ title: "Round started!", description: `Good luck at ${selectedCourse.name}` });
      navigate(`/rounds/${round.id}/track`);
    } catch (error: any) {
      toast({ title: "Error creating round", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const allPlayers = getAllPlayers();
  const totalPlayerCount = allPlayers.length;

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rounds-play')} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Stroke Play Setup</h1>
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

        {/* Groups & Players Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-primary" />
                {groups.length > 1 ? "Groups & Players" : "Players"}
              </div>
              <span className="text-sm font-normal text-muted-foreground">
                {totalPlayerCount} player{totalPlayerCount !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {groups.map((group, groupIndex) => (
              <div key={group.id} className="space-y-2">
                {groups.length > 1 && (
                  <div className="text-sm font-medium text-muted-foreground">
                    {group.name}
                    {group.teeTime && <span className="ml-2">• {group.teeTime}</span>}
                  </div>
                )}
                {group.players.map((player) => (
                  <SetupPlayerCard
                    key={player.odId}
                    player={{
                      odId: player.odId,
                      displayName: player.displayName,
                      handicap: player.handicap,
                      teeColor: player.teeColor,
                      isTemporary: player.isTemporary,
                      isCurrentUser: player.odId === currentUserId,
                    }}
                    onEdit={() => setEditingPlayer({
                      odId: player.odId,
                      displayName: player.displayName,
                      handicap: player.handicap,
                      teeColor: player.teeColor,
                      isTemporary: player.isTemporary,
                      isCurrentUser: player.odId === currentUserId,
                    })}
                    showTee={true}
                  />
                ))}
              </div>
            ))}
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
                onValueChange={updateAllPlayersTee}
                teeCount={teeCount}
                courseTeeNames={courseTeeNames}
              />
            </div>

            {/* Handicap toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="handicap">Use Handicaps</Label>
                <p className="text-xs text-muted-foreground">
                  Apply player handicaps to scoring
                </p>
              </div>
              <Switch
                id="handicap"
                checked={handicapEnabled}
                onCheckedChange={setHandicapEnabled}
              />
            </div>

            {/* Mulligans */}
            <div className="space-y-2">
              <Label>Mulligans per Player</Label>
              <Select 
                value={mulligansPerPlayer.toString()} 
                onValueChange={(value) => setMulligansPerPlayer(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mulligans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No mulligans</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="9">1 per 9 holes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gimmes toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="gimmes">Allow Gimmes</Label>
                <p className="text-xs text-muted-foreground">
                  Short putts can be conceded
                </p>
              </div>
              <Switch
                id="gimmes"
                checked={gimmesEnabled}
                onCheckedChange={setGimmesEnabled}
              />
            </div>
          </CardContent>
        </Card>

        {!groupValidation.allValid && groupValidation.errorMessage && (
          <p className="text-sm text-destructive text-center">{groupValidation.errorMessage}</p>
        )}

        <Button onClick={handleStartRound} disabled={loading || !selectedCourse || !groupValidation.allValid} className="w-full" size="lg">
          {loading ? "Starting..." : "Start Round"}
        </Button>
      </div>

      {/* Edit Player Sheet */}
      <SetupPlayerEditSheet
        isOpen={!!editingPlayer}
        onClose={() => setEditingPlayer(null)}
        player={editingPlayer}
        availableTees={STANDARD_TEE_OPTIONS.map(t => t.value)}
        onSave={handleUpdatePlayer}
      />
    </div>
  );
}
