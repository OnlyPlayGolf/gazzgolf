import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, MapPin, Users, ChevronRight, Check, Plus, X } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type HoleCount = "18" | "front9" | "back9";

interface Course {
  id: string;
  name: string;
  location: string;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
  white_distance: number | null;
  yellow_distance: number | null;
  blue_distance: number | null;
  red_distance: number | null;
  orange_distance: number | null;
}

export default function RoundsPlay() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedHoles, setSelectedHoles] = useState<HoleCount>("18");
  const [roundName, setRoundName] = useState(`Round ${new Date().toLocaleDateString()}`);
  const [datePlayer, setDatePlayed] = useState(new Date().toISOString().split('T')[0]);
  const [teeColor, setTeeColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableTees, setAvailableTees] = useState<string[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Array<{
    userId: string;
    teeColor: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
  }>>([]);
  const [playersDialogOpen, setPlayersDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchCourses();
    fetchFriends();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = courses.filter((course) =>
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCourses(filtered);
    } else {
      setFilteredCourses(courses);
    }
  }, [searchQuery, courses]);

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseTees(selectedCourse.id);
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("name");

      if (error) throw error;
      setCourses(data || []);
      setFilteredCourses(data || []);
    } catch (error: any) {
      console.error("Error fetching courses:", error);
    }
  };

  const fetchCourseTees = async (courseId: string) => {
    try {
      const { data, error } = await supabase
        .from("course_holes")
        .select("*")
        .eq("course_id", courseId)
        .limit(1)
        .single();

      if (error) throw error;

      const tees: string[] = [];
      if (data.white_distance) tees.push("White");
      if (data.yellow_distance) tees.push("Yellow");
      if (data.blue_distance) tees.push("Blue");
      if (data.red_distance) tees.push("Red");
      if (data.orange_distance) tees.push("Orange");

      setAvailableTees(tees);
      if (tees.length > 0 && !teeColor) {
        setTeeColor(tees[0]);
      }
    } catch (error: any) {
      console.error("Error fetching tees:", error);
      setAvailableTees(["White", "Yellow", "Blue", "Red", "Black"]);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setCurrentUser(data);
    } catch (error: any) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('friendships')
        .select(`
          user_a,
          user_b,
          profiles!friendships_user_a_fkey(id, username, display_name, avatar_url),
          profiles!friendships_user_b_fkey(id, username, display_name, avatar_url)
        `)
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendsList = data?.map((friendship: any) => {
        const friend = friendship.user_a === user.id 
          ? friendship.profiles[1]
          : friendship.profiles[0];
        return friend;
      }) || [];

      setFriends(friendsList);
    } catch (error: any) {
      console.error("Error fetching friends:", error);
    }
  };

  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
    setSearchQuery("");
  };

  const getHolesPlayed = (holeCount: HoleCount): number => {
    switch (holeCount) {
      case "front9":
        return 9;
      case "back9":
        return 9;
      default:
        return 18;
    }
  };

  const handleStartRound = async () => {
    if (!selectedCourse) {
      toast({
        title: "Course required",
        description: "Please select a course",
        variant: "destructive",
      });
      return;
    }

    if (!teeColor) {
      toast({
        title: "Tee color required",
        description: "Please select a tee color",
        variant: "destructive",
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

      const { data: round, error } = await supabase
        .from("rounds")
        .insert([
          {
            user_id: user.id,
            course_name: selectedCourse.name,
            tee_set: teeColor,
            holes_played: getHolesPlayed(selectedHoles),
            date_played: datePlayer,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Add current user as first player with their tee
      const playersToAdd = [{
        round_id: round.id,
        user_id: user.id,
        tee_color: teeColor
      }];

      // Add selected friends with their tees
      selectedPlayers.forEach(player => {
        playersToAdd.push({
          round_id: round.id,
          user_id: player.userId,
          tee_color: player.teeColor
        });
      });

      const { error: playersError } = await supabase
        .from('round_players')
        .insert(playersToAdd);

      if (playersError) {
        console.error("Error adding players:", playersError);
        // Continue anyway since the round was created
      }

      toast({
        title: "Round started!",
        description: `Good luck at ${selectedCourse.name}`,
      });

      navigate(`/rounds/${round.id}/track`);
    } catch (error: any) {
      toast({
        title: "Error creating round",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addPlayer = (friend: any) => {
    const isAlreadyAdded = selectedPlayers.some(p => p.userId === friend.id);
    if (isAlreadyAdded) return;

    setSelectedPlayers(prev => [...prev, {
      userId: friend.id,
      teeColor: availableTees[0] || "White",
      displayName: friend.display_name || friend.username,
      username: friend.username,
      avatarUrl: friend.avatar_url
    }]);
  };

  const removePlayer = (userId: string) => {
    setSelectedPlayers(prev => prev.filter(p => p.userId !== userId));
  };

  const updatePlayerTee = (userId: string, newTee: string) => {
    setSelectedPlayers(prev => prev.map(p => 
      p.userId === userId ? { ...p, teeColor: newTee } : p
    ));
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-6">
        {/* Course Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="text-primary" size={20} />
              Select Course
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedCourse ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {filteredCourses.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredCourses.map((course) => (
                      <button
                        key={course.id}
                        onClick={() => handleCourseSelect(course)}
                        className="w-full p-4 rounded-lg border-2 border-border hover:border-primary/50 text-left transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold group-hover:text-primary transition-colors">
                              {course.name}
                            </div>
                            <div className="text-sm text-muted-foreground">{course.location}</div>
                          </div>
                          <ChevronRight className="text-muted-foreground group-hover:text-primary transition-colors" size={20} />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">No courses found</p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{selectedCourse.name}</div>
                      <div className="text-sm text-muted-foreground">{selectedCourse.location}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCourse(null);
                        setTeeColor("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">How many holes are you playing?</Label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedHoles("18")}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        selectedHoles === "18"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-semibold">Full 18</div>
                      <div className="text-sm text-muted-foreground">Play all 18 holes</div>
                    </button>
                    <button
                      onClick={() => setSelectedHoles("front9")}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        selectedHoles === "front9"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-semibold">Front 9</div>
                      <div className="text-sm text-muted-foreground">Play holes 1-9</div>
                    </button>
                    <button
                      onClick={() => setSelectedHoles("back9")}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        selectedHoles === "back9"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-semibold">Back 9</div>
                      <div className="text-sm text-muted-foreground">Play holes 10-18</div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Game Setup */}
        {selectedCourse && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="text-primary" size={20} />
                Game Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="round-name">Round Name</Label>
                  <Input
                    id="round-name"
                    value={roundName}
                    onChange={(e) => setRoundName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-1">
                    <Calendar size={14} />
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={datePlayer}
                    onChange={(e) => setDatePlayed(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tee-color">Tee Color</Label>
                <Select value={teeColor} onValueChange={setTeeColor}>
                  <SelectTrigger id="tee-color">
                    <SelectValue placeholder="Select tee color" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTees.map((tee) => (
                      <SelectItem key={tee} value={tee}>
                        {tee}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Game Format</Label>
                <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                  <div className="font-semibold">Stroke Play</div>
                  <div className="text-sm text-muted-foreground">Standard scoring format</div>
                </div>
              </div>

              {/* Player Management */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Players</Label>
                <Dialog open={playersDialogOpen} onOpenChange={setPlayersDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Plus className="w-4 h-4" />
                      Add Players
                      {selectedPlayers.length > 0 && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          +{selectedPlayers.length} player{selectedPlayers.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Manage Players</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                      {/* Current User */}
                      {currentUser && (
                        <div className="p-4 rounded-lg bg-primary/5 border-2 border-primary">
                          <p className="text-sm font-medium text-muted-foreground mb-3">You</p>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={currentUser.avatar_url} />
                              <AvatarFallback>
                                {(currentUser.display_name || currentUser.username || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-semibold">
                                {currentUser.display_name || currentUser.username}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Playing HCP: {currentUser.handicap || '+0'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <Label className="text-xs">Tee Box</Label>
                            <Select value={teeColor} onValueChange={setTeeColor}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableTees.map((tee) => (
                                  <SelectItem key={tee} value={tee}>{tee}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Selected Players */}
                      {selectedPlayers.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Added Players</p>
                          {selectedPlayers.map((player) => (
                            <div key={player.userId} className="p-4 rounded-lg border">
                              <div className="flex items-start gap-3">
                                <Avatar className="w-12 h-12">
                                  <AvatarImage src={player.avatarUrl} />
                                  <AvatarFallback>
                                    {player.displayName.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-semibold">{player.displayName}</p>
                                      <p className="text-sm text-muted-foreground">@{player.username}</p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removePlayer(player.userId)}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Tee Box</Label>
                                    <Select
                                      value={player.teeColor}
                                      onValueChange={(value) => updatePlayerTee(player.userId, value)}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableTees.map((tee) => (
                                          <SelectItem key={tee} value={tee}>{tee}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Available Friends */}
                      {friends.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Add Friends</p>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {friends.filter(f => !selectedPlayers.some(p => p.userId === f.id)).map((friend) => (
                              <button
                                key={friend.id}
                                onClick={() => addPlayer(friend)}
                                className="w-full p-3 rounded-lg border hover:bg-accent transition-colors flex items-center gap-3"
                              >
                                <Avatar className="w-10 h-10">
                                  <AvatarImage src={friend.avatar_url} />
                                  <AvatarFallback>
                                    {(friend.display_name || friend.username).charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-left">
                                  <p className="font-medium">{friend.display_name || friend.username}</p>
                                  <p className="text-sm text-muted-foreground">@{friend.username}</p>
                                </div>
                                <Plus className="w-5 h-5 text-primary" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {friends.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No friends available. Add friends to play together!
                        </p>
                      )}

                      <Button 
                        onClick={() => setPlayersDialogOpen(false)} 
                        className="w-full"
                      >
                        Save & Close
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleStartRound}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? "Starting..." : "Start Round"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
