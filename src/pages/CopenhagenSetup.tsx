import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Settings } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseHandicap, formatHandicap } from "@/lib/utils";
import { SetupPlayerCard } from "@/components/play/SetupPlayerCard";
import { SetupAddPlayerButtons } from "@/components/play/SetupAddPlayerButtons";
import { SetupPlayerEditSheet } from "@/components/play/SetupPlayerEditSheet";
import { SetupAddFriendSheet } from "@/components/play/SetupAddFriendSheet";
import { SetupAddGuestSheet } from "@/components/play/SetupAddGuestSheet";
import { STANDARD_TEE_OPTIONS } from "@/components/TeeSelector";
import { getDefaultTeeFromPreferences } from "@/utils/teeSystem";
import { GAME_FORMAT_PLAYER_REQUIREMENTS } from "@/types/gameGroups";
import { StatsModeSelector, StatsMode } from "@/components/play/StatsModeSelector";

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

export default function CopenhagenSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  const [gimmesEnabled, setGimmesEnabled] = useState(false);
  const [sweepRuleEnabled, setSweepRuleEnabled] = useState(true);
  const [defaultTee, setDefaultTee] = useState(() => getDefaultTeeFromPreferences());
  const [statsMode, setStatsMode] = useState<StatsMode>('none');

  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username, handicap')
        .eq('id', user.id)
        .single();
      
      const userName = profile?.display_name || profile?.username || 'You';
      const userHandicap = parseHandicap(profile?.handicap);
      
      // Load saved settings
      const savedSettings = sessionStorage.getItem('copenhagenSettings');
      const prefDefaultTee = getDefaultTeeFromPreferences();
      let savedDefaultTee = prefDefaultTee;
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
        setGimmesEnabled(settings.gimmesEnabled || false);
        setSweepRuleEnabled(settings.sweepRuleEnabled !== false);
        savedDefaultTee = settings.defaultTee || prefDefaultTee;
        setDefaultTee(savedDefaultTee);
      }

      const currentUserPlayer: Player = {
        odId: user.id,
        displayName: userName,
        handicap: userHandicap,
        teeColor: savedDefaultTee,
        isTemporary: false,
        isCurrentUser: true,
      };
      
      const savedPlayers = sessionStorage.getItem('roundPlayers');
      let additionalPlayers: Player[] = [];
      if (savedPlayers) {
        const parsed = JSON.parse(savedPlayers);
        additionalPlayers = parsed.slice(0, 2).map((p: any) => ({
          odId: p.odId || p.userId || `temp_${Date.now()}`,
          displayName: p.displayName,
          handicap: p.handicap,
          teeColor: p.teeColor,
          isTemporary: p.isTemporary || false,
          isCurrentUser: false,
        }));
      }
      
      setPlayers([currentUserPlayer, ...additionalPlayers]);
      
      const savedCourse = sessionStorage.getItem('selectedCourse');
      
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, name, location')
        .order('name');
      
      if (coursesData) setCourses(coursesData);
      
      if (savedCourse) {
        const course = JSON.parse(savedCourse);
        const matchingCourse = coursesData?.find(c => c.name === course.name);
        if (matchingCourse) {
          setSelectedCourseId(matchingCourse.id);
          return;
        }
      }
      
      if (coursesData && coursesData.length > 0) {
        setSelectedCourseId(coursesData[0].id);
      }
    };
    loadData();
  }, []);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  const handleAddPlayer = (player: Player) => {
    if (players.length >= 3) {
      toast({ title: "Maximum 3 players", description: "Copenhagen requires exactly 3 players", variant: "destructive" });
      return;
    }
    setPlayers(prev => [...prev, player]);
  };

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    setPlayers(prev => prev.map(p => p.odId === updatedPlayer.odId ? updatedPlayer : p));
  };

  const handleRemovePlayer = (odId: string) => {
    setPlayers(prev => prev.filter(p => p.odId !== odId));
  };

  // Validate player count
  const req = GAME_FORMAT_PLAYER_REQUIREMENTS["copenhagen"];
  const isValidPlayerCount = req.exact ? players.length === req.exact : players.length >= req.min && players.length <= req.max;
  const validationMessage = !isValidPlayerCount
    ? `Copenhagen requires exactly ${req.exact} players (have ${players.length})`
    : null;

  const handleStartGame = async () => {
    if (!isValidPlayerCount) {
      toast({ title: "Invalid player count", description: validationMessage, variant: "destructive" });
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
      const savedHoles = sessionStorage.getItem('selectedHoles');
      const holesPlayed = (savedHoles === "front9" || savedHoles === "back9") ? 9 : 18;
      const selectedEventId = sessionStorage.getItem('selectedEventId');

      const { data: game, error } = await supabase
        .from("copenhagen_games")
        .insert({
          user_id: user.id,
          course_name: selectedCourse?.name || "Copenhagen Game",
          course_id: selectedCourseId || null,
          round_name: savedRoundName || null,
          holes_played: holesPlayed,
          player_1: players[0].displayName,
          player_2: players[1].displayName,
          player_3: players[2].displayName,
          player_1_handicap: null,
          player_2_handicap: null,
          player_3_handicap: null,
          player_1_tee: players[0].teeColor || null,
          player_2_tee: players[1].teeColor || null,
          player_3_tee: players[2].teeColor || null,
          use_handicaps: false,
          stats_mode: statsMode,
          ...(selectedEventId ? { event_id: selectedEventId } : {}),
        })
        .select()
        .single();

      if (error) throw error;

      // Persist the player's stats mode choice for this game (used by in-game + settings screens)
      try {
        await supabase
          .from('player_game_stats_mode')
          .upsert({
            user_id: user.id,
            game_id: game.id,
            game_type: 'copenhagen',
            stats_mode: statsMode,
          }, { onConflict: 'user_id,game_id,game_type' });
      } catch (e) {
        console.warn('Failed to save player stats mode preference:', e);
      }

      // Save settings to game-specific localStorage and session storage
      const copenhagenSettings = { mulligansPerPlayer, gimmesEnabled, sweepRuleEnabled, defaultTee };
      localStorage.setItem(`copenhagenSettings_${game.id}`, JSON.stringify(copenhagenSettings));
      sessionStorage.setItem('copenhagenSettings', JSON.stringify(copenhagenSettings));

      if (selectedEventId) sessionStorage.removeItem('selectedEventId');
      toast({ title: "Copenhagen game started!" });
      navigate(`/copenhagen/${game.id}/play`);
    } catch (error: any) {
      toast({ title: "Error creating game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const existingPlayerIds = players.map(p => p.odId);

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rounds-play')} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Copenhagen Setup</h1>
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

        {/* Players Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users size={20} className="text-primary" />
              Players (3 required)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {players.map((player, index) => (
              <SetupPlayerCard
                key={player.odId}
                player={player}
                onEdit={() => setEditingPlayer(player)}
                showTee={true}
              />
            ))}

            {players.length < 3 && (
              <>
                <div className="p-3 rounded-lg border border-dashed text-center text-muted-foreground text-sm">
                  Add {3 - players.length} more player{players.length === 2 ? '' : 's'}
                </div>
                <SetupAddPlayerButtons
                  onAddFriend={() => setShowAddFriend(true)}
                  onAddGuest={() => setShowAddGuest(true)}
                />
              </>
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
              <p className="text-xs text-muted-foreground">
                Number of allowed do-overs per player during the round
              </p>
            </div>

            {/* Gimmes toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="gimmes">Allow Gimmes</Label>
                <p className="text-xs text-muted-foreground">
                  Short putts can be conceded without being played
                </p>
              </div>
              <Switch
                id="gimmes"
                checked={gimmesEnabled}
                onCheckedChange={setGimmesEnabled}
              />
            </div>

            {/* Sweep Rule toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="sweep">Sweep Rule</Label>
                <p className="text-xs text-muted-foreground">
                  One player wins all 6 points with the outright lowest net score
                </p>
              </div>
              <Switch
                id="sweep"
                checked={sweepRuleEnabled}
                onCheckedChange={setSweepRuleEnabled}
              />
            </div>

            <StatsModeSelector value={statsMode} onChange={setStatsMode} />
          </CardContent>
        </Card>

        {/* Start Button */}
        {!isValidPlayerCount && validationMessage && (
          <p className="text-sm text-destructive text-center">{validationMessage}</p>
        )}

        <Button
          onClick={handleStartGame}
          disabled={loading || !isValidPlayerCount}
          className="w-full h-12 text-lg font-semibold"
        >
          {loading ? "Starting..." : "Start Copenhagen Game"}
        </Button>

        {/* Sheets */}
        <SetupPlayerEditSheet
          player={editingPlayer}
          isOpen={!!editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSave={handleUpdatePlayer}
          availableTees={STANDARD_TEE_OPTIONS.map(t => t.value)}
        />

        <SetupAddFriendSheet
          isOpen={showAddFriend}
          onClose={() => setShowAddFriend(false)}
          onAddPlayer={handleAddPlayer}
          existingPlayerIds={existingPlayerIds}
          defaultTee={defaultTee}
        />

        <SetupAddGuestSheet
          isOpen={showAddGuest}
          onClose={() => setShowAddGuest(false)}
          onAddPlayer={handleAddPlayer}
          defaultTee={defaultTee}
        />
      </div>
    </div>
  );
}
