import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ScrambleBottomTabBar } from "@/components/ScrambleBottomTabBar";
import { ScrambleGame, ScrambleTeam } from "@/types/scramble";
import { Users, MapPin, Calendar, Flag, Settings } from "lucide-react";

export default function ScrambleInfo() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<ScrambleGame | null>(null);
  const [teams, setTeams] = useState<ScrambleTeam[]>([]);

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    const { data } = await supabase
      .from('scramble_games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (data) {
      setGame(data as unknown as ScrambleGame);
      setTeams((data.teams as unknown as ScrambleTeam[]) || []);
    }
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-4">
        <h1 className="text-xl font-bold text-center">Game Info</h1>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin size={18} />
              Course
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{game.course_name}</p>
            <p className="text-sm text-muted-foreground">{game.tee_set} tees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar size={18} />
              Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">{new Date(game.date_played).toLocaleDateString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag size={18} />
              Format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">Scramble - {game.holes_played} Holes</p>
            <p className="text-sm text-muted-foreground">
              {game.use_handicaps ? `Net (${game.scoring_type})` : 'Gross'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={18} />
              Teams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {teams.map((team) => (
              <div key={team.id} className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-semibold">{team.name}</h4>
                <div className="mt-2 space-y-1">
                  {team.players.map((player) => (
                    <p key={player.id} className="text-sm text-muted-foreground">
                      {player.name}
                      {player.handicap !== null && player.handicap !== undefined && ` (HCP: ${player.handicap})`}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {game.min_drives_per_player && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings size={18} />
                Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Minimum {game.min_drives_per_player} drive(s) per player required
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <ScrambleBottomTabBar gameId={gameId!} />
    </div>
  );
}
