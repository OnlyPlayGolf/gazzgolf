import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { ScorecardActions } from "@/components/ScorecardActions";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, RotateCcw, ArrowLeft } from "lucide-react";
import { GameHeader } from "@/components/GameHeader";
import { GameNotFound } from "@/components/GameNotFound";
import { useGameAdminStatus } from "@/hooks/useGameAdminStatus";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Round {
  id: string;
  course_name: string;
  tee_set: string;
  holes_played: number;
  date_played: string;
  user_id: string;
  origin: string | null;
  round_name: string | null;
  event_id?: string | null;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface EventRound {
  id: string;
  course_name: string;
  holes_played: number;
  created_at: string | null;
  round_name: string | null;
}

interface EventPlayerRoundData {
  roundPlayerId: string;
  scores: Map<number, number>;
  mulligans: Set<number>;
}

interface EventPlayerData {
  key: string;
  user_id: string | null;
  tee_color: string | null;
  handicap: number | null;
  display_name: string;
  username: string | null;
  perRound: Record<string, EventPlayerRoundData>;
}

export default function RoundLeaderboard() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('round', roundId);
  const { isAdmin } = useGameAdminStatus('round', roundId);
  
  const [round, setRound] = useState<Round | null>(null);
  const [eventRounds, setEventRounds] = useState<EventRound[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [courseHolesByRound, setCourseHolesByRound] = useState<Record<string, CourseHole[]>>({});
  const [players, setPlayers] = useState<EventPlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (roundId) {
      fetchRoundData();
    }
  }, [roundId]);

  const fetchRoundData = async () => {
    try {
      // Fetch round details
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .maybeSingle();

      if (roundError) throw roundError;
      setRound(roundData);

      // Determine which rounds are in-scope (single round vs event-linked rounds)
      let roundsInScope: EventRound[] = [];
      if (roundData?.event_id) {
        const { data: evRounds, error: evError } = await supabase
          .from("rounds")
          .select("id, course_name, holes_played, created_at, round_name")
          .eq("event_id", roundData.event_id)
          .order("created_at", { ascending: true });
        if (evError) throw evError;
        roundsInScope = (evRounds || []) as EventRound[];
      } else {
        roundsInScope = [{
          id: roundData.id,
          course_name: roundData.course_name,
          holes_played: roundData.holes_played,
          created_at: (roundData as any)?.created_at ?? null,
          round_name: roundData.round_name,
        }];
      }

      setEventRounds(roundsInScope);
      const initialSelected = roundsInScope.some(r => r.id === roundId) ? roundId! : (roundsInScope[0]?.id ?? null);
      setSelectedRoundId(initialSelected);

      const roundIds = roundsInScope.map(r => r.id);
      const uniqueCourseNames = Array.from(new Set(roundsInScope.map(r => r.course_name).filter(Boolean)));

      // Fetch course ids for all course names involved
      const { data: coursesData } = await supabase
        .from("courses")
        .select("id, name")
        .in("name", uniqueCourseNames as string[]);

      const courseIdByName = new Map((coursesData || []).map((c: any) => [c.name, c.id]));
      const uniqueCourseIds = Array.from(new Set((coursesData || []).map((c: any) => c.id)));

      // Fetch all course holes for these courses
      const { data: allCourseHoles, error: allCourseHolesError } = await supabase
        .from("course_holes")
        .select("course_id, hole_number, par, stroke_index")
        .in("course_id", uniqueCourseIds as string[])
        .order("hole_number");
      if (allCourseHolesError) throw allCourseHolesError;

      // Build per-round hole maps (respecting 9-hole rounds)
      const holesByRound: Record<string, CourseHole[]> = {};
      for (const r of roundsInScope) {
        const cid = courseIdByName.get(r.course_name);
        const courseHoles = (allCourseHoles || [])
          .filter((h: any) => h.course_id === cid)
          .map((h: any) => ({
            hole_number: h.hole_number,
            par: h.par,
            stroke_index: h.stroke_index,
          })) as CourseHole[];

        holesByRound[r.id] = r.holes_played === 9 ? courseHoles.slice(0, 9) : courseHoles;
      }
      setCourseHolesByRound(holesByRound);

      // Fetch players for all rounds (event_player_id may not exist yet in hosted DB)
      const isMissingColumnError = (err: any, column: string): boolean => {
        const msg = (err?.message || err?.details || err?.hint || "").toString().toLowerCase();
        return msg.includes(column.toLowerCase()) && (msg.includes("does not exist") || msg.includes("column"));
      };

      let playersData: any[] = [];
      let hasEventPlayerId = true;

      {
        const { data, error } = await supabase
          .from("round_players")
          .select("id, round_id, user_id, tee_color, handicap, is_guest, guest_name, event_player_id")
          .in("round_id", roundIds as any);

        if (error) {
          if (isMissingColumnError(error, "event_player_id")) {
            hasEventPlayerId = false;
            const retry = await supabase
              .from("round_players")
              .select("id, round_id, user_id, tee_color, handicap, is_guest, guest_name")
              .in("round_id", roundIds as any);
            if (retry.error) throw retry.error;
            playersData = retry.data || [];
          } else {
            throw error;
          }
        } else {
          playersData = data || [];
        }
      }

      const registeredPlayerRows = (playersData || []).filter((p: any) => !p.is_guest && p.user_id);
      const guestPlayerRows = (playersData || []).filter((p: any) => p.is_guest);

      const userIds = Array.from(new Set(registeredPlayerRows.map((p: any) => p.user_id)));
      const { data: profilesData } = userIds.length
        ? await supabase.from("profiles").select("id, display_name, username, handicap").in("id", userIds as any)
        : await supabase.from("profiles").select("id").limit(0);

      const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      // Fetch all scores and mulligans for all rounds
      const { data: scoresData } = await supabase
        .from("holes")
        .select("round_id, hole_number, score, player_id, mulligan")
        .in("round_id", roundIds as any);

      const scoresMap = new Map<string, Map<number, number>>();
      const mulligansMap = new Map<string, Set<number>>();

      (scoresData || []).forEach((hole: any) => {
        if (!hole.player_id) return;
        if (!scoresMap.has(hole.player_id)) scoresMap.set(hole.player_id, new Map());
        scoresMap.get(hole.player_id)!.set(hole.hole_number, hole.score);

        if (hole.mulligan) {
          if (!mulligansMap.has(hole.player_id)) mulligansMap.set(hole.player_id, new Set());
          mulligansMap.get(hole.player_id)!.add(hole.hole_number);
        }
      });

      const eventPlayersMap = new Map<string, EventPlayerData>();
      const allPlayerRows = [...registeredPlayerRows, ...guestPlayerRows] as any[];

      for (const row of allPlayerRows) {
        const key = hasEventPlayerId
          ? (row.event_player_id || row.user_id || row.id)
          : (row.user_id || `guest:${row.guest_name || row.id}`);
        const profile = row.user_id ? profilesMap.get(row.user_id) : null;

        const displayName = row.is_guest
          ? (row.guest_name || "Guest")
          : (profile?.display_name || profile?.username || "Player");

        const username = row.is_guest ? null : (profile?.username || null);
        const handicap = row.handicap ?? (profile?.handicap ? parseFloat(profile.handicap) : null);

        if (!eventPlayersMap.has(key)) {
          eventPlayersMap.set(key, {
            key,
            user_id: row.user_id || null,
            tee_color: row.tee_color || null,
            handicap,
            display_name: displayName,
            username,
            perRound: {},
          });
        }

        const ep = eventPlayersMap.get(key)!;
        ep.perRound[row.round_id] = {
          roundPlayerId: row.id,
          scores: scoresMap.get(row.id) || new Map(),
          mulligans: mulligansMap.get(row.id) || new Set(),
        };
      }

      const eventPlayers = Array.from(eventPlayersMap.values());
      setPlayers(eventPlayers);

      if (eventPlayers.length > 0) {
        setExpandedPlayerId(eventPlayers[0].key);
      }
    } catch (error: any) {
      console.error("Error fetching round data:", error);
      toast({
        title: "Error loading round",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoresForRound = (player: EventPlayerData, rid: string): Map<number, number> => {
    return player.perRound[rid]?.scores || new Map();
  };

  const hasPlayerConcededAnyHole = (player: EventPlayerData, rid: string | null): boolean => {
    if (!rid) return false;
    const scores = getScoresForRound(player, rid);
    for (const score of scores.values()) {
      if (score === -1) return true;
    }
    return false;
  };

  const hasPlayerConcededAcrossEvent = (player: EventPlayerData): boolean => {
    for (const r of eventRounds) {
      if (hasPlayerConcededAnyHole(player, r.id)) return true;
    }
    return false;
  };

  const calculateTotalsForRound = (player: EventPlayerData, holes: CourseHole[], rid: string | null) => {
    let totalScore = 0;
    let totalPar = 0;
    let holesCompleted = 0;

    if (!rid) return { totalScore, totalPar, holesCompleted };

    const scores = getScoresForRound(player, rid);
    holes.forEach(hole => {
      const score = scores.get(hole.hole_number);
      if (score && score > 0) {
        totalScore += score;
        totalPar += hole.par;
        holesCompleted++;
      }
    });

    return { totalScore, totalPar, holesCompleted };
  };

  const calculateTotalsForEvent = (player: EventPlayerData) => {
    let totalScore = 0;
    let totalPar = 0;

    for (const r of eventRounds) {
      const holes = courseHolesByRound[r.id] || [];
      const roundTotals = calculateTotalsForRound(player, holes, r.id);
      totalScore += roundTotals.totalScore;
      totalPar += roundTotals.totalPar;
    }

    return { totalScore, totalPar };
  };

  const getScoreToPar = (score: number, par: number) => {
    const diff = score - par;
    if (diff === 0) return "E";
    if (diff > 0) return `+${diff}`;
    return diff.toString();
  };

  const getTodayScoreToParDisplay = (player: EventPlayerData) => {
    if (!selectedRoundId) return "E";
    if (hasPlayerConcededAnyHole(player, selectedRoundId)) return "-";
    const holes = courseHolesByRound[selectedRoundId] || [];
    const totals = calculateTotalsForRound(player, holes, selectedRoundId);
    return totals.totalScore > 0 ? getScoreToPar(totals.totalScore, totals.totalPar) : "E";
  };

  const getTotalScoreToParDisplay = (player: EventPlayerData) => {
    if (hasPlayerConcededAcrossEvent(player)) return "-";
    const totals = calculateTotalsForEvent(player);
    return totals.totalScore > 0 ? getScoreToPar(totals.totalScore, totals.totalPar) : "E";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-16">
        <div className="text-muted-foreground">Loading scorecard...</div>
      </div>
    );
  }

  const activeRoundId = selectedRoundId || roundId || null;
  const courseHoles = (activeRoundId && courseHolesByRound[activeRoundId]) ? courseHolesByRound[activeRoundId] : [];

  if (!round || courseHoles.length === 0) {
    return (
      <GameNotFound 
        onRetry={() => fetchRoundData()}
        message="This round was deleted or is no longer available."
      />
    );
  }

  const frontNine = courseHoles.slice(0, 9);
  const backNine = courseHoles.slice(9, 18);

  const handleFinishGame = async () => {
    try {
      toast({ title: "Round finished!" });
      navigate(`/round/${roundId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      // Delete pro stats data if it exists
      const { data: proRound } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundId)
        .maybeSingle();

      if (proRound?.id) {
        // Delete pro stats holes
        await supabase
          .from('pro_stats_holes')
          .delete()
          .eq('pro_round_id', proRound.id);
        
        // Delete pro stats round
        await supabase
          .from('pro_stats_rounds')
          .delete()
          .eq('id', proRound.id);
      }

      await supabase.from("holes").delete().eq("round_id", roundId);
      await supabase.from("round_players").delete().eq("round_id", roundId);
      await supabase.from("rounds").delete().eq("id", roundId);
      toast({ title: "Round deleted" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error deleting round", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={round.round_name || "Stroke Play"}
        courseName={round.course_name}
        pageTitle="Leaderboard"
        onBack={() => navigate('/')}
        isAdmin={isAdmin}
        onFinish={handleFinishGame}
        onSaveAndExit={() => navigate('/profile')}
        onDelete={handleDeleteGame}
        gameName="Round"
      />

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {eventRounds.length > 1 && (
          <div className="max-w-xs">
            <Select
              value={selectedRoundId || undefined}
              onValueChange={(v) => setSelectedRoundId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select round" />
              </SelectTrigger>
              <SelectContent>
                {eventRounds.map((r, idx) => (
                  <SelectItem key={r.id} value={r.id}>
                    {`Round ${idx + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(() => {
          // Calculate positions based on score to par
          const playersWithTotals = players.map(player => {
            const totals = calculateTotalsForEvent(player);
            const hasConceded = hasPlayerConcededAcrossEvent(player);
            // Players with conceded holes go to the bottom (Infinity)
            const scoreToPar = hasConceded ? Infinity : (totals.totalScore > 0 ? totals.totalScore - totals.totalPar : Infinity);
            return { player, scoreToPar, hasConceded };
          });
          
          // Sort by score to par (lower is better), conceded players go last
          // This sorted array is always used for position calculation
          const sortedForRanking = [...playersWithTotals].sort((a, b) => a.scoreToPar - b.scoreToPar);
          
          // Display order: sorted in spectator mode, original order otherwise
          const displayOrder = isSpectator ? sortedForRanking : playersWithTotals;
          
          // Helper for position with ties (always use sortedForRanking for correct positions)
          const getPositionLabel = (scoreToPar: number, hasConceded: boolean): string => {
            // Players with conceded holes show "-" instead of position
            if (hasConceded) return "-";
            
            const playersAhead = sortedForRanking.filter(p => p.scoreToPar < scoreToPar).length;
            const position = playersAhead + 1;
            const sameScoreCount = sortedForRanking.filter(p => p.scoreToPar === scoreToPar && !p.hasConceded).length;
            if (sameScoreCount > 1) {
              return `T${position}`;
            }
            return `${position}`;
          };

          return displayOrder.map(({ player, scoreToPar, hasConceded }) => {
            const isExpanded = expandedPlayerId === player.key;
            const frontTotals = calculateTotalsForRound(player, frontNine, selectedRoundId);
            const backTotals = calculateTotalsForRound(player, backNine, selectedRoundId);
            const overallTotals = calculateTotalsForRound(player, courseHoles, selectedRoundId);
            const positionLabel = getPositionLabel(scoreToPar, hasConceded);

            return (
              <Card key={player.key} className="overflow-hidden">

                {/* Player Info Bar - Clickable */}
                <div 
                  className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedPlayerId(isExpanded ? null : player.key)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronDown 
                        size={20} 
                        className={`text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                      />
                      <div className="bg-muted rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold">
                        {positionLabel}
                      </div>
                    <div>
                      <div className="text-xl font-bold">{player.display_name}</div>
                      <div className="text-sm text-muted-foreground">
                        HCP {Number(player.handicap) === 0 ? '0' : `+${player.handicap ? Math.abs(Number(player.handicap)) : 0}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-end justify-end gap-6">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Today</div>
                        <div className="text-2xl font-bold">{getTodayScoreToParDisplay(player)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">TOT</div>
                        <div className="text-3xl font-bold">{getTotalScoreToParDisplay(player)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

               {/* Scorecard Table - Only shown when expanded */}
              {isExpanded && (
                <>
                  {/* Front 9 */}
                  <div className="w-full">
                    <Table className="w-full table-fixed">
                      <TableHeader>
                        <TableRow className="bg-primary">
                          <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                          {frontNine.map(hole => (
                            <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                              {hole.hole_number}
                            </TableHead>
                          ))}
                          <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Out</TableHead>
                          <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                            {backNine.length > 0 ? '' : 'Tot'}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">HCP</TableCell>
                          {frontNine.map(hole => (
                            <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                              {hole.stroke_index}
                            </TableCell>
                          ))}
                          <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                          <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                          {frontNine.map(hole => (
                            <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                              {hole.par}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {frontNine.reduce((sum, h) => sum + h.par, 0)}
                          </TableCell>
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {backNine.length > 0 ? '' : frontNine.reduce((sum, h) => sum + h.par, 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="font-bold">
                          <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">{player.display_name.split(' ')[0]}</TableCell>
                          {frontNine.map(hole => {
                            const scores = getScoresForRound(player, selectedRoundId || "");
                            const mulligans = player.perRound[selectedRoundId || ""]?.mulligans || new Set<number>();
                            const score = scores.get(hole.hole_number);
                            const hasScore = scores.has(hole.hole_number);
                            const hasMulligan = mulligans.has(hole.hole_number);
                            return (
                              <TableCell 
                                key={hole.hole_number} 
                                className="text-center px-0 py-1"
                              >
                                <div className="flex items-center justify-center gap-0.5">
                                  {hasScore && score && score > 0 ? (
                                    <ScorecardScoreCell score={score} par={hole.par} />
                                  ) : hasScore ? (score === -1 ? '–' : '') : ''}
                                  {hasMulligan && <RotateCcw size={8} className="text-amber-500" />}
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {hasPlayerConcededAnyHole(player, selectedRoundId) ? '-' : (frontTotals.totalScore > 0 ? frontTotals.totalScore : '')}
                          </TableCell>
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {backNine.length > 0 ? '' : (hasPlayerConcededAnyHole(player, selectedRoundId) ? '-' : (overallTotals.totalScore > 0 ? overallTotals.totalScore : ''))}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Net</TableCell>
                          {frontNine.map(hole => {
                            const scores = getScoresForRound(player, selectedRoundId || "");
                            const score = scores.get(hole.hole_number);
                            const hasScore = scores.has(hole.hole_number);
                            return (
                              <TableCell key={hole.hole_number} className="text-center px-0 py-1">
                                {hasScore && score && score > 0 ? (
                                  <ScorecardScoreCell score={score} par={hole.par} />
                                ) : hasScore ? (score === -1 ? '–' : '') : ''}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {hasPlayerConcededAnyHole(player, selectedRoundId) ? '-' : (frontTotals.totalScore > 0 ? frontTotals.totalScore : '')}
                          </TableCell>
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {backNine.length > 0 ? '' : (hasPlayerConcededAnyHole(player, selectedRoundId) ? '-' : (overallTotals.totalScore > 0 ? overallTotals.totalScore : ''))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Back 9 - Only show if 18 holes */}
                  {courseHoles.length === 18 && backNine.length > 0 && (
                    <div className="w-full border-t">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow className="bg-primary">
                            <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                            {backNine.map(hole => (
                              <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                                {hole.hole_number}
                              </TableHead>
                            ))}
                            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">In</TableHead>
                            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Tot</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">HCP</TableCell>
                            {backNine.map(hole => (
                              <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                                {hole.stroke_index}
                              </TableCell>
                            ))}
                            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                            {backNine.map(hole => (
                              <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                                {hole.par}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {backNine.reduce((sum, h) => sum + h.par, 0)}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {courseHoles.reduce((sum, h) => sum + h.par, 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="font-bold">
                            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">{player.display_name.split(' ')[0]}</TableCell>
                            {backNine.map(hole => {
                              const scores = getScoresForRound(player, selectedRoundId || "");
                              const mulligans = player.perRound[selectedRoundId || ""]?.mulligans || new Set<number>();
                              const score = scores.get(hole.hole_number);
                              const hasScore = scores.has(hole.hole_number);
                              const hasMulligan = mulligans.has(hole.hole_number);
                              return (
                                <TableCell 
                                  key={hole.hole_number} 
                                  className="text-center px-0 py-1"
                                >
                                  <div className="flex items-center justify-center gap-0.5">
                                    {hasScore && score && score > 0 ? (
                                      <ScorecardScoreCell score={score} par={hole.par} />
                                    ) : hasScore ? (score === -1 ? '–' : '') : ''}
                                    {hasMulligan && <RotateCcw size={8} className="text-amber-500" />}
                                  </div>
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {hasPlayerConcededAnyHole(player, selectedRoundId) ? '-' : (backTotals.totalScore > 0 ? backTotals.totalScore : '')}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {hasPlayerConcededAnyHole(player, selectedRoundId) ? '-' : (overallTotals.totalScore > 0 ? overallTotals.totalScore : '')}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Net</TableCell>
                            {backNine.map(hole => {
                              const scores = getScoresForRound(player, selectedRoundId || "");
                              const score = scores.get(hole.hole_number);
                              const hasScore = scores.has(hole.hole_number);
                              return (
                                <TableCell key={hole.hole_number} className="text-center px-0 py-1">
                                  {hasScore && score && score > 0 ? (
                                    <ScorecardScoreCell score={score} par={hole.par} />
                                  ) : hasScore ? (score === -1 ? '–' : '') : ''}
                              </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {hasPlayerConcededAnyHole(player, selectedRoundId) ? '-' : (backTotals.totalScore > 0 ? backTotals.totalScore : '')}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {hasPlayerConcededAnyHole(player, selectedRoundId) ? '-' : (overallTotals.totalScore > 0 ? overallTotals.totalScore : '')}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Per-scorecard actions */}
                  <div className="px-4 pb-3">
                    <ScorecardActions
                      gameId={roundId!}
                      gameType={round?.origin === "skins" ? "skins" : "round"}
                      scorecardPlayerId={player.perRound[selectedRoundId || ""]?.roundPlayerId || player.key}
                      scorecardPlayerName={player.display_name}
                    />
                  </div>
                </>
              )}
              </Card>
            );
          });
        })()}
      </div>

      {!isSpectatorLoading && (
        round?.origin === "skins" ? (
          <SkinsBottomTabBar roundId={roundId!} isSpectator={isSpectator} />
        ) : (
          <RoundBottomTabBar roundId={roundId!} isSpectator={isSpectator} />
        )
      )}
    </div>
  );
}
