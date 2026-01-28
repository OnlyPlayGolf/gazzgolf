import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Plus, X } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DEFAULT_MEN_TEE } from "@/components/TeeSelector";
import { AddPlayerDialog } from "@/components/play/AddPlayerDialog";
import { Player } from "@/types/playSetup";
import { formatHandicap, parseHandicap } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

function formatPlayerName(p: Player): string {
  return p.displayName || "Guest Player";
}

export default function TwentyOnePointsSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const STORAGE_KEY = "twenty_one_points_players";
  const SCORE_STORAGE_KEY = "twenty_one_points_score_state";

  const hasSavedGame = (() => {
    try {
      const raw = sessionStorage.getItem(SCORE_STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw) as { players?: unknown[]; gameEnded?: unknown };
      return Array.isArray(saved?.players) && saved.players.length >= 2 && !saved.gameEnded;
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url, handicap")
        .eq("id", user.id)
        .single();
      const hcp = parseHandicap(profile?.handicap ?? null) ?? undefined;
      const me: Player = {
        odId: user.id,
        teeColor: DEFAULT_MEN_TEE,
        displayName: profile?.display_name || profile?.username || "You",
        username: profile?.username || "",
        avatarUrl: profile?.avatar_url ?? undefined,
        isTemporary: false,
        handicap: hcp,
      };
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Player[];
          const others = parsed.filter((p) => p.odId !== user.id);
          const profileIds = others
            .filter((p) => !p.odId.startsWith("temp_"))
            .map((p) => p.odId);
          if (profileIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, display_name, username, avatar_url, handicap")
              .in("id", profileIds);
            const byId = new Map((profiles || []).map((pr) => [pr.id, pr]));
            const merged = others.map((p) => {
              if (p.odId.startsWith("temp_")) return p;
              const pr = byId.get(p.odId);
              if (!pr) return p;
              const hcp = parseHandicap(pr.handicap ?? null) ?? undefined;
              return {
                ...p,
                displayName: pr.display_name || pr.username || p.displayName,
                username: pr.username ?? p.username,
                avatarUrl: pr.avatar_url ?? p.avatarUrl,
                handicap: hcp,
              };
            });
            setPlayers([me, ...merged]);
          } else {
            setPlayers([me, ...others]);
          }
        } else {
          setPlayers([me]);
        }
      } catch {
        setPlayers([me]);
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

  useEffect(() => {
    if (players.length === 0 || !currentUserId) return;
    if (players[0]?.odId !== currentUserId) return;
    if (players.length > 1) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [players, currentUserId]);

  const handleAddPlayer = (player: Player) => {
    if (players.some((p) => p.odId === player.odId)) {
      toast({ title: "Player already added", variant: "destructive" });
      return;
    }
    setPlayers((prev) => [...prev, player]);
    setAddPlayerOpen(false);
  };

  const handleRemovePlayer = (odId: string) => {
    const isFirst = players[0]?.odId === odId;
    if (isFirst) return;
    setPlayers((prev) => prev.filter((p) => p.odId !== odId));
  };

  const handleStart = () => {
    if (players.length < 2) {
      toast({
        title: "Add at least 2 players",
        description: "21 Points requires 2 or more players.",
        variant: "destructive",
      });
      return;
    }
    navigate("/drill/21-points/score", {
      state: { players: players.map((p) => ({ ...p })) },
    });
  };

  const handleContinue = () => {
    if (players.length < 2) {
      toast({
        title: "Add at least 2 players",
        description: "21 Points requires 2 or more players.",
        variant: "destructive",
      });
      return;
    }
    navigate("/drill/21-points/score", {
      state: { players: players.map((p) => ({ ...p })) },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <TopNavBar />
        <div className="p-4 pt-20 flex items-center justify-center min-h-[40vh]">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/drills/shortgame")}
            className="shrink-0"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">21 Points</h1>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-primary" />
              Players
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Add at least one more player to start.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {players.map((player) => (
              <div
                key={player.odId}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={player.avatarUrl} className="object-cover object-center aspect-square" />
                    <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                      {formatPlayerName(player).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {formatPlayerName(player)}
                    </p>
                    {player.handicap !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        HCP: {formatHandicap(player.handicap)}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleRemovePlayer(player.odId)}
                  disabled={players[0]?.odId === player.odId}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setAddPlayerOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Player
            </Button>
          </CardContent>
        </Card>

        {hasSavedGame ? (
          <Button
            onClick={handleContinue}
            className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            size="lg"
          >
            Continue
          </Button>
        ) : (
          <Button
            onClick={handleStart}
            disabled={players.length < 2}
            className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            size="lg"
          >
            Start
          </Button>
        )}
      </div>

      <AddPlayerDialog
        isOpen={addPlayerOpen}
        onClose={() => setAddPlayerOpen(false)}
        onAddPlayer={handleAddPlayer}
        existingPlayerIds={players.map((p) => p.odId)}
        defaultTee={DEFAULT_MEN_TEE}
      />
    </div>
  );
}
