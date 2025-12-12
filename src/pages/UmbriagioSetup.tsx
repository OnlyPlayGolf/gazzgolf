import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Dice5, RefreshCw, Shuffle } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

type TeamRotation = "none" | "every9" | "every6";

interface TeamCombination {
  teamA: [string, string];
  teamB: [string, string];
}

function generateTeamCombinations(players: string[]): TeamCombination[] {
  if (players.length !== 4) return [];
  const [a, b, c, d] = players;
  return [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] },
  ];
}

function generateRotationSchedule(
  players: string[],
  rotation: TeamRotation,
  initialTeams: TeamCombination
): TeamCombination[] {
  if (rotation === "none") return [initialTeams];

  const allCombinations = generateTeamCombinations(players);
  const numSegments = rotation === "every9" ? 2 : 3;
  
  const initialIndex = allCombinations.findIndex(
    c => c.teamA.sort().join() === initialTeams.teamA.sort().join()
  );

  const remaining = allCombinations.filter((_, i) => i !== initialIndex);
  const shuffled = [...remaining].sort(() => Math.random() - 0.5);

  const schedule: TeamCombination[] = [initialTeams];
  
  for (let i = 1; i < numSegments; i++) {
    if (shuffled.length > 0) {
      schedule.push(shuffled[i - 1]);
    }
  }

  return schedule;
}

export default function UmbriagioSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Course selection
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  
  // Players for teams (need exactly 4)
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Game settings
  const [rollsPerTeam, setRollsPerTeam] = useState(1);
  const [teamRotation, setTeamRotation] = useState<TeamRotation>("none");
  const [teamsConfirmed, setTeamsConfirmed] = useState(false);

  // Sheet states
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
      
      // Load added players from sessionStorage
      const savedPlayers = sessionStorage.getItem('roundPlayers');
      let additionalPlayers: Player[] = [];
      if (savedPlayers) {
        const parsed = JSON.parse(savedPlayers);
        additionalPlayers = parsed.slice(0, 3).map((p: any) => ({
          odId: p.odId || p.userId || `temp_${Date.now()}`,
          displayName: p.displayName,
          handicap: p.handicap,
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
      
      const { data: lastGame } = await supabase
        .from('umbriago_games')
        .select('course_id')
        .eq('user_id', user.id)
        .not('course_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (lastGame?.course_id) {
        setSelectedCourseId(lastGame.course_id);
      } else if (coursesData && coursesData.length > 0) {
        setSelectedCourseId(coursesData[0].id);
      }
    };
    loadData();
  }, []);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  const handleAddPlayer = (player: Player) => {
    if (players.length >= 4) {
      toast({ title: "Maximum 4 players", description: "Remove a player to add another", variant: "destructive" });
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

  const handleRandomizeTeams = () => {
    if (players.length !== 4) {
      toast({ title: "Need exactly 4 players", variant: "destructive" });
      return;
    }
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    setPlayers(shuffled);
    setTeamsConfirmed(true);
    toast({ title: "Teams randomized!" });
  };

  const handleStartGame = async () => {
    if (players.length !== 4) {
      toast({ title: "Need exactly 4 players", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const playerNames = players.map(p => p.displayName);
      const initialTeams: TeamCombination = {
        teamA: [playerNames[0], playerNames[1]],
        teamB: [playerNames[2], playerNames[3]]
      };
      
      const rotationSchedule = generateRotationSchedule(playerNames, teamRotation, initialTeams);

      const { data: game, error } = await supabase
        .from("umbriago_games")
        .insert({
          user_id: user.id,
          course_name: selectedCourse?.name || "Umbriago Game",
          course_id: selectedCourseId || null,
          holes_played: 18,
          team_a_player_1: players[0].displayName,
          team_a_player_2: players[1].displayName,
          team_b_player_1: players[2].displayName,
          team_b_player_2: players[3].displayName,
          stake_per_point: 0,
          payout_mode: "difference",
          rolls_per_team: rollsPerTeam,
        })
        .select()
        .single();

      if (error) throw error;

      if (teamRotation !== "none") {
        sessionStorage.setItem(`umbriago_rotation_${game.id}`, JSON.stringify({
          type: teamRotation,
          schedule: rotationSchedule
        }));
      }

      toast({ title: "Umbriago game started!" });
      navigate(`/umbriago/${game.id}/play`);
    } catch (error: any) {
      toast({ title: "Error creating game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getRotationPreview = () => {
    if (teamRotation === "none" || players.length !== 4) return null;

    const playerNames = players.map(p => p.displayName);
    const initialTeams: TeamCombination = {
      teamA: [playerNames[0], playerNames[1]],
      teamB: [playerNames[2], playerNames[3]]
    };

    const schedule = generateRotationSchedule(playerNames, teamRotation, initialTeams);
    const holesPerSegment = teamRotation === "every9" ? 9 : 6;

    return (
      <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Rotation Preview:</p>
        {schedule.map((combo, i) => (
          <div key={i} className="text-sm">
            <span className="font-medium">Holes {i * holesPerSegment + 1}-{(i + 1) * holesPerSegment}:</span>
            <span className="ml-2 text-blue-600">{combo.teamA.join(" & ")}</span>
            <span className="mx-1">vs</span>
            <span className="text-red-600">{combo.teamB.join(" & ")}</span>
          </div>
        ))}
      </div>
    );
  };

  const existingPlayerIds = players.map(p => p.odId);

  // Split players into teams for display
  const teamA = players.slice(0, 2);
  const teamB = players.slice(2, 4);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceTeam = result.source.droppableId;
    const destTeam = result.destination.droppableId;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    // Convert to absolute indices in the players array
    const getAbsoluteIndex = (team: string, index: number) => {
      if (team === "teamA") return index;
      return 2 + index;
    };

    const sourceAbsolute = getAbsoluteIndex(sourceTeam, sourceIndex);
    const destAbsolute = getAbsoluteIndex(destTeam, destIndex);

    const newPlayers = [...players];
    const [removed] = newPlayers.splice(sourceAbsolute, 1);
    newPlayers.splice(destAbsolute, 0, removed);
    setPlayers(newPlayers);
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rounds-play')} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Umbriago Setup</h1>
        </div>

        {/* Course Selection - Compact */}
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

        {/* Teams Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users size={20} className="text-primary" />
                Teams (2 vs 2)
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRandomizeTeams}
                disabled={players.length !== 4}
                className="gap-1"
              >
                <Shuffle size={14} />
                Randomize
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {teamsConfirmed && (
              <p className="text-sm font-medium text-green-600 text-center">Teams confirmed!</p>
            )}
            <DragDropContext onDragEnd={handleDragEnd}>
              {/* Team A */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <Label className="font-semibold">Team A</Label>
                </div>
                <Droppable droppableId="teamA">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2 min-h-[60px]"
                    >
                      {teamA.map((player, index) => (
                        <Draggable key={player.odId} draggableId={player.odId} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={snapshot.isDragging ? "opacity-90" : ""}
                            >
                              <SetupPlayerCard
                                player={player}
                                onEdit={() => setEditingPlayer(player)}
                                onRemove={player.isCurrentUser ? undefined : () => handleRemovePlayer(player.odId)}
                                showTee={false}
                                dragHandleProps={provided.dragHandleProps}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              {/* Team B */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <Label className="font-semibold">Team B</Label>
                </div>
                <Droppable droppableId="teamB">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2 min-h-[60px]"
                    >
                      {teamB.map((player, index) => (
                        <Draggable key={player.odId} draggableId={player.odId} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={snapshot.isDragging ? "opacity-90" : ""}
                            >
                              <SetupPlayerCard
                                player={player}
                                onEdit={() => setEditingPlayer(player)}
                                onRemove={player.isCurrentUser ? undefined : () => handleRemovePlayer(player.odId)}
                                showTee={false}
                                dragHandleProps={provided.dragHandleProps}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </DragDropContext>

            {players.length < 4 && (
              <SetupAddPlayerButtons
                onAddFriend={() => setShowAddFriend(true)}
                onAddGuest={() => setShowAddGuest(true)}
              />
            )}
          </CardContent>
        </Card>

        {/* Game Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Dice5 size={20} className="text-primary" />
              Game Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Rolls per Team</Label>
              <Select value={rollsPerTeam.toString()} onValueChange={(v) => setRollsPerTeam(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No Rolls</SelectItem>
                  <SelectItem value="1">1 Roll</SelectItem>
                  <SelectItem value="2">2 Rolls</SelectItem>
                  <SelectItem value="3">3 Rolls</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A Roll halves your team's points and doubles the next hole
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <RefreshCw size={14} />
                Team Rotation
              </Label>
              <Select value={teamRotation} onValueChange={(v) => setTeamRotation(v as TeamRotation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Rotation (Fixed Teams)</SelectItem>
                  <SelectItem value="every9">Rotate Every 9 Holes</SelectItem>
                  <SelectItem value="every6">Rotate Every 6 Holes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {teamRotation === "none" && "Teams stay the same for all 18 holes"}
                {teamRotation === "every9" && "Teams shuffle randomly after 9 holes"}
                {teamRotation === "every6" && "Teams shuffle randomly every 6 holes"}
              </p>
              {getRotationPreview()}
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleStartGame} disabled={loading || players.length !== 4} className="w-full" size="lg">
          {loading ? "Starting..." : "Start Umbriago"}
        </Button>
      </div>

      {/* Edit Player Sheet */}
      <SetupPlayerEditSheet
        isOpen={!!editingPlayer}
        onClose={() => setEditingPlayer(null)}
        player={editingPlayer}
        onSave={handleUpdatePlayer}
      />

      {/* Add Friend Sheet */}
      <SetupAddFriendSheet
        isOpen={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        onAddPlayer={handleAddPlayer}
        existingPlayerIds={existingPlayerIds}
      />

      {/* Add Guest Sheet */}
      <SetupAddGuestSheet
        isOpen={showAddGuest}
        onClose={() => setShowAddGuest(false)}
        onAddPlayer={handleAddPlayer}
      />
    </div>
  );
}
