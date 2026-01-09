import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Settings, Users, MapPin, Calendar, Flag, Hash, Trophy, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { TeeSelector } from "@/components/TeeSelector";

interface PlayerInfo {
  name: string;
  handicap?: number | null;
  tee?: string | null;
  team?: string | null;
}

interface RoundSetupData {
  format: string;
  courseName: string;
  datePlayed: string;
  holesPlayed: number;
  currentHole?: number;
  roundName?: string | null;
}

interface GameSettingsData {
  useHandicaps: boolean;
  mulligansPerPlayer: number;
  gimmesEnabled: boolean;
  teeColor: string;
}

export default function GameSettingsDetail() {
  const { gameType, gameId } = useParams();
  const [searchParams] = useSearchParams();
  const returnPath = searchParams.get("returnPath") || `/rounds/${gameId}/settings`;
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [roundSetup, setRoundSetup] = useState<RoundSetupData | null>(null);
  const [settings, setSettings] = useState<GameSettingsData>({
    useHandicaps: false,
    mulligansPerPlayer: 0,
    gimmesEnabled: false,
    teeColor: "white",
  });

  useEffect(() => {
    if (gameId && gameType) {
      fetchGameData();
    }
  }, [gameId, gameType]);

  const fetchGameData = async () => {
    try {
      switch (gameType) {
        case "round":
          await fetchRoundData();
          break;
        case "skins":
          await fetchSkinsData();
          break;
        case "match-play":
          await fetchMatchPlayData();
          break;
        case "best-ball":
          await fetchBestBallData();
          break;
        case "copenhagen":
          await fetchCopenhagenData();
          break;
        case "wolf":
          await fetchWolfData();
          break;
        case "scramble":
          await fetchScrambleData();
          break;
        case "umbriago":
          await fetchUmbriagioData();
          break;
        default:
          await fetchRoundData();
      }
    } catch (error) {
      console.error("Error fetching game data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoundData = async () => {
    const { data: roundData } = await supabase
      .from("rounds")
      .select("*")
      .eq("id", gameId)
      .single();

    if (roundData) {
      setRoundSetup({
        format: "Stroke Play",
        courseName: roundData.course_name,
        datePlayed: roundData.date_played,
        holesPlayed: roundData.holes_played,
        roundName: roundData.round_name,
      });

      // Load settings from localStorage
      const savedSettings = localStorage.getItem(`roundSettings_${gameId}`);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({
          useHandicaps: parsed.handicapEnabled || false,
          mulligansPerPlayer: parsed.mulligansPerPlayer || 0,
          gimmesEnabled: parsed.gimmesEnabled || false,
          teeColor: roundData.tee_set || "white",
        });
      } else {
        setSettings(prev => ({ ...prev, teeColor: roundData.tee_set || "white" }));
      }
    }

    const { data: playersData } = await supabase
      .from("round_players")
      .select("id, user_id, handicap, tee_color")
      .eq("round_id", gameId);

    if (playersData) {
      const userIds = playersData.map(p => p.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      setPlayers(playersData.map(p => ({
        name: profilesMap.get(p.user_id)?.display_name || profilesMap.get(p.user_id)?.username || "Player",
        handicap: p.handicap,
        tee: p.tee_color,
      })));
    }
  };

  const fetchSkinsData = async () => {
    const { data: roundData } = await supabase
      .from("rounds")
      .select("*")
      .eq("id", gameId)
      .single();

    if (roundData) {
      setRoundSetup({
        format: "Skins",
        courseName: roundData.course_name,
        datePlayed: roundData.date_played,
        holesPlayed: roundData.holes_played,
        roundName: roundData.round_name,
      });
      setSettings(prev => ({ ...prev, teeColor: roundData.tee_set || "white" }));
    }

    const { data: playersData } = await supabase
      .from("round_players")
      .select("id, user_id, handicap, tee_color")
      .eq("round_id", gameId);

    if (playersData) {
      const userIds = playersData.map(p => p.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      setPlayers(playersData.map(p => ({
        name: profilesMap.get(p.user_id)?.display_name || profilesMap.get(p.user_id)?.username || "Player",
        handicap: p.handicap,
        tee: p.tee_color,
      })));
    }
  };

  const fetchMatchPlayData = async () => {
    const { data } = await supabase
      .from("match_play_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      setRoundSetup({
        format: "Match Play",
        courseName: data.course_name,
        datePlayed: data.date_played,
        holesPlayed: data.holes_played,
        roundName: data.round_name,
      });
      setSettings({
        useHandicaps: data.use_handicaps || false,
        mulligansPerPlayer: data.mulligans_per_player || 0,
        gimmesEnabled: false,
        teeColor: data.tee_set || "white",
      });
      setPlayers([
        { name: data.player_1, handicap: data.player_1_handicap, tee: data.player_1_tee },
        { name: data.player_2, handicap: data.player_2_handicap, tee: data.player_2_tee },
      ]);
    }
  };

  const fetchBestBallData = async () => {
    const { data } = await supabase
      .from("best_ball_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      setRoundSetup({
        format: `Best Ball ${data.game_type === 'match' ? 'Match Play' : 'Stroke Play'}`,
        courseName: data.course_name,
        datePlayed: data.date_played,
        holesPlayed: data.holes_played,
        roundName: data.round_name,
      });
      setSettings({
        useHandicaps: data.use_handicaps || false,
        mulligansPerPlayer: data.mulligans_per_player || 0,
        gimmesEnabled: false,
        teeColor: "white",
      });
      
      const teamAPlayers = Array.isArray(data.team_a_players) ? data.team_a_players : [];
      const teamBPlayers = Array.isArray(data.team_b_players) ? data.team_b_players : [];
      
      setPlayers([
        ...teamAPlayers.map((p: any) => ({ name: p.displayName, handicap: p.handicap, tee: p.teeColor, team: data.team_a_name })),
        ...teamBPlayers.map((p: any) => ({ name: p.displayName, handicap: p.handicap, tee: p.teeColor, team: data.team_b_name })),
      ]);
    }
  };

  const fetchCopenhagenData = async () => {
    const { data } = await supabase
      .from("copenhagen_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      setRoundSetup({
        format: "Copenhagen",
        courseName: data.course_name,
        datePlayed: data.date_played,
        holesPlayed: data.holes_played,
        roundName: data.round_name,
      });
      
      const savedSettings = localStorage.getItem(`copenhagenSettings_${gameId}`);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({
          useHandicaps: data.use_handicaps || false,
          mulligansPerPlayer: parsed.mulligansPerPlayer || 0,
          gimmesEnabled: parsed.gimmesEnabled || false,
          teeColor: data.tee_set || "white",
        });
      } else {
        setSettings({
          useHandicaps: data.use_handicaps || false,
          mulligansPerPlayer: 0,
          gimmesEnabled: false,
          teeColor: data.tee_set || "white",
        });
      }
      
      setPlayers([
        { name: data.player_1, handicap: data.player_1_handicap, tee: data.player_1_tee },
        { name: data.player_2, handicap: data.player_2_handicap, tee: data.player_2_tee },
        { name: data.player_3, handicap: data.player_3_handicap, tee: data.player_3_tee },
      ]);
    }
  };

  const fetchWolfData = async () => {
    const { data } = await supabase
      .from("wolf_games" as any)
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      const wolfData = data as any;
      setRoundSetup({
        format: "Wolf",
        courseName: wolfData.course_name,
        datePlayed: wolfData.date_played,
        holesPlayed: wolfData.holes_played,
        roundName: wolfData.round_name,
      });
      setSettings({
        useHandicaps: false,
        mulligansPerPlayer: 0,
        gimmesEnabled: false,
        teeColor: wolfData.tee_set || "white",
      });
      
      const playerNames = [wolfData.player_1, wolfData.player_2, wolfData.player_3, wolfData.player_4, wolfData.player_5].filter(Boolean);
      setPlayers(playerNames.map((name: string) => ({ name })));
    }
  };

  const fetchScrambleData = async () => {
    const { data } = await supabase
      .from("scramble_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      setRoundSetup({
        format: "Scramble",
        courseName: data.course_name,
        datePlayed: data.date_played,
        holesPlayed: data.holes_played,
        roundName: data.round_name,
      });
      setSettings({
        useHandicaps: data.use_handicaps || false,
        mulligansPerPlayer: 0,
        gimmesEnabled: false,
        teeColor: data.tee_set || "white",
      });
      
      const teams = Array.isArray(data.teams) ? data.teams : [];
      setPlayers(teams.flatMap((team: any) => 
        team.players?.map((p: any) => ({ name: p.name, handicap: p.handicap, team: team.name })) || []
      ));
    }
  };

  const fetchUmbriagioData = async () => {
    const { data } = await supabase
      .from("umbriago_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      setRoundSetup({
        format: "Umbriago",
        courseName: data.course_name,
        datePlayed: data.date_played,
        holesPlayed: data.holes_played,
        roundName: data.round_name,
      });
      setSettings({
        useHandicaps: false,
        mulligansPerPlayer: 0,
        gimmesEnabled: false,
        teeColor: data.tee_set || "white",
      });
      setPlayers([
        { name: data.team_a_player_1, team: "Team A" },
        { name: data.team_a_player_2, team: "Team A" },
        { name: data.team_b_player_1, team: "Team B" },
        { name: data.team_b_player_2, team: "Team B" },
      ]);
    }
  };

  const handleBack = () => {
    navigate(returnPath);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!roundSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Game not found</div>
      </div>
    );
  }

  const holesDisplay = roundSetup.currentHole 
    ? `${roundSetup.currentHole} / ${roundSetup.holesPlayed}` 
    : `${roundSetup.holesPlayed} holes`;

  const uniqueTees = [...new Set(players.map(p => p.tee).filter(Boolean))];
  const teeInfo = uniqueTees.length === 0 ? (settings.teeColor || "Not specified") :
                  uniqueTees.length === 1 ? uniqueTees[0]! : "Mixed tees";

  const teamsMap = players.reduce((acc, p) => {
    if (p.team) {
      if (!acc[p.team]) acc[p.team] = [];
      acc[p.team].push(p);
    }
    return acc;
  }, {} as Record<string, PlayerInfo[]>);

  const hasTeams = Object.keys(teamsMap).length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="mr-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">Game Settings</h1>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Round Setup Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Round Setup
            </CardTitle>
            {roundSetup.roundName && (
              <p className="text-sm text-muted-foreground mt-1">{roundSetup.roundName}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <Flag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Format</p>
                  <p className="font-medium">{roundSetup.format}</p>
                </div>
              </div>

              <div className="flex items-start gap-2 min-w-0">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 overflow-hidden">
                  <p className="text-muted-foreground text-xs">Course</p>
                  <p className="font-medium truncate">{roundSetup.courseName}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Date</p>
                  <p className="font-medium">{formatDate(roundSetup.datePlayed)}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Hash className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Holes</p>
                  <p className="font-medium">{holesDisplay}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="h-4 w-4 flex items-center justify-center text-muted-foreground mt-0.5 shrink-0">
                  <span className="text-xs font-bold">T</span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Tees</p>
                  <p className="font-medium capitalize">{teeInfo}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Groups & Players Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Groups & Players
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasTeams ? (
              <div className="space-y-4">
                {Object.entries(teamsMap).map(([teamName, teamPlayers]) => (
                  <div key={teamName}>
                    <p className="text-sm font-medium text-muted-foreground mb-2">{teamName}</p>
                    <div className="space-y-2">
                      {teamPlayers.map((player, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                          <span className="font-medium">{player.name}</span>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {player.handicap !== undefined && player.handicap !== null && (
                              <span>HCP {player.handicap}</span>
                            )}
                            {player.tee && (
                              <span className="capitalize">{player.tee}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {players.map((player, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                    <span className="font-medium">{player.name}</span>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {player.handicap !== undefined && player.handicap !== null && (
                        <span>HCP {player.handicap}</span>
                      )}
                      {player.tee && (
                        <span className="capitalize">{player.tee}</span>
                      )}
                    </div>
                  </div>
                ))}
                {players.length === 0 && (
                  <p className="text-sm text-muted-foreground">No players found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Game Settings Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Game Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Default Tee */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label>Default Tee Box</Label>
                <p className="text-xs text-muted-foreground">
                  Tee box for this round
                </p>
              </div>
              <span className="text-sm font-medium capitalize">{settings.teeColor}</span>
            </div>

            {/* Handicaps */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label>Use Handicaps</Label>
                <p className="text-xs text-muted-foreground">
                  Apply player handicaps to scoring
                </p>
              </div>
              <span className="text-sm font-medium">{settings.useHandicaps ? "Yes" : "No"}</span>
            </div>

            {/* Mulligans */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label>Mulligans per Player</Label>
                <p className="text-xs text-muted-foreground">
                  Extra shots allowed per player
                </p>
              </div>
              <span className="text-sm font-medium">
                {settings.mulligansPerPlayer === 0 ? "None" : 
                 settings.mulligansPerPlayer === 9 ? "1 per 9 holes" : 
                 settings.mulligansPerPlayer}
              </span>
            </div>

            {/* Gimmes */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label>Allow Gimmes</Label>
                <p className="text-xs text-muted-foreground">
                  Short putts can be conceded
                </p>
              </div>
              <span className="text-sm font-medium">{settings.gimmesEnabled ? "Yes" : "No"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
