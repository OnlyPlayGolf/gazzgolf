import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { SkinsGame, SkinsHole, SkinsPlayer, SkinsPlayerScore } from "@/types/skins";
import { ChevronDown, Trophy } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SkinsLeaderboard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<SkinsGame | null>(null);
  const [holes, setHoles] = useState<SkinsHole[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-32">
        <div className="text-muted-foreground">Loading scorecard...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-32">
        <div className="text-muted-foreground">Game not found</div>
      </div>
    );
  }

  // Calculate skins won per player
  const skinsWon: Record<string, number> = {};
  const holesWon: Record<string, number[]> = {};
  game.players.forEach(p => { 
    skinsWon[p.name] = 0; 
    holesWon[p.name] = [];
  });
  holes.forEach(h => {
    if (h.winner_player) {
      skinsWon[h.winner_player] = (skinsWon[h.winner_player] || 0) + h.skins_available;
      holesWon[h.winner_player] = [...(holesWon[h.winner_player] || []), h.hole_number];
    }
  });

  const sortedPlayers = [...game.players].sort((a, b) => (skinsWon[b.name] || 0) - (skinsWon[a.name] || 0));
  const leader = sortedPlayers[0]?.name;

  const frontNine = holes.filter(h => h.hole_number <= 9);
  const backNine = holes.filter(h => h.hole_number > 9);

  const getPlayerScore = (hole: SkinsHole, playerName: string) => {
    const score = hole.player_scores[playerName];
    if (!score) return null;
    return game.use_handicaps && game.handicap_mode === 'net' ? score.net : score.gross;
  };

  const calculateNineTotal = (holesSubset: SkinsHole[], playerName: string) => {
    return holesSubset.reduce((sum, h) => {
      const score = getPlayerScore(h, playerName);
      return sum + (score || 0);
    }, 0);
  };

  const renderPlayerCard = (player: SkinsPlayer, index: number) => {
    const isExpanded = expandedPlayer === player.name;
    const skins = skinsWon[player.name] || 0;
    const isLeader = leader === player.name && skins > 0;
    const value = skins * game.skin_value;

    return (
      <Card key={player.name} className="overflow-hidden">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-4">
          <div className="flex items-center justify-center mb-2">
            <div className="flex-1 text-center">
              <h2 className="text-lg font-bold">
                Game {new Date(game.date_played).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: '2-digit', 
                  day: '2-digit' 
                }).replace(/\//g, '-')}
              </h2>
              <p className="text-sm opacity-90">{game.course_name}</p>
            </div>
          </div>

          <div className="bg-primary-foreground/10 rounded-lg p-3 text-center">
            <div className="text-xl font-bold">Skins</div>
          </div>
        </div>

        {/* Player Info Bar - Clickable */}
        <div 
          className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpandedPlayer(isExpanded ? null : player.name)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronDown 
                size={20} 
                className={`text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                isLeader ? 'bg-amber-500 text-white' : 'bg-muted'
              }`}>
                {index + 1}
              </div>
              <div>
                <div className="text-xl font-bold">{player.name}</div>
                <div className="text-xs text-muted-foreground">{player.group_name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                {isLeader && <Trophy size={20} className="text-amber-500" />}
                <span className="text-3xl font-bold">{skins}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {value > 0 ? `$${value}` : 'skins'}
              </div>
            </div>
          </div>
        </div>

        {/* Scorecard Table - Only shown when expanded */}
        {isExpanded && holes.length > 0 && (
          <>
            {/* Front 9 */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                      {frontNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Score</TableCell>
                    {frontNine.map(hole => {
                      const score = getPlayerScore(hole, player.name);
                      const isWinner = hole.winner_player === player.name;
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className={`text-center font-bold text-xs px-1 py-1.5 ${
                            isWinner ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : ''
                          }`}
                        >
                          {score || '-'}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                      {calculateNineTotal(frontNine, player.name) || '-'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Back 9 - Only show if 18 holes */}
            {game.holes_played === 18 && backNine.length > 0 && (
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10">Hole</TableHead>
                      {backNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                      {backNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                          {hole.par}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                        {backNine.reduce((sum, h) => sum + h.par, 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Score</TableCell>
                      {backNine.map(hole => {
                        const score = getPlayerScore(hole, player.name);
                        const isWinner = hole.winner_player === player.name;
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className={`text-center font-bold text-xs px-1 py-1.5 ${
                              isWinner ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : ''
                            }`}
                          >
                            {score || '-'}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                        {calculateNineTotal(backNine, player.name) || '-'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Summary */}
            <div className="border-t bg-muted/30 p-4">
              <div className="flex items-center justify-around text-center">
                <div>
                  <div className="text-2xl font-bold">{skins}</div>
                  <div className="text-xs text-muted-foreground">Skins Won</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{holesWon[player.name]?.length || 0}</div>
                  <div className="text-xs text-muted-foreground">Holes Won</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">${value}</div>
                  <div className="text-xs text-muted-foreground">Winnings</div>
                </div>
              </div>
              {holesWon[player.name]?.length > 0 && (
                <div className="mt-3 pt-3 border-t text-center text-sm text-muted-foreground">
                  Won on holes: {holesWon[player.name].join(', ')}
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen pb-32 bg-background">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {sortedPlayers.map((player, idx) => renderPlayerCard(player, idx))}
      </div>

      {gameId && <SkinsBottomTabBar gameId={gameId} />}
    </div>
  );
}
