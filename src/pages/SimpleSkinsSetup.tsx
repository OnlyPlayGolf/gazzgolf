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
import { SetupAddPlayerButtons } from "@/components/play/SetupAddPlayerButtons";
import { SetupPlayerEditSheet } from "@/components/play/SetupPlayerEditSheet";
import { SetupAddFriendSheet } from "@/components/play/SetupAddFriendSheet";
import { SetupAddGuestSheet } from "@/components/play/SetupAddGuestSheet";
import { TeeSelector, STANDARD_TEE_OPTIONS, DEFAULT_MEN_TEE } from "@/components/TeeSelector";

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

export default function SimpleSkinsSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Course from sessionStorage
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseTeeNames, setCourseTeeNames] = useState<Record<string, string> | null>(null);
  const [selectedHoles, setSelectedHoles] = useState<"18" | "9">("18");
  const [teeColor, setTeeColor] = useState(DEFAULT_MEN_TEE);
  
  // Players (including current user)
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Simple Skins specific settings
  const [skinValue, setSkinValue] = useState(1);
  const [carryoverEnabled, setCarryoverEnabled] = useState(true);

  // Sheet states
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);

  const teeCount = 5;

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
      
      const userName = profile?.display_name || profile?.username || 'You';
      const userHandicap = parseHandicap(profile?.handicap);
      
      // Load course from sessionStorage
      const savedCourse = sessionStorage.getItem('selectedCourse');
      if (savedCourse) {
        const course = JSON.parse(savedCourse);
        setSelectedCourse(course);
        if (course.tee_names) {
          setCourseTeeNames(course.tee_names);
        }
      }
      
      // Load holes selection (convert to 9/18 format)
      const savedHoles = sessionStorage.getItem('selectedHoles');
      if (savedHoles) {
        if (savedHoles === "front9" || savedHoles === "back9") {
          setSelectedHoles("9");
        } else {
          setSelectedHoles("18");
        }
      }
      
      // Load tee color
      const savedTee = sessionStorage.getItem('userTeeColor');
      if (savedTee) {
        setTeeColor(savedTee);
      }
      
      // Initialize with current user
      const currentUserPlayer: Player = {
        odId: user.id,
        displayName: userName,
        handicap: userHandicap,
        teeColor: savedTee || DEFAULT_MEN_TEE,
        isTemporary: false,
        isCurrentUser: true,
      };
      
      // Load added players
      const savedPlayers = sessionStorage.getItem('roundPlayers');
      let additionalPlayers: Player[] = [];
      if (savedPlayers) {
        const parsed = JSON.parse(savedPlayers);
        additionalPlayers = parsed.map((p: any) => ({
          odId: p.odId || p.userId || `temp_${Date.now()}`,
          displayName: p.displayName,
          handicap: p.handicap,
          teeColor: p.teeColor || savedTee || DEFAULT_MEN_TEE,
          isTemporary: p.isTemporary || false,
          isCurrentUser: false,
        }));
      }
      
      setPlayers([currentUserPlayer, ...additionalPlayers]);
      
      // Load simple skins settings if previously saved
      const savedSettings = sessionStorage.getItem('simpleSkinsSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setSkinValue(settings.skinValue || 1);
        setCarryoverEnabled(settings.carryoverEnabled ?? true);
        if (settings.holesPlayed) {
          setSelectedHoles(settings.holesPlayed.toString() as "9" | "18");
        }
      }
    };
    loadData();
  }, []);

  const handleAddPlayer = (player: Player) => {
    setPlayers(prev => [...prev, { ...player, teeColor: player.teeColor || teeColor }]);
  };

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    setPlayers(prev => prev.map(p => p.odId === updatedPlayer.odId ? updatedPlayer : p));
  };

  const handleRemovePlayer = (odId: string) => {
    setPlayers(prev => prev.filter(p => p.odId !== odId));
  };

  const handleStartRound = async () => {
    if (!selectedCourse) {
      toast({ title: "Course required", description: "Please go back and select a course", variant: "destructive" });
      return;
    }

    if (players.length < 2) {
      toast({ title: "More players needed", description: "Skins requires at least 2 players", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const holesPlayed = parseInt(selectedHoles);

      const { data: round, error } = await supabase
        .from("rounds")
        .insert({
          user_id: user.id,
          course_name: selectedCourse.name,
          tee_set: teeColor,
          holes_played: holesPlayed,
          origin: 'simple_skins',
          date_played: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;

      // Add all players (filter out temp players for database)
      const playersToAdd = players
        .filter(p => !p.isTemporary)
        .map(p => ({
          round_id: round.id,
          user_id: p.odId,
          tee_color: p.teeColor || teeColor,
          handicap: p.handicap,
        }));

      if (playersToAdd.length > 0) {
        const { error: playersError } = await supabase
          .from('round_players')
          .insert(playersToAdd);

        if (playersError) {
          console.error("Error adding players:", playersError);
        }
      }

      // Save settings for the tracker
      sessionStorage.setItem('simpleSkinsSettings', JSON.stringify({
        skinValue,
        carryoverEnabled,
        holesPlayed,
        players: players.map(p => ({
          odId: p.odId,
          displayName: p.displayName,
          handicap: p.handicap,
          teeColor: p.teeColor,
          isTemporary: p.isTemporary,
        })),
      }));

      // Clear setup sessionStorage
      sessionStorage.removeItem('roundPlayers');
      sessionStorage.removeItem('userTeeColor');
      sessionStorage.removeItem('selectedCourse');
      sessionStorage.removeItem('selectedHoles');
      sessionStorage.removeItem('roundName');
      sessionStorage.removeItem('datePlayed');

      toast({ title: "Game started!", description: `Good luck at ${selectedCourse.name}` });
      navigate(`/simple-skins/${round.id}/track`);
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
          <h1 className="text-2xl font-bold text-foreground">Simple Skins Setup</h1>
        </div>

        {/* Course Info - Compact */}
        {selectedCourse && (
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{selectedCourse.name}</span>
                <span className="text-muted-foreground text-sm ml-2">
                  {selectedHoles} holes
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Players Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users size={20} className="text-primary" />
              Players
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {players.map((player) => (
              <SetupPlayerCard
                key={player.odId}
                player={player}
                onEdit={() => setEditingPlayer(player)}
                onRemove={player.isCurrentUser ? undefined : () => handleRemovePlayer(player.odId)}
                showTee={true}
              />
            ))}
            
            <SetupAddPlayerButtons
              onAddFriend={() => setShowAddFriend(true)}
              onAddGuest={() => setShowAddGuest(true)}
            />
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
            {/* Holes */}
            <div className="space-y-2">
              <Label>Holes</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={selectedHoles === "9" ? "default" : "outline"}
                  onClick={() => setSelectedHoles("9")}
                  className="flex-1"
                >
                  9 Holes
                </Button>
                <Button
                  type="button"
                  variant={selectedHoles === "18" ? "default" : "outline"}
                  onClick={() => setSelectedHoles("18")}
                  className="flex-1"
                >
                  18 Holes
                </Button>
              </div>
            </div>

            {/* Default Tee */}
            <div className="space-y-2">
              <Label>Default Tee Box</Label>
              <TeeSelector
                value={teeColor}
                onValueChange={(v) => {
                  setTeeColor(v);
                  setPlayers(prev => prev.map(p => ({ ...p, teeColor: v })));
                }}
                teeCount={teeCount}
                courseTeeNames={courseTeeNames}
              />
            </div>

            {/* Skin Value */}
            <div className="space-y-2">
              <Label>Skin Value</Label>
              <Select 
                value={skinValue.toString()} 
                onValueChange={(value) => setSkinValue(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select skin value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 skin per hole</SelectItem>
                  <SelectItem value="2">2 skins per hole</SelectItem>
                  <SelectItem value="5">5 skins per hole</SelectItem>
                  <SelectItem value="10">10 skins per hole</SelectItem>
                  <SelectItem value="20">20 skins per hole</SelectItem>
                  <SelectItem value="50">50 skins per hole</SelectItem>
                  <SelectItem value="progressive">1 skin first 6, 2 skins next 6, 3 skins last 6</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Carryover toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="carryover">Carryover</Label>
                <p className="text-xs text-muted-foreground">
                  Ties carry the skin to the next hole
                </p>
              </div>
              <Switch
                id="carryover"
                checked={carryoverEnabled}
                onCheckedChange={setCarryoverEnabled}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleStartRound} disabled={loading || !selectedCourse} className="w-full" size="lg">
          {loading ? "Starting..." : "Start Game"}
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

      {/* Add Friend Sheet */}
      <SetupAddFriendSheet
        isOpen={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        onAddPlayer={handleAddPlayer}
        existingPlayerIds={existingPlayerIds}
        defaultTee={teeColor}
      />

      {/* Add Guest Sheet */}
      <SetupAddGuestSheet
        isOpen={showAddGuest}
        onClose={() => setShowAddGuest(false)}
        onAddPlayer={handleAddPlayer}
        defaultTee={teeColor}
      />
    </div>
  );
}
