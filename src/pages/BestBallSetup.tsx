import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Shuffle, Trophy, Settings } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseHandicap, formatHandicap } from "@/lib/utils";
import { SetupPlayerCard } from "@/components/play/SetupPlayerCard";
import { SetupPlayerEditSheet } from "@/components/play/SetupPlayerEditSheet";
import { AddPlayerDialog } from "@/components/play/AddPlayerDialog";
import { BestBallPlayer, BestBallGameType } from "@/types/bestBall";
import { GAME_FORMAT_PLAYER_REQUIREMENTS } from "@/types/gameGroups";
import { StatsModeSelector, StatsMode } from "@/components/play/StatsModeSelector";

interface Course {
  id: string;
  name: string;
  location: string | null;
}

type GameType = BestBallGameType;
export default function BestBallSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Course
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  
  // Game settings
  const [gameType, setGameType] = useState<GameType>('match');
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");
  const [statsMode, setStatsMode] = useState<StatsMode>('none');
  
  // Players
  const [teamA, setTeamA] = useState<BestBallPlayer[]>([]);
  const [teamB, setTeamB] = useState<BestBallPlayer[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Sheets
  const [editingPlayer, setEditingPlayer] = useState<BestBallPlayer | null>(null);
  const [editingTeam, setEditingTeam] = useState<'A' | 'B' | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addToTeam, setAddToTeam] = useState<'A' | 'B'>('A');

  useEffect(() => {
    loadData();
  }, []);

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
    
    const currentUserPlayer: BestBallPlayer = {
      odId: user.id,
      displayName: userName,
      handicap: userHandicap,
      isTemporary: false,
    };
    
    // Load saved players from sessionStorage
    const savedPlayers = sessionStorage.getItem('roundPlayers');
    let additionalPlayers: BestBallPlayer[] = [];
    if (savedPlayers) {
      const parsed = JSON.parse(savedPlayers);
      additionalPlayers = parsed.map((p: any) => ({
        odId: p.odId || p.userId || `temp_${Date.now()}_${Math.random()}`,
        displayName: p.displayName,
        handicap: p.handicap,
        teeColor: p.teeColor,
        isTemporary: p.isTemporary || false,
      }));
    }
    
    // Auto-assign: current user to Team A, others distributed
    setTeamA([currentUserPlayer]);
    if (additionalPlayers.length >= 3) {
      setTeamA([currentUserPlayer, additionalPlayers[0]]);
      setTeamB([additionalPlayers[1], additionalPlayers[2]]);
    } else if (additionalPlayers.length >= 1) {
      setTeamB(additionalPlayers.slice(0, 2));
    }
    
    // Load courses
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

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  const handleAddPlayer = (player: any, team: 'A' | 'B') => {
    const newPlayer: BestBallPlayer = {
      odId: player.odId || `temp_${Date.now()}`,
      displayName: player.displayName,
      handicap: player.handicap,
      teeColor: player.teeColor,
      isTemporary: player.isTemporary,
    };
    
    if (team === 'A') {
      setTeamA(prev => [...prev, newPlayer]);
    } else {
      setTeamB(prev => [...prev, newPlayer]);
    }
  };

  const handleUpdatePlayer = (updatedPlayer: any) => {
    const player: BestBallPlayer = {
      odId: updatedPlayer.odId,
      displayName: updatedPlayer.displayName,
      handicap: updatedPlayer.handicap,
      teeColor: updatedPlayer.teeColor,
      isTemporary: updatedPlayer.isTemporary,
    };
    
    if (editingTeam === 'A') {
      setTeamA(prev => prev.map(p => p.odId === player.odId ? player : p));
    } else {
      setTeamB(prev => prev.map(p => p.odId === player.odId ? player : p));
    }
  };

  const handleRemovePlayer = (odId: string, team: 'A' | 'B') => {
    if (team === 'A') {
      setTeamA(prev => prev.filter(p => p.odId !== odId));
    } else {
      setTeamB(prev => prev.filter(p => p.odId !== odId));
    }
  };

  const handleRandomizeTeams = () => {
    const allPlayers = [...teamA, ...teamB];
    if (allPlayers.length < 2) {
      toast({ title: "Need at least 2 players", variant: "destructive" });
      return;
    }
    
    const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    setTeamA(shuffled.slice(0, half));
    setTeamB(shuffled.slice(half));
    toast({ title: "Teams randomized!" });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceTeam = result.source.droppableId as 'A' | 'B';
    const destTeam = result.destination.droppableId as 'A' | 'B';
    const sourceList = sourceTeam === 'A' ? [...teamA] : [...teamB];
    const destList = destTeam === 'A' ? [...teamA] : [...teamB];

    const [removed] = sourceList.splice(result.source.index, 1);

    if (sourceTeam === destTeam) {
      sourceList.splice(result.destination.index, 0, removed);
      if (sourceTeam === 'A') setTeamA(sourceList);
      else setTeamB(sourceList);
    } else {
      destList.splice(result.destination.index, 0, removed);
      if (sourceTeam === 'A') {
        setTeamA(sourceList);
        setTeamB(destList);
      } else {
        setTeamB(sourceList);
        setTeamA(destList);
      }
    }
  };

  // Validate teams - Best Ball requires at least 1 player per team and 3-8 total
  const req = GAME_FORMAT_PLAYER_REQUIREMENTS["best_ball"];
  const totalPlayers = teamA.length + teamB.length;
  
  const validateTeams = () => {
    if (teamA.length === 0) {
      return { valid: false, message: "Team A needs at least 1 player" };
    }
    if (teamB.length === 0) {
      return { valid: false, message: "Team B needs at least 1 player" };
    }
    if (totalPlayers < req.min) {
      return { valid: false, message: `Need at least ${req.min} total players (have ${totalPlayers})` };
    }
    if (totalPlayers > req.max) {
      return { valid: false, message: `Maximum ${req.max} total players allowed (have ${totalPlayers})` };
    }
    return { valid: true, message: null };
  };

  const teamValidation = validateTeams();

  const handleStartGame = async () => {
    if (!teamValidation.valid) {
      toast({ title: "Invalid team setup", description: teamValidation.message, variant: "destructive" });
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

      const { data: game, error } = await supabase
        .from("best_ball_games")
        .insert([{
          user_id: user.id,
          course_name: selectedCourse?.name || "Best Ball Game",
          course_id: selectedCourseId || null,
          round_name: savedRoundName || null,
          holes_played: holesPlayed,
          game_type: gameType,
          team_a_name: teamAName,
          team_a_players: teamA as unknown as any,
          team_b_name: teamBName,
          team_b_players: teamB as unknown as any,
          use_handicaps: false,
          mulligans_per_player: mulligansPerPlayer,
          stats_mode: statsMode,
        }])
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
            game_type: 'best_ball',
            stats_mode: statsMode,
          }, { onConflict: 'user_id,game_id,game_type' });
      } catch (e) {
        console.warn('Failed to save player stats mode preference:', e);
      }

      toast({ title: "Best Ball game started!" });
      navigate(`/best-ball/${game.id}/play`);
    } catch (error: any) {
      toast({ title: "Error creating game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const existingPlayerIds = [...teamA, ...teamB].map(p => p.odId);

  const renderTeamSection = (team: 'A' | 'B', players: BestBallPlayer[], teamName: string, setTeamName: (v: string) => void) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${team === 'A' ? 'bg-blue-500' : 'bg-red-500'}`} />
        <Input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          className="font-semibold h-8 w-32"
        />
      </div>
      <Droppable droppableId={team}>
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
                    <SetupPlayerCard
                      player={{
                        odId: player.odId,
                        displayName: player.displayName,
                        teeColor: player.teeColor || '',
                        handicap: player.handicap,
                        isTemporary: player.isTemporary,
                      }}
                      onEdit={() => {
                        setEditingPlayer(player);
                        setEditingTeam(team);
                      }}
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
  );

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rounds-play')} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Best Ball Setup</h1>
        </div>

        {/* Game Type Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy size={20} className="text-primary" />
              Game Type
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setGameType('match')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  gameType === 'match'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="font-semibold">Match Play</p>
                <p className="text-xs text-muted-foreground">Hole-by-hole wins</p>
              </button>
              <button
                onClick={() => setGameType('stroke')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  gameType === 'stroke'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="font-semibold">Stroke Play</p>
                <p className="text-xs text-muted-foreground">Total team score</p>
              </button>
            </div>
          </CardContent>
        </Card>

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

        {/* Teams */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users size={20} className="text-primary" />
                Teams
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRandomizeTeams}
                disabled={teamA.length + teamB.length < 2}
                className="gap-1"
              >
                <Shuffle size={14} />
                Randomize
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <DragDropContext onDragEnd={handleDragEnd}>
              {renderTeamSection('A', teamA, teamAName, setTeamAName)}
              <div className="border-t pt-4" />
              {renderTeamSection('B', teamB, teamBName, setTeamBName)}
            </DragDropContext>
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
              <div>
                <Label>Mulligans per Player</Label>
                <p className="text-xs text-muted-foreground">Extra shots allowed</p>
              </div>
              <Select value={mulligansPerPlayer.toString()} onValueChange={(v) => setMulligansPerPlayer(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
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

            <StatsModeSelector value={statsMode} onChange={setStatsMode} />
          </CardContent>
        </Card>

        {/* Start Button */}
        {!teamValidation.valid && teamValidation.message && (
          <p className="text-sm text-destructive text-center">{teamValidation.message}</p>
        )}

        <Button
          className="w-full h-14 text-lg font-bold"
          onClick={handleStartGame}
          disabled={loading || !teamValidation.valid}
        >
          {loading ? "Starting..." : "Start Best Ball"}
        </Button>
      </div>

      {/* Edit Sheet */}
      {editingPlayer && (
        <SetupPlayerEditSheet
          isOpen={!!editingPlayer}
          onClose={() => setEditingPlayer(null)}
          player={{
            odId: editingPlayer.odId,
            displayName: editingPlayer.displayName,
            teeColor: editingPlayer.teeColor || '',
            handicap: editingPlayer.handicap,
            isTemporary: editingPlayer.isTemporary,
          }}
          onSave={handleUpdatePlayer}
          availableTees={["White", "Yellow", "Blue", "Red"]}
        />
      )}

      {/* Add Player Dialog */}
      <AddPlayerDialog
        isOpen={showAddPlayer}
        onClose={() => setShowAddPlayer(false)}
        onAddPlayer={(player) => handleAddPlayer(player, addToTeam)}
        existingPlayerIds={existingPlayerIds}
        defaultTee="White"
      />
    </div>
  );
}
