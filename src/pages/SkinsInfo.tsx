import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { SkinsGame, SkinsHole, SkinsPlayer, SkinsPlayerScore } from "@/types/skins";
import { Trophy, Users, Info, Coins } from "lucide-react";
import { formatHandicap } from "@/utils/skinsScoring";

export default function SkinsInfo() {
  const { gameId } = useParams();
  const [game, setGame] = useState<SkinsGame | null>(null);
  const [holes, setHoles] = useState<SkinsHole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData } = await supabase
        .from("skins_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame({
          ...gameData,
          players: (gameData.players as unknown as SkinsPlayer[]) || [],
          handicap_mode: (gameData.handicap_mode as 'gross' | 'net') || 'net',
        });
      }

      const { data: holesData } = await supabase
        .from("skins_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData.map(h => ({
          ...h,
          player_scores: (h.player_scores as unknown as Record<string, SkinsPlayerScore>) || {},
        })));
      }
    } catch (error) {
      console.error("Error loading game:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <SkinsBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  // Calculate skins won per player
  const skinsWon: Record<string, number> = {};
  game.players.forEach(p => { skinsWon[p.name] = 0; });
  holes.forEach(h => {
    if (h.winner_player) {
      skinsWon[h.winner_player] = (skinsWon[h.winner_player] || 0) + h.skins_available;
    }
  });

  // Group players by their group
  const playersByGroup = game.players.reduce((acc, player) => {
    const group = player.group_name || 'Group 1';
    if (!acc[group]) acc[group] = [];
    acc[group].push(player);
    return acc;
  }, {} as Record<string, SkinsPlayer[]>);

  const sortedPlayers = [...game.players].sort((a, b) => (skinsWon[b.name] || 0) - (skinsWon[a.name] || 0));

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        {/* Game Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Skins Game</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Course</span>
              <span className="font-medium">{game.course_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Holes</span>
              <span className="font-medium">{game.holes_played}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Skin Value</span>
              <span className="font-medium">${game.skin_value}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Carryover</span>
              <span className="font-medium">{game.carryover_enabled ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Handicaps</span>
              <span className="font-medium">{game.use_handicaps ? `Yes (${game.handicap_mode})` : "No"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy size={18} />
              Standings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedPlayers.map((player, i) => {
              const skins = skinsWon[player.name] || 0;
              const value = skins * game.skin_value;
              return (
                <div key={player.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      i === 0 && skins > 0 ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-medium">{player.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {player.group_name}
                        {game.use_handicaps && player.handicap !== null && ` • HCP: ${formatHandicap(player.handicap)}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">{skins}</div>
                    <div className="text-xs text-muted-foreground">
                      {value > 0 ? `$${value}` : 'skins'}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Groups */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users size={18} />
              Playing Groups
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(playersByGroup).map(([groupName, players]) => (
              <div key={groupName}>
                <div className="text-sm font-medium text-muted-foreground mb-2">{groupName}</div>
                <div className="space-y-2">
                  {players.map(player => (
                    <div key={player.name} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span>{player.name}</span>
                      <Badge variant="secondary">{skinsWon[player.name] || 0} skins</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Skins Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="text-primary" />
              Skins Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <p>Skins is a golf betting game where players compete for a prize (skin) on each hole.</p>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="font-medium">How to Win a Skin</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Win a hole outright with the lowest score</li>
                <li>If two or more players tie for low, no skin is awarded</li>
                {game.carryover_enabled && (
                  <li>Tied skins carry over to the next hole</li>
                )}
              </ul>
            </div>

            {game.carryover_enabled && (
              <div className="space-y-2 pt-2 border-t">
                <p className="font-medium">Carryovers</p>
                <p className="text-sm">
                  When a hole is tied, the skin carries over and adds to the next hole's value. 
                  Multiple carryovers can stack up, making later holes worth more skins.
                </p>
              </div>
            )}

            {game.use_handicaps && (
              <div className="space-y-2 pt-2 border-t">
                <p className="font-medium">Handicaps</p>
                <p className="text-sm">
                  Playing with handicaps enabled. Strokes are applied based on course handicap and stroke index.
                  {game.handicap_mode === 'net' ? ' Net scores are compared.' : ' Gross scores are compared.'}
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t">
              <p className="font-medium">Multiple Groups</p>
              <p className="text-sm">
                All players compete for skins regardless of which group they're playing in. 
                Enter scores for all groups to determine winners.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {gameId && <SkinsBottomTabBar gameId={gameId} />}
    </div>
  );
}
