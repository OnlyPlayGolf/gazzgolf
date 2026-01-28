import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { List, Trophy } from "lucide-react";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { supabase } from "@/integrations/supabase/client";

const DRILL_TITLE = "21 Points";

interface LeaderboardEntry {
  odId: string;
  displayName: string;
  avatarUrl?: string | null;
  wins: number;
  games: number;
  winPct: number;
}

export default function TwentyOnePointsLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setEntries([]);
          return;
        }

        const { data: drills } = await supabase
          .from("drills")
          .select("id")
          .eq("title", DRILL_TITLE)
          .limit(1);

        if (!drills?.length) {
          setEntries([]);
          return;
        }

        const { data: rows } = await supabase
          .from("drill_results")
          .select("attempts_json")
          .eq("drill_id", drills[0].id);

        const byOdId = new Map<string, { wins: number; games: number; displayName: string; avatarUrl?: string | null }>();

        for (const row of rows || []) {
          const aj = (row as { attempts_json?: { players?: { odId: string; displayName: string; avatarUrl?: string | null }[]; winnerOdId?: string } }).attempts_json;
          if (!aj?.players) continue;
          const winnerOdId = aj.winnerOdId;
          for (const p of aj.players) {
            const cur = byOdId.get(p.odId) ?? {
              wins: 0,
              games: 0,
              displayName: p.displayName ?? "Guest",
              avatarUrl: p.avatarUrl ?? undefined,
            };
            cur.games += 1;
            if (p.odId === winnerOdId) cur.wins += 1;
            byOdId.set(p.odId, cur);
          }
        }

        const list: LeaderboardEntry[] = Array.from(byOdId.entries())
          .filter(([odId]) => !odId.startsWith("temp_"))
          .map(([odId, v]) => ({
            odId,
            displayName: v.displayName,
            avatarUrl: v.avatarUrl,
            wins: v.wins,
            games: v.games,
            winPct: v.games > 0 ? (v.wins / v.games) * 100 : 0,
          }));
        list.sort((a, b) => b.winPct - a.winPct);
        setEntries(list);
      } catch (e) {
        console.error(e);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">Loading leaderboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <List size={20} className="text-primary" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No 21 Points games recorded yet. Rank by win percentage once games are saved.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Trophy size={20} className="text-primary" />
            Leaderboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">Ranked by win percentage</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div
                key={e.odId}
                className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20"
              >
                <span className="text-lg font-bold text-muted-foreground w-6">
                  {i + 1}
                </span>
                <ProfilePhoto
                  src={e.avatarUrl ?? undefined}
                  alt={e.displayName}
                  fallback={e.displayName}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{e.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.wins}W – {e.games}G
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-primary">
                    {e.winPct.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">win rate</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
