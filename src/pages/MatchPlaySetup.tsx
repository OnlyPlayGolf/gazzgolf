import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Users } from "lucide-react";
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
import { DEFAULT_MEN_TEE, STANDARD_TEE_OPTIONS } from "@/components/TeeSelector";

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

interface SetupGroup {
  id: string;
  name: string;
  players: Player[];
}

const isValidMatchPlayGroupSize = (n: number) => n === 2 || n === 4;

export default function MatchPlaySetup() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  const [groups, setGroups] = useState<SetupGroup[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const [useHandicaps, setUseHandicaps] = useState(false);
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);

  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId),
    [courses, selectedCourseId]
  );

  const totalPlayers = useMemo(
    () => groups.reduce((acc, g) => acc + (g.players?.length || 0), 0),
    [groups]
  );

  useEffect(() => {
    const loadData = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username, handicap")
        .eq("id", user.id)
        .single();

      const userName = profile?.display_name || profile?.username || "You";
      const userHandicap = parseHandicap(profile?.handicap);

      const currentUserPlayer: Player = {
        odId: user.id,
        displayName: userName,
        handicap: userHandicap,
        teeColor: DEFAULT_MEN_TEE,
        isTemporary: false,
        isCurrentUser: true,
      };

      const savedGroupsRaw = sessionStorage.getItem("playGroups");
      const savedPlayersRaw = sessionStorage.getItem("roundPlayers");

      let groupsFromStorage: SetupGroup[] = [];

      if (savedGroupsRaw) {
        const parsed = JSON.parse(savedGroupsRaw);
        if (Array.isArray(parsed)) {
          groupsFromStorage = parsed.map((g: any, idx: number) => {
            const players: Player[] = Array.isArray(g?.players)
              ? g.players.map((p: any) => ({
                  odId: p.odId || p.userId || `temp_${Date.now()}_${Math.random()}`,
                  displayName: p.displayName,
                  handicap: p.handicap,
                  teeColor: p.teeColor,
                  isTemporary: p.isTemporary || false,
                  isCurrentUser: (p.odId || p.userId) === user.id,
                }))
              : [];

            return {
              id: g?.id || `group_${idx}`,
              name: g?.name || `Group ${String.fromCharCode(65 + idx)}`,
              players,
            };
          });
        }
      } else if (savedPlayersRaw) {
        // Legacy: roundPlayers (excludes current user)
        const parsed = JSON.parse(savedPlayersRaw);
        const additionalPlayers: Player[] = Array.isArray(parsed)
          ? parsed.map((p: any) => ({
              odId: p.odId || p.userId || `temp_${Date.now()}`,
              displayName: p.displayName,
              handicap: p.handicap,
              teeColor: p.teeColor,
              isTemporary: p.isTemporary || false,
              isCurrentUser: false,
            }))
          : [];

        groupsFromStorage = [
          {
            id: "group_0",
            name: "Group A",
            players: [currentUserPlayer, ...additionalPlayers],
          },
        ];
      }

      // Ensure current user exists somewhere
      const userExists = groupsFromStorage.some((g) => g.players.some((p) => p.odId === user.id));
      if (!userExists) {
        if (groupsFromStorage.length === 0) {
          groupsFromStorage = [{ id: "group_0", name: "Group A", players: [currentUserPlayer] }];
        } else {
          groupsFromStorage[0] = {
            ...groupsFromStorage[0],
            players: [currentUserPlayer, ...groupsFromStorage[0].players],
          };
        }
      }

      // Normalize current-user flag
      groupsFromStorage = groupsFromStorage.map((g) => ({
        ...g,
        players: g.players.map((p) => ({ ...p, isCurrentUser: p.odId === user.id })),
      }));

      setGroups(groupsFromStorage);

      const savedCourse = sessionStorage.getItem("selectedCourse");
      const { data: coursesData } = await supabase
        .from("courses")
        .select("id, name, location")
        .order("name");

      if (coursesData) setCourses(coursesData);

      if (savedCourse) {
        const course = JSON.parse(savedCourse);
        const matchingCourse = coursesData?.find((c) => c.name === course.name);
        if (matchingCourse) {
          setSelectedCourseId(matchingCourse.id);
          return;
        }
      }

      const { data: lastGame } = await supabase
        .from("match_play_games")
        .select("course_id")
        .eq("user_id", user.id)
        .not("course_id", "is", null)
        .order("created_at", { ascending: false })
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

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        players: g.players.map((p) => (p.odId === updatedPlayer.odId ? updatedPlayer : p)),
      }))
    );
  };

  const handleStartMatchForGroup = async (group: SetupGroup) => {
    if (!selectedCourseId) {
      toast({ title: "Course required", description: "Please select a course", variant: "destructive" });
      return;
    }

    const playerCount = group.players.length;
    if (!isValidMatchPlayGroupSize(playerCount)) {
      toast({
        title: "Invalid group size",
        description: `Match play requires 2 or 4 players per group. "${group.name}" has ${playerCount}.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        navigate("/auth");
        return;
      }

      const savedRoundName = sessionStorage.getItem("roundName");

      // For 4 players, we treat it as a team match (2 vs 2) by naming each side as a pair.
      const side1 =
        playerCount === 2
          ? group.players[0].displayName
          : `${group.players[0].displayName} & ${group.players[1].displayName}`;
      const side2 =
        playerCount === 2
          ? group.players[1].displayName
          : `${group.players[2].displayName} & ${group.players[3].displayName}`;

      const { data: game, error } = await supabase
        .from("match_play_games")
        .insert({
          user_id: user.id,
          course_name: selectedCourse?.name || "Match Play Game",
          course_id: selectedCourseId || null,
          round_name: savedRoundName || null,
          holes_played: 18,
          player_1: side1,
          player_1_handicap: group.players[0]?.handicap ?? null,
          player_2: side2,
          player_2_handicap: group.players[playerCount === 2 ? 1 : 2]?.handicap ?? null,
          use_handicaps: useHandicaps,
          mulligans_per_player: mulligansPerPlayer,
          match_status: 0,
          holes_remaining: 18,
        })
        .select()
        .single();

      if (error) throw error;

      // Optional: store roster for later UI usage
      localStorage.setItem(
        `matchPlayRoster_${game.id}`,
        JSON.stringify({ groupId: group.id, groupName: group.name, players: group.players })
      );

      toast({ title: `Match started (${group.name})!` });
      navigate(`/match-play/${game.id}/play`);
    } catch (error: any) {
      toast({ title: "Error creating match", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <main className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <header className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/rounds-play")} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Match Play Setup</h1>
        </header>

        <section className="space-y-2">
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
        </section>

        <section>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users size={20} className="text-primary" />
                Groups ({totalPlayers} players)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Match play requires <span className="font-medium text-foreground">2 or 4 players</span> per group.
              </p>

              {groups.length === 0 ? (
                <div className="text-sm text-muted-foreground">No groups found. Go back and add players.</div>
              ) : (
                <div className="space-y-4">
                  {groups.map((group) => {
                    const count = group.players.length;
                    const valid = isValidMatchPlayGroupSize(count);
                    return (
                      <article key={group.id} className="rounded-lg border border-border bg-card/50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h2 className="text-sm font-semibold text-foreground">{group.name}</h2>
                            <p className="text-xs text-muted-foreground">
                              {count} player{count === 1 ? "" : "s"} {valid ? "• Ready" : "• Needs 2 or 4"}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleStartMatchForGroup(group)}
                            disabled={loading || !valid || !selectedCourseId}
                          >
                            Start
                          </Button>
                        </div>

                        <div className="mt-3 space-y-2">
                          {group.players.map((player) => (
                            <SetupPlayerCard
                              key={player.odId}
                              player={{ ...player, isCurrentUser: player.odId === currentUserId }}
                              onEdit={() => setEditingPlayer(player)}
                              showTee={false}
                            />
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Game Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="handicaps">Use Handicaps</Label>
                <Switch id="handicaps" checked={useHandicaps} onCheckedChange={setUseHandicaps} />
              </div>

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
                <p className="text-xs text-muted-foreground">Number of allowed do-overs per player during the match</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <SetupPlayerEditSheet
        player={editingPlayer}
        isOpen={!!editingPlayer}
        onClose={() => setEditingPlayer(null)}
        onSave={(updated) => {
          handleUpdatePlayer(updated);
          setEditingPlayer(null);
        }}
        availableTees={STANDARD_TEE_OPTIONS.map((t) => t.value)}
      />
    </div>
  );
}
