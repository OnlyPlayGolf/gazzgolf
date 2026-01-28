import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Player } from "@/types/playSetup";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DRILL_TITLE = "21 Points";
const SCORE_STORAGE_KEY = "twenty_one_points_score_state";
const SAVE_DEDUPE_MS = 5000;

// Module-level guard so the same game is never stored twice (survives remounts / Strict Mode)
let lastSaveFingerprint: string | null = null;
let lastSaveId: number | null = null;
let lastSaveTime = 0;

type SavedScoreState = {
  players: Player[];
  points: Record<string, number[]>;
  currentHole: number;
  activeHole: number;
  gameEnded: { winnerOdId: string; winnerTotal: number } | null;
};

function formatName(p: Player): string {
  return p.displayName || "Guest Player";
}

export default function TwentyOnePointsScore() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const statePlayers = (location.state as { players?: Player[] } | null)?.players;
  const [players, setPlayers] = useState<Player[]>(statePlayers || []);
  const [currentHole, setCurrentHole] = useState(1); // hole being viewed (arrows change this)
  const [activeHole, setActiveHole] = useState(1);   // hole being played (advances when all have points)
  const [points, setPoints] = useState<Record<string, number[]>>({});
  const [activePlayerIndex, setActivePlayerIndex] = useState<number | null>(null);
  const [pointsInput, setPointsInput] = useState("");
  const [gameEnded, setGameEnded] = useState<{ winner: Player; winnerTotal: number } | null>(null);
  const [savedResultId, setSavedResultId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // Restore from location.state (from Setup: Start or Continue) or sessionStorage (returning to Enter Score tab)
  useEffect(() => {
    if (statePlayers && statePlayers.length >= 2) {
      // Use roster from setup; merge with saved points/holes so Continue keeps progress and respects add/remove
      let saved: SavedScoreState | null = null;
      try {
        const raw = sessionStorage.getItem(SCORE_STORAGE_KEY);
        if (raw) saved = JSON.parse(raw) as SavedScoreState;
      } catch {
        /* ignore */
      }
      const roster = statePlayers;
      const mergedPoints: Record<string, number[]> = Object.fromEntries(
        roster.map((p) => [p.odId, saved?.points?.[p.odId] ?? []])
      );
      const mergedCurrentHole = saved?.currentHole ?? 1;
      const mergedActiveHole = saved?.activeHole ?? 1;
      let mergedGameEnded: { winner: Player; winnerTotal: number } | null = null;
      if (saved?.gameEnded) {
        const winner = roster.find((p) => p.odId === saved!.gameEnded!.winnerOdId);
        if (winner) mergedGameEnded = { winner, winnerTotal: saved.gameEnded.winnerTotal };
      }
      setPlayers(roster);
      setPoints(mergedPoints);
      setCurrentHole(mergedCurrentHole);
      setActiveHole(mergedActiveHole);
      setGameEnded(mergedGameEnded);
      const toSave: SavedScoreState = {
        players: roster,
        points: mergedPoints,
        currentHole: mergedCurrentHole,
        activeHole: mergedActiveHole,
        gameEnded: mergedGameEnded ? { winnerOdId: mergedGameEnded.winner.odId, winnerTotal: mergedGameEnded.winnerTotal } : null,
      };
      sessionStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(toSave));
      return;
    }
    try {
      const raw = sessionStorage.getItem(SCORE_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedScoreState;
        if (saved.players?.length >= 2) {
          if (saved.gameEnded) {
            sessionStorage.removeItem(SCORE_STORAGE_KEY);
            navigate("/drill/21-points/setup", { replace: true });
            return;
          }
          setPlayers(saved.players);
          setPoints(saved.points ?? Object.fromEntries(saved.players.map((p) => [p.odId, []])));
          setCurrentHole(saved.currentHole ?? 1);
          setActiveHole(saved.activeHole ?? 1);
          setGameEnded(null);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    navigate("/drill/21-points/setup", { replace: true });
  }, [statePlayers, navigate]);

  const stateRef = useRef({ players, points, currentHole, activeHole, gameEnded });
  stateRef.current = { players, points, currentHole, activeHole, gameEnded };
  const hasSavedForCurrentWinRef = useRef(false);

  // Persist score state when it changes or when leaving the tab/page (unmount). Never persist a finished game so the completion popup is only shown once per game.
  useEffect(() => {
    const persist = (s: { players: Player[]; points: Record<string, number[]>; currentHole: number; activeHole: number; gameEnded: { winner: Player; winnerTotal: number } | null }) => {
      if (s.players.length < 2) return;
      if (s.gameEnded) return; // do not persist finished games — popup shows once, then we clear
      const toSave: SavedScoreState = {
        players: s.players,
        points: s.points,
        currentHole: s.currentHole,
        activeHole: s.activeHole,
        gameEnded: null,
      };
      sessionStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(toSave));
    };
    persist(stateRef.current);
    return () => persist(stateRef.current);
  }, [players, points, currentHole, activeHole, gameEnded]);

  const getTotal = (odId: string) =>
    (points[odId] || []).reduce((a, b) => a + b, 0);

  const getPointsForHole = (odId: string, hole: number) =>
    (points[odId] || [])[hole - 1] ?? null;

  const whoPicksHole = (() => {
    if (currentHole <= 1) return null;
    const prevHole = currentHole - 1;
    let bestOdId: string | null = null;
    let bestVal = -1;
    players.forEach((p) => {
      const v = getPointsForHole(p.odId, prevHole);
      if (v != null && v > bestVal) {
        bestVal = v;
        bestOdId = p.odId;
      }
    });
    return bestOdId != null ? players.find((p) => p.odId === bestOdId) ?? null : null;
  })();

  const allHavePointsForCurrentHole = players.every(
    (p) => getPointsForHole(p.odId, currentHole) != null
  );

  const checkWin = () => {
    for (const p of players) {
      const t = getTotal(p.odId);
      if (t >= 21) return { winner: p, winnerTotal: t };
    }
    return null;
  };

  const saveGame = async (
    winner: Player,
    winnerTotal: number,
    fingerprint?: string
  ): Promise<number | null> => {
    if (
      fingerprint &&
      lastSaveFingerprint === fingerprint &&
      Date.now() - lastSaveTime < SAVE_DEDUPE_MS
    ) {
      return lastSaveId;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: drills } = await supabase
        .from("drills")
        .select("id")
        .eq("title", DRILL_TITLE)
        .limit(1);

      const drillId = drills?.[0]?.id;
      if (!drillId) {
        toast({ title: "Drill not found", variant: "destructive" });
        return null;
      }

      const playersData = players.map((p) => ({
        odId: p.odId,
        displayName: formatName(p),
        avatarUrl: p.avatarUrl ?? null,
        totalPoints: getTotal(p.odId),
        pointsPerHole: points[p.odId] || [],
      }));

      const gameId = crypto.randomUUID();
      const attemptsJson = {
        gameId,
        players: playersData,
        winnerOdId: winner.odId,
        holesPlayed: currentHole,
      };

      // 1) Store current user's row with their own score (not winner's) so your history shows your score
      const myTotal = getTotal(user.id) ?? 0;
      const { data, error } = await supabase
        .from("drill_results")
        .insert({
          user_id: user.id,
          drill_id: drillId,
          total_points: myTotal,
          attempts_json: attemptsJson,
        })
        .select("id")
        .single();

      if (error) throw error;
      const id = (data as { id: number } | null)?.id ?? null;
      if (fingerprint && id != null) {
        lastSaveFingerprint = fingerprint;
        lastSaveTime = Date.now();
        lastSaveId = id;
      }

      // 2) Create one row per other profile player so their scores are stored and show in Groups History
      const { error: rpcError } = await supabase.rpc("create_21_points_participant_rows_rpc", {
        p_drill_id: drillId,
        p_attempts_json: attemptsJson,
        p_exclude_user_id: user.id,
      });
      if (rpcError) console.error("21 Points participant rows:", rpcError);

      toast({ title: "Game saved!", description: `${formatName(winner)} wins with ${winnerTotal} points.` });
      return id;
    } catch (e: any) {
      console.error(e);
      toast({ title: "Could not save game", variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Auto-advance to next hole only when viewing the active hole and all have entered points
  useEffect(() => {
    if (gameEnded || currentHole !== activeHole || !allHavePointsForCurrentHole || players.length === 0) return;
    const win = checkWin();
    if (win) {
      // Prevent multiple saves (ref + module-level fingerprint dedupe)
      // Create fingerprint first to check against module-level dedupe
      const fingerprint = JSON.stringify({
        w: win.winner.odId,
        t: win.winnerTotal,
        h: currentHole,
        p: players.map((x) => x.odId).sort(),
        pts: players.map((x) => getTotal(x.odId)).sort((a, b) => a - b),
      });
      
      // Check both ref and module-level fingerprint to prevent race conditions
      if (hasSavedForCurrentWinRef.current) return;
      if (
        lastSaveFingerprint === fingerprint &&
        Date.now() - lastSaveTime < SAVE_DEDUPE_MS
      ) {
        // Already saved recently, just set gameEnded without saving again
        setGameEnded(win);
        sessionStorage.removeItem(SCORE_STORAGE_KEY);
        return;
      }
      
      // Set ref flag immediately to prevent race conditions
      hasSavedForCurrentWinRef.current = true;
      
      // Save the game first, then set gameEnded only after successful save
      sessionStorage.removeItem(SCORE_STORAGE_KEY); // finished game is not restored — popup shows once only
      saveGame(win.winner, win.winnerTotal, fingerprint).then((id) => {
        if (id != null) {
          // Only set gameEnded and show popup after successful save
          setSavedResultId(id);
          setGameEnded(win);
        } else {
          // Save failed, reset the flag so user can try again
          hasSavedForCurrentWinRef.current = false;
        }
      });
      return;
    }
    setActiveHole((h) => h + 1);
    setCurrentHole((h) => h + 1);
    setActivePlayerIndex(null);
  }, [gameEnded, currentHole, activeHole, allHavePointsForCurrentHole, points, players]);

  const handleReset = () => {
    hasSavedForCurrentWinRef.current = false;
    const emptyPoints = Object.fromEntries(players.map((p) => [p.odId, []]));
    setPoints(emptyPoints);
    setCurrentHole(1);
    setActiveHole(1);
    setGameEnded(null);
    setActivePlayerIndex(null);
    setPointsInput("");
    const toSave: SavedScoreState = {
      players,
      points: emptyPoints,
      currentHole: 1,
      activeHole: 1,
      gameEnded: null,
    };
    sessionStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(toSave));
  };

  const openPlayerSheet = (index: number) => {
    setActivePlayerIndex(index);
    const odId = players[index]?.odId;
    const v = odId ? getPointsForHole(odId, currentHole) : null;
    setPointsInput(v != null ? String(v) : "");
  };

  const commitScoreAndAdvance = () => {
    const parsed = parseFloat(pointsInput);
    const num = Number.isNaN(parsed) ? 0 : (pointsInput === "-" ? 0 : Math.floor(parsed));
    if (activePlayerIndex == null || activePlayerIndex < 0 || activePlayerIndex >= players.length) return;
    const p = players[activePlayerIndex];
    const prev = points[p.odId] || [];
    const forHole = [...prev];
    while (forHole.length < currentHole) forHole.push(0);
    forHole[currentHole - 1] = num;
    setPoints((prev) => ({ ...prev, [p.odId]: forHole }));

    const remaining = players
      .map((_, i) => i)
      .filter((i) => {
        const o = players[i].odId;
        return getPointsForHole(o, currentHole) == null && i !== activePlayerIndex;
      });
    const nextIdx =
      remaining.find((i) => i > activePlayerIndex) ??
      remaining.find((i) => i < activePlayerIndex);
    if (nextIdx != null) {
      setActivePlayerIndex(nextIdx);
      const nextOdId = players[nextIdx].odId;
      const v = getPointsForHole(nextOdId, currentHole);
      setPointsInput(v != null ? String(v) : "");
    } else {
      setActivePlayerIndex(null);
      setPointsInput("");
    }
  };

  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commitScoreAndAdvance);
  const pointsInputRef = useRef(pointsInput);
  commitRef.current = commitScoreAndAdvance;
  pointsInputRef.current = pointsInput;

  useEffect(() => {
    if (activePlayerIndex == null) {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = null;
      }
    }
  }, [activePlayerIndex]);

  const scheduleAutoAdvance = () => {
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    advanceTimeoutRef.current = setTimeout(() => {
      advanceTimeoutRef.current = null;
      const v = pointsInputRef.current;
      if (v !== "" && v !== "-") commitRef.current();
    }, 450);
  };

  const handleNumpadDigit = (d: string) => {
    setPointsInput((s) => s + d);
    scheduleAutoAdvance();
  };
  const handleNumpadMinus = () => {
    setPointsInput((s) => (s.startsWith("-") ? s.slice(1) : s ? "-" + s : "-"));
    scheduleAutoAdvance();
  };
  const handleNumpadClear = () => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    setPointsInput("");
  };

  if (players.length < 2 && !statePlayers) {
    return null;
  }

  if (gameEnded && savedResultId !== null) {
    // Show current user's score (not winner's) in the completion popup
    // Only show popup if we have a saved result ID (save was successful)
    const myScore = currentUserId ? getTotal(currentUserId) : 0;

    return (
      <DrillCompletionDialog
        open={true}
        onOpenChange={(open) => {
          if (!open) {
            hasSavedForCurrentWinRef.current = false;
            setGameEnded(null);
            setSavedResultId(null);
            sessionStorage.removeItem(SCORE_STORAGE_KEY);
            navigate("/drill/21-points/leaderboard", { replace: true });
          }
        }}
        drillTitle={DRILL_TITLE}
        score={myScore}
        unit="points"
        resultId={savedResultId ?? undefined}
        donePath="/drill/21-points/setup"
        onContinue={() => {
          sessionStorage.removeItem(SCORE_STORAGE_KEY);
          hasSavedForCurrentWinRef.current = false;
          setGameEnded(null);
          setSavedResultId(null);
        }}
      />
    );
  }

  return (
    <>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-center gap-2 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentHole((h) => Math.max(1, h - 1))}
            disabled={currentHole <= 1}
            className="shrink-0"
            aria-label="Previous hole"
          >
            <ChevronLeft size={24} />
          </Button>
          <p className="text-lg font-semibold text-foreground min-w-[5rem] text-center">
            Hole {currentHole}
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentHole((h) => Math.min(activeHole, h + 1))}
            disabled={currentHole >= activeHole}
            className="shrink-0"
            aria-label="Next hole"
          >
            <ChevronRight size={24} />
          </Button>
        </div>

        {whoPicksHole && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20 text-sm">
            <Target className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted-foreground">Picks this hole:</span>
            <span className="font-medium">{formatName(whoPicksHole)}</span>
          </div>
        )}

        <div className="space-y-2">
          {players.map((player, index) => {
            const total = getTotal(player.odId);
            const forHole = getPointsForHole(player.odId, currentHole);
            return (
              <Card
                key={player.odId}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openPlayerSheet(index)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={player.avatarUrl} className="object-cover object-center aspect-square" />
                    <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                      {formatName(player).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{formatName(player)}</p>
                    <p className="text-sm text-muted-foreground">
                      Total: {total} pts
                      {forHole != null && ` • This hole: ${forHole}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold">{forHole != null ? forHole : "–"}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleReset}
          aria-label="Reset drill"
        >
          Reset Drill
        </Button>
      </div>

      <Sheet
        open={activePlayerIndex != null}
        onOpenChange={(open) => !open && setActivePlayerIndex(null)}
      >
        <SheetContent side="bottom" className="h-auto max-h-[85vh]">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-center text-lg font-bold">
              Hole {currentHole} — {activePlayerIndex != null ? formatName(players[activePlayerIndex]) : ""}
            </SheetTitle>
          </SheetHeader>
          
          {/* Player Info Bar */}
          {activePlayerIndex != null && (
            <div className="bg-primary text-primary-foreground p-4 rounded-lg mb-4 flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-4">
                <div className="text-lg font-bold truncate">{formatName(players[activePlayerIndex])}</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="bg-background text-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                  {pointsInput === "" || pointsInput === "-" ? "–" : pointsInput}
                </div>
                <span className="text-xs text-primary-foreground/70 mt-1">Points</span>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-2 p-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <Button
                key={d}
                variant="secondary"
                onClick={() => handleNumpadDigit(d)}
                className="h-20 flex flex-col items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80"
              >
                <span className="text-3xl font-bold">{d}</span>
              </Button>
            ))}
            
            {/* Bottom row: Minus, Zero, Clear */}
            <Button
              variant="secondary"
              onClick={handleNumpadMinus}
              className="h-20 flex flex-col items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80"
            >
              <span className="text-3xl font-bold">−</span>
            </Button>
            
            <Button
              variant="secondary"
              onClick={() => handleNumpadDigit("0")}
              className="h-20 flex flex-col items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80"
            >
              <span className="text-3xl font-bold">0</span>
            </Button>
            
            <Button
              variant="default"
              onClick={handleNumpadClear}
              className="h-20 flex flex-col items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <span className="text-lg font-bold">Clear</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
