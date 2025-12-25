import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Settings, Shuffle } from "lucide-react";
import { cn, parseHandicap } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { shuffleArray } from "@/utils/wolfScoring";
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

export default function WolfSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Course selection
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  
  // Players (3-5)
  const [players, setPlayers] = useState<Player[]>([]);
  const [shuffled, setShuffled] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Game settings
  const [loneWolfWinPoints, setLoneWolfWinPoints] = useState(3);
  const [loneWolfLossPoints, setLoneWolfLossPoints] = useState(1);
  const [teamWinPoints, setTeamWinPoints] = useState(1);
  const [wolfPosition, setWolfPosition] = useState<'first' | 'last'>('last');
  const [doubleEnabled, setDoubleEnabled] = useState(true);

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
        additionalPlayers = parsed.slice(0, 4).map((p: any) => ({
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
      
      if (coursesData && coursesData.length > 0) {
        setSelectedCourseId(coursesData[0].id);
      }
    };
    loadData();
  }, []);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  
  const handleAddPlayer = (player: Player) => {
    if (players.length >= 5) {
      toast({ title: "Maximum 5 players", description: "Remove a player to add another", variant: "destructive" });
      return;
    }
    setPlayers(prev => [...prev, player]);
    setShuffled(false);
  };

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    setPlayers(prev => prev.map(p => p.odId === updatedPlayer.odId ? updatedPlayer : p));
  };

  const handleRemovePlayer = (odId: string) => {
    setPlayers(prev => prev.filter(p => p.odId !== odId));
    setShuffled(false);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;
    
    const newPlayers = [...players];
    const [removed] = newPlayers.splice(sourceIndex, 1);
    newPlayers.splice(destIndex, 0, removed);
    setPlayers(newPlayers);
    setShuffled(true); // Mark as shuffled since order changed
  };
  
  const handleShuffle = () => {
    if (players.length < 3) {
      toast({ title: "Need at least 3 players to shuffle", variant: "destructive" });
      return;
    }
    
    const shuffledPlayers = shuffleArray([...players]);
    setPlayers(shuffledPlayers);
    setShuffled(true);
    toast({ title: "Player order randomized!" });
  };

  const handleStartGame = async () => {
    if (players.length < 3) {
      toast({ title: "At least 3 players required", variant: "destructive" });
      return;
    }
    
    if (!shuffled) {
      toast({ title: "Please shuffle the player order first", variant: "destructive" });
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
        .from("wolf_games" as any)
        .insert({
          user_id: user.id,
          course_name: selectedCourse?.name || "Wolf Game",
          course_id: selectedCourseId || null,
          round_name: savedRoundName || null,
          holes_played: 18,
          player_1: players[0]?.displayName || "",
          player_2: players[1]?.displayName || "",
          player_3: players[2]?.displayName || "",
          player_4: players[3]?.displayName || null,
          player_5: players[4]?.displayName || null,
          lone_wolf_win_points: loneWolfWinPoints,
          lone_wolf_loss_points: loneWolfLossPoints,
          team_win_points: teamWinPoints,
          wolf_position: wolfPosition,
          double_enabled: doubleEnabled,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Wolf game started!" });
      navigate(`/wolf/${(game as any).id}/play`);
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
          <h1 className="text-2xl font-bold text-foreground">Wolf Setup</h1>
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

        {/* Players Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users size={20} className="text-primary" />
              Players (3-5)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Drag to reorder or shuffle to randomize tee-off order.
            </p>
            
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="wolfPlayers">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {players.map((player, index) => (
                      <Draggable key={player.odId} draggableId={player.odId} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn("flex items-center gap-2", snapshot.isDragging ? "opacity-90" : "")}
                          >
                            <span className="w-6 text-sm font-medium text-muted-foreground text-center flex-shrink-0">
                              {shuffled ? `${index + 1}.` : '-'}
                            </span>
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

            {players.length < 5 && (
              <SetupAddPlayerButtons
                onAddFriend={() => setShowAddFriend(true)}
                onAddGuest={() => setShowAddGuest(true)}
              />
            )}
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleShuffle}
              disabled={players.length < 3}
            >
              <Shuffle size={18} className="mr-2" />
              {shuffled ? 'Reshuffle Order' : 'Randomize Tee-Off Order'}
            </Button>
            
            {shuffled && (
              <p className="text-sm text-green-600 text-center">
                ✓ Order set! Player 1 tees off first on Hole 1.
              </p>
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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Double</Label>
                <p className="text-xs text-muted-foreground">
                  Allow teams to double the points on a hole
                </p>
              </div>
              <Switch checked={doubleEnabled} onCheckedChange={setDoubleEnabled} />
            </div>

            <div className="space-y-2">
              <Label>Wolf Position</Label>
              <Select value={wolfPosition} onValueChange={(v) => setWolfPosition(v as 'first' | 'last')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last">Wolf tees off Last</SelectItem>
                  <SelectItem value="first">Wolf tees off First</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines whether the Wolf hits first or last on each hole
              </p>
            </div>
            
            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Points Settings</Label>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Lone Wolf Win Points</Label>
                <Select value={loneWolfWinPoints.toString()} onValueChange={(v) => setLoneWolfWinPoints(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n} points</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Lone Wolf Loss Points (per opponent)</Label>
                <Select value={loneWolfLossPoints.toString()} onValueChange={(v) => setLoneWolfLossPoints(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n} points</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Team Win Points (per player)</Label>
                <Select value={teamWinPoints.toString()} onValueChange={(v) => setTeamWinPoints(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n} points</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {!shuffled && players.length >= 3 && (
          <p className="text-sm text-muted-foreground text-center">
            Tap "Randomize Order" above to set the tee-off order before starting
          </p>
        )}
        
        <Button 
          onClick={handleStartGame} 
          disabled={loading || players.length < 3 || !shuffled} 
          className="w-full" 
          size="lg"
        >
          {loading ? "Starting..." : "Start Wolf Game"}
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
