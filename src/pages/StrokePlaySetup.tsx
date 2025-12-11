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

export default function StrokePlaySetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Course from sessionStorage
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedHoles, setSelectedHoles] = useState<"18" | "front9" | "back9">("18");
  const [teeColor, setTeeColor] = useState("");
  
  // Players (including current user)
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Game settings
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [gimmesEnabled, setGimmesEnabled] = useState(false);

  // Sheet states
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);

  const availableTees = ["White", "Yellow", "Blue", "Red", "Orange"];

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
        setSelectedCourse(JSON.parse(savedCourse));
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
      
      // Initialize with current user
      const currentUserPlayer: Player = {
        odId: user.id,
        displayName: userName,
        handicap: userHandicap,
        teeColor: savedTee || "",
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
          teeColor: p.teeColor || savedTee || "",
          isTemporary: p.isTemporary || false,
          isCurrentUser: false,
        }));
      }
      
      setPlayers([currentUserPlayer, ...additionalPlayers]);
      
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

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: round, error } = await supabase
        .from("rounds")
        .insert({
          user_id: user.id,
          course_name: selectedCourse.name,
          tee_set: teeColor,
          holes_played: getHolesPlayed(),
          origin: 'play',
          date_played: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;

      // Add all players (filter out temp players for database, keep for session)
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

      // Save settings
      sessionStorage.setItem('strokePlaySettings', JSON.stringify({
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

      toast({ title: "Round started!", description: `Good luck at ${selectedCourse.name}` });
      navigate(`/rounds/${round.id}/track`);
    } catch (error: any) {
      toast({ title: "Error creating round", description: error.message, variant: "destructive" });
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
            {/* Default Tee */}
            <div className="space-y-2">
              <Label>Default Tee Box</Label>
              <Select value={teeColor} onValueChange={(v) => {
                setTeeColor(v);
                // Update all players to new tee
                setPlayers(prev => prev.map(p => ({ ...p, teeColor: v })));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tee" />
                </SelectTrigger>
                <SelectContent>
                  {availableTees.map(tee => (
                    <SelectItem key={tee} value={tee}>{tee}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <SelectItem value="0">0 (No mulligans)</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="9">9 (1 per hole on 9)</SelectItem>
                  <SelectItem value="18">18 (1 per hole on 18)</SelectItem>
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

        <Button onClick={handleStartRound} disabled={loading || !selectedCourse} className="w-full" size="lg">
          {loading ? "Starting..." : "Start Round"}
        </Button>
      </div>

      {/* Edit Player Sheet */}
      <SetupPlayerEditSheet
        isOpen={!!editingPlayer}
        onClose={() => setEditingPlayer(null)}
        player={editingPlayer}
        availableTees={availableTees}
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
