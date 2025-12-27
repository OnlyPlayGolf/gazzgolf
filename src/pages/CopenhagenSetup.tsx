import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Settings, Plus } from "lucide-react";
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
import { SetupAddPlayerButtons } from "@/components/play/SetupAddPlayerButtons";
import { SetupPlayerEditSheet } from "@/components/play/SetupPlayerEditSheet";
import { SetupAddFriendSheet } from "@/components/play/SetupAddFriendSheet";
import { SetupAddGuestSheet } from "@/components/play/SetupAddGuestSheet";
import { STANDARD_TEE_OPTIONS, DEFAULT_MEN_TEE } from "@/components/TeeSelector";
import { PlayerGroup, createDefaultGroup } from "@/types/playSetup";
import type { Player } from "@/types/playSetup";

interface Course {
  id: string;
  name: string;
  location: string | null;
}

const PLAYERS_PER_GROUP = 3; // Copenhagen requires exactly 3 players

export default function CopenhagenSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  
  // Multi-group support: each group has exactly 3 players for Copenhagen
  const [groups, setGroups] = useState<PlayerGroup[]>([createDefaultGroup(0)]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  const [useHandicaps, setUseHandicaps] = useState(false);
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  const [gimmesEnabled, setGimmesEnabled] = useState(false);
  const [defaultTee, setDefaultTee] = useState(DEFAULT_MEN_TEE);

  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

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
      let savedDefaultTee = DEFAULT_MEN_TEE;
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
        setUseHandicaps(settings.useHandicaps || false);
        setGimmesEnabled(settings.gimmesEnabled || false);
        savedDefaultTee = settings.defaultTee || DEFAULT_MEN_TEE;
        setDefaultTee(savedDefaultTee);
      }

      const currentUserPlayer: Player = {
        odId: user.id,
        displayName: userName,
        username: profile?.username || '',
        handicap: userHandicap,
        teeColor: savedDefaultTee,
        isTemporary: false,
      };
      
      // Load saved groups from session storage or initialize with current user
      const savedGroups = sessionStorage.getItem('copenhagenGroups');
      if (savedGroups) {
        setGroups(JSON.parse(savedGroups));
      } else {
        // Initialize first group with current user
        setGroups([{
          ...createDefaultGroup(0),
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
      
      if (coursesData && coursesData.length > 0) {
        setSelectedCourseId(coursesData[0].id);
      }
    };
    loadData();
  }, []);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    setGroups(prev => prev.map(g => ({
      ...g,
      players: g.players.map(p => p.odId === updatedPlayer.odId ? { ...p, ...updatedPlayer } : p)
    })));
  };

  const handleAddPlayer = (player: Player) => {
    if (!activeGroupId) return;
    
    const group = groups.find(g => g.id === activeGroupId);
    if (!group) return;
    
    if (group.players.length >= PLAYERS_PER_GROUP) {
      toast({ title: "Group full", description: "Copenhagen requires exactly 3 players per group", variant: "destructive" });
      return;
    }
    
    setGroups(prev => prev.map(g => {
      if (g.id === activeGroupId) {
        return { ...g, players: [...g.players, { ...player, teeColor: player.teeColor || defaultTee }] };
      }
      return g;
    }));
    setShowAddFriend(false);
    setShowAddGuest(false);
  };

  const handleRemovePlayer = (groupId: string, playerId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return { ...g, players: g.players.filter(p => p.odId !== playerId) };
      }
      return g;
    }));
  };

  const handleAddGroup = () => {
    setGroups(prev => [...prev, createDefaultGroup(prev.length)]);
  };

  const handleRemoveGroup = (groupId: string) => {
    if (groups.length <= 1) {
      toast({ title: "Cannot remove", description: "At least one group is required", variant: "destructive" });
      return;
    }
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceGroupId = result.source.droppableId;
    const destGroupId = result.destination.droppableId;

    if (sourceGroupId === destGroupId) {
      // Reorder within same group
      setGroups(prev => prev.map(g => {
        if (g.id === sourceGroupId) {
          const newPlayers = [...g.players];
          const [removed] = newPlayers.splice(result.source.index, 1);
          newPlayers.splice(result.destination!.index, 0, removed);
          return { ...g, players: newPlayers };
        }
        return g;
      }));
    } else {
      // Move between groups - check if destination group has room
      const destGroup = groups.find(g => g.id === destGroupId);
      if (destGroup && destGroup.players.length >= PLAYERS_PER_GROUP) {
        toast({ title: "Group full", description: "Copenhagen groups can only have 3 players", variant: "destructive" });
        return;
      }

      setGroups(prev => {
        let movedPlayer: Player | null = null;
        
        // Remove from source
        const afterRemove = prev.map(g => {
          if (g.id === sourceGroupId) {
            movedPlayer = g.players[result.source.index];
            return { ...g, players: g.players.filter((_, i) => i !== result.source.index) };
          }
          return g;
        });
        
        // Add to destination
        if (movedPlayer) {
          return afterRemove.map(g => {
            if (g.id === destGroupId) {
              const newPlayers = [...g.players];
              newPlayers.splice(result.destination!.index, 0, movedPlayer!);
              return { ...g, players: newPlayers };
            }
            return g;
          });
        }
        
        return afterRemove;
      });
    }
  };

  const handleStartGame = async () => {
    // Validate all groups have exactly 3 players
    const invalidGroups = groups.filter(g => g.players.length !== PLAYERS_PER_GROUP);
    if (invalidGroups.length > 0) {
      toast({ 
        title: "Invalid groups", 
        description: `Each Copenhagen group needs exactly 3 players. ${invalidGroups.map(g => g.name).join(', ')} ${invalidGroups.length === 1 ? 'is' : 'are'} incomplete.`,
        variant: "destructive" 
      });
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
      const hasMultipleGroups = groups.length > 1;

      // Create an event if multiple groups
      let eventId: string | null = null;
      if (hasMultipleGroups) {
        const { data: event, error: eventError } = await supabase
          .from('events')
          .insert({
            creator_id: user.id,
            name: savedRoundName || 'Copenhagen Event',
            game_type: 'copenhagen',
            course_id: selectedCourseId || null,
            course_name: selectedCourse?.name || null,
          })
          .select()
          .single();

        if (eventError) throw eventError;
        eventId = event.id;
      }

      // Create a copenhagen game for each group
      const gamePromises = groups.map(async (group, index) => {
        let gameGroupId: string | null = null;

        // Create game_groups record if multiple groups
        if (hasMultipleGroups && eventId) {
          const { data: gameGroup, error: groupError } = await supabase
            .from('game_groups')
            .insert({
              event_id: eventId,
              game_type: 'copenhagen',
              group_name: group.name,
              group_index: index,
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

        const { data: game, error } = await supabase
          .from("copenhagen_games")
          .insert({
            user_id: user.id,
            course_name: selectedCourse?.name || "Copenhagen Game",
            course_id: selectedCourseId || null,
            round_name: hasMultipleGroups ? `${savedRoundName || 'Copenhagen'} - ${group.name}` : (savedRoundName || null),
            holes_played: 18,
            player_1: group.players[0].displayName,
            player_2: group.players[1].displayName,
            player_3: group.players[2].displayName,
            player_1_handicap: useHandicaps ? group.players[0].handicap : null,
            player_2_handicap: useHandicaps ? group.players[1].handicap : null,
            player_3_handicap: useHandicaps ? group.players[2].handicap : null,
            player_1_tee: group.players[0].teeColor || null,
            player_2_tee: group.players[1].teeColor || null,
            player_3_tee: group.players[2].teeColor || null,
            use_handicaps: useHandicaps,
            event_id: eventId,
            group_id: gameGroupId,
          })
          .select()
          .single();

        if (error) throw error;

        // Save settings to game-specific localStorage
        const copenhagenSettings = { mulligansPerPlayer, useHandicaps, gimmesEnabled, defaultTee };
        localStorage.setItem(`copenhagenSettings_${game.id}`, JSON.stringify(copenhagenSettings));

        return game;
      });

      const games = await Promise.all(gamePromises);

      // Save settings to session storage for future games
      sessionStorage.setItem('copenhagenSettings', JSON.stringify({ mulligansPerPlayer, useHandicaps, gimmesEnabled, defaultTee }));

      // Clear session storage
      sessionStorage.removeItem('copenhagenGroups');
      sessionStorage.removeItem('selectedCourse');
      sessionStorage.removeItem('roundName');

      if (games.length === 1) {
        toast({ title: "Copenhagen game started!" });
        navigate(`/copenhagen/${games[0].id}/play`);
      } else {
        toast({ title: `${games.length} Copenhagen games started!` });
        navigate(`/copenhagen/${games[0].id}/play`);
      }
    } catch (error: any) {
      toast({ title: "Error creating game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const allGroupsValid = groups.every(g => g.players.length === PLAYERS_PER_GROUP);
  const existingPlayerIds = groups.flatMap(g => g.players.map(p => p.odId));

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

        {/* Groups Section */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-4">
            {groups.map((group, groupIndex) => (
              <Card key={group.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                      <Users size={20} className="text-primary" />
                      {group.name} (3 players)
                    </div>
                    {groups.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleRemoveGroup(group.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Droppable droppableId={group.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-2 min-h-[60px] p-2 rounded-lg transition-colors ${
                          snapshot.isDraggingOver ? 'bg-primary/10 border-2 border-dashed border-primary' : ''
                        }`}
                      >
                        {group.players.map((player, index) => (
                          <Draggable key={player.odId} draggableId={player.odId} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={snapshot.isDragging ? "opacity-90" : ""}
                              >
                                <SetupPlayerCard
                                  player={{
                                    odId: player.odId,
                                    displayName: player.displayName,
                                    handicap: player.handicap,
                                    teeColor: player.teeColor,
                                    isTemporary: player.isTemporary,
                                    isCurrentUser: player.odId === currentUserId,
                                  }}
                                  onEdit={() => setEditingPlayer({
                                    ...player,
                                    username: player.username || '',
                                  })}
                                  onRemove={() => handleRemovePlayer(group.id, player.odId)}
                                  showTee={true}
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

                  {group.players.length < PLAYERS_PER_GROUP && (
                    <>
                      <div className="p-3 rounded-lg border border-dashed text-center text-muted-foreground text-sm">
                        Add {PLAYERS_PER_GROUP - group.players.length} more player{group.players.length === 2 ? '' : 's'}
                      </div>
                      <SetupAddPlayerButtons
                        onAddFriend={() => {
                          setActiveGroupId(group.id);
                          setShowAddFriend(true);
                        }}
                        onAddGuest={() => {
                          setActiveGroupId(group.id);
                          setShowAddGuest(true);
                        }}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DragDropContext>

        {/* Add Group Button */}
        <Button variant="outline" className="w-full" onClick={handleAddGroup}>
          <Plus size={16} className="mr-2" />
          Add Another Group
        </Button>

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
              <Label>Default Tee</Label>
              <Select value={defaultTee} onValueChange={setDefaultTee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select default tee" />
                </SelectTrigger>
                <SelectContent>
                  {STANDARD_TEE_OPTIONS.map((tee) => (
                    <SelectItem key={tee.value} value={tee.value}>
                      {tee.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Default tee for new players
              </p>
            </div>

            {/* Use Handicaps toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="handicap">Use Handicaps</Label>
                <p className="text-xs text-muted-foreground">
                  Apply player handicaps to scoring
                </p>
              </div>
              <Switch
                id="handicap"
                checked={useHandicaps}
                onCheckedChange={setUseHandicaps}
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
          </CardContent>
        </Card>

        {/* Start Button */}
        <Button
          onClick={handleStartGame}
          disabled={loading || !allGroupsValid}
          className="w-full h-12 text-lg font-semibold"
        >
          {loading ? "Starting..." : groups.length > 1 ? `Start ${groups.length} Games` : "Start Copenhagen Game"}
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
          onClose={() => {
            setShowAddFriend(false);
            setActiveGroupId(null);
          }}
          onAddPlayer={handleAddPlayer}
          existingPlayerIds={existingPlayerIds}
          defaultTee={defaultTee}
        />

        <SetupAddGuestSheet
          isOpen={showAddGuest}
          onClose={() => {
            setShowAddGuest(false);
            setActiveGroupId(null);
          }}
          onAddPlayer={handleAddPlayer}
          defaultTee={defaultTee}
        />
      </div>
    </div>
  );
}
