import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Dices } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseHandicap, formatHandicap } from "@/lib/utils";
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

export default function CopenhagenSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [useHandicaps, setUseHandicaps] = useState(false);

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
      
      const currentUserPlayer: Player = {
        odId: user.id,
        displayName: userName,
        handicap: userHandicap,
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

  const handleStartGame = async () => {
    if (players.length !== 3) {
      toast({ title: "Need exactly 3 players", description: "Copenhagen requires 3 players", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: game, error } = await supabase
        .from("copenhagen_games")
        .insert({
          user_id: user.id,
          course_name: selectedCourse?.name || "Copenhagen Game",
          course_id: selectedCourseId || null,
          holes_played: 18,
          player_1: players[0].displayName,
          player_2: players[1].displayName,
          player_3: players[2].displayName,
          player_1_handicap: useHandicaps ? players[0].handicap : null,
          player_2_handicap: useHandicaps ? players[1].handicap : null,
          player_3_handicap: useHandicaps ? players[2].handicap : null,
          player_1_tee: players[0].teeColor || null,
          player_2_tee: players[1].teeColor || null,
          player_3_tee: players[2].teeColor || null,
          use_handicaps: useHandicaps,
        })
        .select()
        .single();

      if (error) throw error;

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
                onRemove={player.isCurrentUser ? undefined : () => handleRemovePlayer(player.odId)}
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
              <Dices size={20} className="text-primary" />
              Game Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Handicaps</Label>
              <Select value={useHandicaps ? "yes" : "no"} onValueChange={(v) => setUseHandicaps(v === "yes")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">Off</SelectItem>
                  <SelectItem value="yes">On</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Apply net scoring based on player handicaps
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Start Button */}
        <Button
          onClick={handleStartGame}
          disabled={loading || players.length !== 3}
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
          availableTees={["White", "Yellow", "Blue", "Red"]}
        />

        <SetupAddFriendSheet
          isOpen={showAddFriend}
          onClose={() => setShowAddFriend(false)}
          onAddPlayer={handleAddPlayer}
          existingPlayerIds={existingPlayerIds}
        />

        <SetupAddGuestSheet
          isOpen={showAddGuest}
          onClose={() => setShowAddGuest(false)}
          onAddPlayer={handleAddPlayer}
        />
      </div>
    </div>
  );
}
