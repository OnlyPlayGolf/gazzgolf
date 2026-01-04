import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Swords } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseHandicap } from "@/lib/utils";
import { SetupPlayerCard } from "@/components/play/SetupPlayerCard";
import { SetupPlayerEditSheet } from "@/components/play/SetupPlayerEditSheet";
import { STANDARD_TEE_OPTIONS, DEFAULT_MEN_TEE } from "@/components/TeeSelector";
import { GAME_FORMAT_PLAYER_REQUIREMENTS } from "@/types/gameGroups";
import { PlayerGroup, Player as SetupPlayer } from "@/types/playSetup";

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

interface MatchGroup {
  id: string;
  name: string;
  players: Player[];
}

export default function MatchPlaySetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  
  const [groups, setGroups] = useState<MatchGroup[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  const [useHandicaps, setUseHandicaps] = useState(false);
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);

  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

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
      
      // Load groups from sessionStorage (set by RoundsPlay)
      const savedGroups = sessionStorage.getItem('roundGroups');
      
      if (savedGroups) {
        const parsedGroups: PlayerGroup[] = JSON.parse(savedGroups);
        const matchGroups: MatchGroup[] = parsedGroups.map(g => ({
          id: g.id,
          name: g.name,
          players: g.players.map(p => ({
            odId: p.odId,
            displayName: p.displayName,
            handicap: p.handicap,
            teeColor: p.teeColor || DEFAULT_MEN_TEE,
            isTemporary: p.isTemporary || false,
            isCurrentUser: p.odId === user.id,
          })),
        }));
        setGroups(matchGroups);
      } else {
        // Fallback: create default group with current user
        const currentUserPlayer: Player = {
          odId: user.id,
          displayName: userName,
          handicap: userHandicap,
          teeColor: DEFAULT_MEN_TEE,
          isTemporary: false,
          isCurrentUser: true,
        };
        setGroups([{
          id: 'default_group',
          name: 'Match 1',
          players: [currentUserPlayer],
        }]);
      }
      
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
        .from('match_play_games')
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

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    if (!editingGroupId) return;
    setGroups(prev => prev.map(g => 
      g.id === editingGroupId 
        ? { ...g, players: g.players.map(p => p.odId === updatedPlayer.odId ? updatedPlayer : p) }
        : g
    ));
  };

  // Validate player count per group
  const req = GAME_FORMAT_PLAYER_REQUIREMENTS["match_play"];
  
  const getGroupValidation = (group: MatchGroup): { valid: boolean; message: string | null } => {
    const playerCount = group.players.length;
    if (req.allowedCounts && !req.allowedCounts.includes(playerCount)) {
      const allowedStr = req.allowedCounts.join(" or ");
      return { valid: false, message: `${group.name} needs ${allowedStr} players (has ${playerCount})` };
    }
    return { valid: true, message: null };
  };

  const allGroupsValid = groups.length > 0 && groups.every(g => getGroupValidation(g).valid);
  const invalidGroups = groups.filter(g => !getGroupValidation(g).valid);

  const handleStartGame = async () => {
    if (!allGroupsValid) {
      const firstInvalid = invalidGroups[0];
      const validation = getGroupValidation(firstInvalid);
      toast({ title: "Invalid player count", description: validation.message, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const savedRoundName = sessionStorage.getItem('roundName');

      // For now, start the first group as a game (multi-group support can be extended later)
      const firstGroup = groups[0];
      if (firstGroup.players.length < 2) {
        toast({ title: "Not enough players", description: "Need at least 2 players", variant: "destructive" });
        return;
      }

      const { data: game, error } = await supabase
        .from("match_play_games")
        .insert({
          user_id: user.id,
          course_name: selectedCourse?.name || "Match Play Game",
          course_id: selectedCourseId || null,
          round_name: savedRoundName || null,
          holes_played: 18,
          player_1: firstGroup.players[0].displayName,
          player_1_handicap: firstGroup.players[0].handicap || null,
          player_2: firstGroup.players[1].displayName,
          player_2_handicap: firstGroup.players[1].handicap || null,
          use_handicaps: useHandicaps,
          mulligans_per_player: mulligansPerPlayer,
          match_status: 0,
          holes_remaining: 18,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Match Play game started!" });
      navigate(`/match-play/${game.id}/play`);
    } catch (error: any) {
      toast({ title: "Error creating game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceGroupId = result.source.droppableId;
    const destGroupId = result.destination.droppableId;
    
    if (sourceGroupId === destGroupId) {
      // Reorder within same group
      setGroups(prev => prev.map(g => {
        if (g.id !== sourceGroupId) return g;
        const newPlayers = [...g.players];
        const [removed] = newPlayers.splice(result.source.index, 1);
        newPlayers.splice(result.destination!.index, 0, removed);
        return { ...g, players: newPlayers };
      }));
    }
  };

  // Helper to determine match label for 2 or 4 player groups
  const getMatchLabels = (playerCount: number) => {
    if (playerCount === 2) {
      return [{ players: [0, 1], label: "vs" }];
    } else if (playerCount === 4) {
      return [
        { players: [0, 1], label: "Team 1" },
        { players: [2, 3], label: "Team 2" },
      ];
    }
    return [];
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rounds-play')} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Match Play Setup</h1>
        </div>

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

        {/* Display each group as a separate match */}
        {groups.map((group, groupIndex) => {
          const validation = getGroupValidation(group);
          const matchLabels = getMatchLabels(group.players.length);
          const is4Player = group.players.length === 4;
          
          return (
            <Card key={group.id} className={!validation.valid ? "border-destructive" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center gap-2">
                    <Swords size={20} className="text-primary" />
                    {groups.length > 1 ? `Match ${groupIndex + 1}: ${group.name}` : "Match"}
                  </div>
                  <span className="text-sm font-normal text-muted-foreground">
                    {group.players.length === 2 ? "1v1" : group.players.length === 4 ? "2v2" : `${group.players.length} players`}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId={group.id}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-2 min-h-[60px]"
                      >
                        {group.players.map((player, index) => {
                          // Determine player label
                          let playerLabel = "";
                          let labelColor = "";
                          
                          if (is4Player) {
                            if (index < 2) {
                              playerLabel = `Team 1 - Player ${index + 1}`;
                              labelColor = "text-blue-600";
                            } else {
                              playerLabel = `Team 2 - Player ${index - 1}`;
                              labelColor = "text-red-600";
                            }
                          } else {
                            playerLabel = index === 0 ? "Player 1" : "Player 2";
                            labelColor = index === 0 ? "text-blue-600" : "text-red-600";
                          }
                          
                          return (
                            <Draggable key={player.odId} draggableId={`${group.id}-${player.odId}`} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={snapshot.isDragging ? "opacity-90" : ""}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-sm font-medium ${labelColor}`}>
                                      {playerLabel}
                                    </span>
                                  </div>
                                  <SetupPlayerCard
                                    player={player}
                                    onEdit={() => {
                                      setEditingPlayer(player);
                                      setEditingGroupId(group.id);
                                    }}
                                    showTee={false}
                                    dragHandleProps={provided.dragHandleProps}
                                  />
                                  {/* Show VS divider for 1v1 or team divider for 2v2 */}
                                  {group.players.length === 2 && index === 0 && (
                                    <div className="flex items-center justify-center my-3">
                                      <div className="flex-1 h-px bg-border" />
                                      <span className="px-3 text-sm font-bold text-muted-foreground">VS</span>
                                      <div className="flex-1 h-px bg-border" />
                                    </div>
                                  )}
                                  {group.players.length === 4 && index === 1 && (
                                    <div className="flex items-center justify-center my-3">
                                      <div className="flex-1 h-px bg-border" />
                                      <span className="px-3 text-sm font-bold text-muted-foreground">VS</span>
                                      <div className="flex-1 h-px bg-border" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
                
                {!validation.valid && validation.message && (
                  <p className="text-sm text-destructive">{validation.message}</p>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Game Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="handicaps">Use Handicaps</Label>
              <Switch
                id="handicaps"
                checked={useHandicaps}
                onCheckedChange={setUseHandicaps}
              />
            </div>
            {useHandicaps && (
              <p className="text-xs text-muted-foreground">
                Strokes will be allocated based on handicap difference and stroke index
              </p>
            )}

            <div className="space-y-2 pt-2">
              <Label htmlFor="mulligans">Mulligans per Player</Label>
              <Select 
                value={mulligansPerPlayer.toString()} 
                onValueChange={(value) => setMulligansPerPlayer(parseInt(value))}
              >
                <SelectTrigger id="mulligans">
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
                Number of allowed do-overs per player during the match
              </p>
            </div>
          </CardContent>
        </Card>

        {!allGroupsValid && invalidGroups.length > 0 && (
          <p className="text-sm text-destructive text-center">
            {invalidGroups.length === 1 
              ? getGroupValidation(invalidGroups[0]).message 
              : `${invalidGroups.length} groups have invalid player counts`}
          </p>
        )}

        <Button
          className="w-full h-14 text-lg font-semibold"
          onClick={handleStartGame}
          disabled={loading || !allGroupsValid}
        >
          {loading ? "Starting..." : groups.length > 1 ? `Start ${groups.length} Matches` : "Start Match"}
        </Button>
      </div>

      <SetupPlayerEditSheet
        player={editingPlayer}
        isOpen={!!editingPlayer}
        onClose={() => {
          setEditingPlayer(null);
          setEditingGroupId(null);
        }}
        onSave={(updated) => {
          handleUpdatePlayer(updated);
          setEditingPlayer(null);
          setEditingGroupId(null);
        }}
        availableTees={STANDARD_TEE_OPTIONS.map(t => t.value)}
      />
    </div>
  );
}