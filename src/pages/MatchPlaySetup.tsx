import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin } from "lucide-react";
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

export default function MatchPlaySetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  const [useHandicaps, setUseHandicaps] = useState(false);
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);

  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

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
        teeColor: DEFAULT_MEN_TEE,
        isTemporary: false,
        isCurrentUser: true,
      };
      
      // Load players from all groups (multi-group support)
      const savedGroups = sessionStorage.getItem('playGroups');
      const savedPlayers = sessionStorage.getItem('roundPlayers');

      let playersFromStorage: Player[] = [];

      if (savedGroups) {
        const parsedGroups = JSON.parse(savedGroups);
        // Collect players from ALL groups
        for (const group of parsedGroups) {
          if (Array.isArray(group?.players)) {
            for (const p of group.players) {
              playersFromStorage.push({
                odId: p.odId || p.userId || `temp_${Date.now()}_${Math.random()}`,
                displayName: p.displayName,
                handicap: p.handicap,
                teeColor: p.teeColor,
                isTemporary: p.isTemporary || false,
                isCurrentUser: (p.odId || p.userId) === user.id,
              });
            }
          }
        }
      }

      if (playersFromStorage.length === 0 && savedPlayers) {
        const parsed = JSON.parse(savedPlayers);
        const additionalPlayers: Player[] = parsed.map((p: any) => ({
          odId: p.odId || p.userId || `temp_${Date.now()}`,
          displayName: p.displayName,
          handicap: p.handicap,
          isTemporary: p.isTemporary || false,
          isCurrentUser: false,
        }));
        playersFromStorage = [currentUserPlayer, ...additionalPlayers];
      }

      if (!playersFromStorage.some(p => p.odId === user.id)) {
        playersFromStorage = [currentUserPlayer, ...playersFromStorage];
      }

      setPlayers(playersFromStorage.map(p => ({ ...p, isCurrentUser: p.odId === user.id })));
      
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
    setPlayers(prev => prev.map(p => p.odId === updatedPlayer.odId ? updatedPlayer : p));
  };

  const handleStartGame = async () => {
    if (players.length !== 2) {
      toast({ title: "Need exactly 2 players", variant: "destructive" });
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

      // Save settings to localStorage for persistence during game
      localStorage.setItem(`matchPlaySettings_${Date.now()}`, JSON.stringify({
        mulligansPerPlayer,
      }));

      const { data: game, error } = await supabase
        .from("match_play_games")
        .insert({
          user_id: user.id,
          course_name: selectedCourse?.name || "Match Play Game",
          course_id: selectedCourseId || null,
          round_name: savedRoundName || null,
          holes_played: 18,
          player_1: players[0].displayName,
          player_1_handicap: players[0].handicap || null,
          player_2: players[1].displayName,
          player_2_handicap: players[1].handicap || null,
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

    const newPlayers = [...players];
    const [removed] = newPlayers.splice(result.source.index, 1);
    newPlayers.splice(result.destination.index, 0, removed);
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users size={20} className="text-primary" />
              Players (1 vs 1)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="players">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2 min-h-[60px]"
                  >
                    {players.map((player, index) => (
                      <Draggable key={player.odId} draggableId={player.odId} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={snapshot.isDragging ? "opacity-90" : ""}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${index === 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                {index === 0 ? 'Player 1' : 'Player 2'}
                              </span>
                            </div>
                            <SetupPlayerCard
                              player={player}
                              onEdit={() => setEditingPlayer(player)}
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
            </DragDropContext>
          </CardContent>
        </Card>

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

        <Button
          className="w-full h-14 text-lg font-semibold"
          onClick={handleStartGame}
          disabled={loading || players.length !== 2}
        >
          {loading ? "Starting..." : "Start Match"}
        </Button>
      </div>

      <SetupPlayerEditSheet
        player={editingPlayer}
        isOpen={!!editingPlayer}
        onClose={() => setEditingPlayer(null)}
        onSave={(updated) => {
          handleUpdatePlayer(updated);
          setEditingPlayer(null);
        }}
        availableTees={STANDARD_TEE_OPTIONS.map(t => t.value)}
      />
    </div>
  );
}
