import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, Plus, CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EventGameType = "round" | "copenhagen" | "best_ball" | "skins" | "wolf" | "umbriago" | "match_play";

interface EventRound {
  id: string;
  gameType: EventGameType;
  round_name: string | null;
  course_name: string;
  date_played: string;
}

/** Game/round that can be added to event: from unified list, not already in this event */
interface RoundOption {
  id: string;
  gameType: EventGameType;
  round_name: string | null;
  course_name: string;
  date_played: string;
}

interface EventSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  eventName: string | undefined;
  currentUserId: string | null;
  isCreator: boolean;
  /** All rounds/games from view rounds list (owned + participated); used to build "add round" list */
  allRounds?: Array<{ id: string; round_name?: string | null; course_name: string; date: string; gameType?: string; event_id?: string | null }>;
  onSaved?: () => void;
}

export function EventSettingsSheet({
  open,
  onOpenChange,
  eventId,
  eventName,
  currentUserId,
  isCreator,
  allRounds = [],
  onSaved,
}: EventSettingsSheetProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [eventRounds, setEventRounds] = useState<EventRound[]>([]);
  const [onlyCreatorCanAddRounds, setOnlyCreatorCanAddRounds] = useState(true);
  const [editableEventName, setEditableEventName] = useState("");
  const [updating, setUpdating] = useState(false);
  const [addRoundId, setAddRoundId] = useState<string | null>(null);

  // Games/rounds that can be added = all formats (except scramble) from view rounds list not already in this event
  const roundsWithoutEvent: RoundOption[] = useMemo(() => {
    if (!eventId) return [];
    const eventRoundIds = new Set(eventRounds.map((r) => r.id));
    const allowedTypes: Set<string> = new Set(["round", "copenhagen", "best_ball", "skins", "wolf", "umbriago", "match_play"]);
    return allRounds
      .filter(
        (r) => {
          const type = r.gameType ?? "round";
          if (!allowedTypes.has(type)) return false;
          if (eventRoundIds.has(r.id)) return false;
          if (type === "round" && r.event_id === eventId) return false;
          if (r.event_id === eventId) return false;
          return true;
        }
      )
      .map((r) => ({
        id: r.id,
        gameType: (r.gameType ?? "round") as EventGameType,
        round_name: r.round_name ?? null,
        course_name: r.course_name,
        date_played: r.date,
      }))
      .sort((a, b) => new Date(b.date_played).getTime() - new Date(a.date_played).getTime());
  }, [eventId, allRounds, eventRounds]);

  // Show event name in the box as soon as the sheet opens (from prop or after fetch)
  useEffect(() => {
    if (open && eventName) {
      setEditableEventName(eventName);
    }
  }, [open, eventName]);

  useEffect(() => {
    if (!open || !eventId || !currentUserId) {
      setEventRounds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [eventRes, roundsRes, copenhagenRes, bestBallRes, skinsRes, wolfRes, umbriagoRes, matchPlayRes] = await Promise.all([
          supabase.from("events").select("id, name, only_creator_can_add_rounds").eq("id", eventId).single(),
          supabase.from("rounds").select("id, round_name, course_name, date_played").eq("event_id", eventId).order("date_played", { ascending: false }),
          supabase.from("copenhagen_games").select("id, round_name, course_name, date_played").eq("event_id", eventId).order("date_played", { ascending: false }),
          supabase.from("best_ball_games").select("id, round_name, course_name, date_played").eq("event_id", eventId).order("date_played", { ascending: false }),
          supabase.from("skins_games").select("id, round_name, course_name, date_played").eq("event_id", eventId).order("date_played", { ascending: false }),
          supabase.from("wolf_games").select("id, round_name, course_name, date_played").eq("event_id", eventId).order("date_played", { ascending: false }),
          supabase.from("umbriago_games").select("id, round_name, course_name, date_played").eq("event_id", eventId).order("date_played", { ascending: false }),
          supabase.from("match_play_games").select("id, round_name, course_name, date_played").eq("event_id", eventId).order("date_played", { ascending: false }),
        ]);

        if (cancelled) return;
        if (eventRes.data) {
          const data = eventRes.data as { only_creator_can_add_rounds?: boolean; name?: string };
          setOnlyCreatorCanAddRounds(data.only_creator_can_add_rounds ?? true);
          setEditableEventName(data.name ?? "");
        }
        const withType = (rows: { id: string; round_name: string | null; course_name: string; date_played: string }[] | null, gameType: EventGameType): EventRound[] =>
          (rows || []).map((r) => ({ ...r, gameType }));
        const merged: EventRound[] = [
          ...withType(roundsRes.data, "round"),
          ...withType(copenhagenRes.data, "copenhagen"),
          ...withType(bestBallRes.data, "best_ball"),
          ...withType(skinsRes.data, "skins"),
          ...withType(wolfRes.data, "wolf"),
          ...withType(umbriagoRes.data, "umbriago"),
          ...withType(matchPlayRes.data, "match_play"),
        ].sort((a, b) => new Date(b.date_played).getTime() - new Date(a.date_played).getTime());
        setEventRounds(merged);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, eventId, currentUserId]);

  const tableForGameType: Record<EventGameType, string> = {
    round: "rounds",
    copenhagen: "copenhagen_games",
    best_ball: "best_ball_games",
    skins: "skins_games",
    wolf: "wolf_games",
    umbriago: "umbriago_games",
    match_play: "match_play_games",
  };

  const handleRemoveFromEvent = async (roundId: string, gameType: EventGameType) => {
    if (!eventId) return;
    setUpdating(true);
    try {
      const table = tableForGameType[gameType];
      const { error } = await supabase.from(table).update({ event_id: null }).eq("id", roundId);
      if (error) throw error;
      setEventRounds((prev) => prev.filter((r) => r.id !== roundId));
      toast({ title: "Removed from event" });
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Failed to remove", description: e?.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handleAddRoundToEvent = async () => {
    if (!eventId || !addRoundId) return;
    const [gameType, id] = addRoundId.includes(":") ? (addRoundId.split(":") as [EventGameType, string]) : ["round" as EventGameType, addRoundId];
    setUpdating(true);
    try {
      const table = tableForGameType[gameType];
      const { error } = await supabase.from(table).update({ event_id: eventId }).eq("id", id);
      if (error) throw error;
      const added = roundsWithoutEvent.find((r) => r.id === id && r.gameType === gameType);
      if (added) {
        setEventRounds((prev) => [{ id: added.id, gameType: added.gameType, round_name: added.round_name, course_name: added.course_name, date_played: added.date_played }, ...prev]);
      }
      setAddRoundId(null);
      toast({ title: "Added to event" });
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Failed to add", description: e?.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateEventName = async () => {
    const name = editableEventName.trim();
    if (!eventId || !name) return;
    setUpdating(true);
    try {
      const { error } = await supabase.from("events").update({ name }).eq("id", eventId);
      if (error) throw error;
      toast({ title: "Event name updated" });
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Failed to update name", description: e?.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleOnlyCreatorCanAdd = async (checked: boolean) => {
    if (!eventId || !isCreator) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({ only_creator_can_add_rounds: checked })
        .eq("id", eventId);
      if (error) throw error;
      setOnlyCreatorCanAddRounds(checked);
      toast({ title: "Event settings updated" });
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Failed to update setting", description: e?.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return d;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Event settings
          </SheetTitle>
        </SheetHeader>
        {!eventId ? (
          <p className="text-sm text-muted-foreground py-4">Select an event to manage settings.</p>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Event name - editable for creator */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Event name</Label>
              {isCreator ? (
                <div className="flex gap-2">
                  <Input
                    value={editableEventName}
                    onChange={(e) => setEditableEventName(e.target.value)}
                    placeholder="Event name"
                    className="flex-1"
                    disabled={updating}
                  />
                  <Button
                    size="sm"
                    onClick={handleUpdateEventName}
                    disabled={updating || !editableEventName.trim() || editableEventName.trim() === (eventName ?? "").trim()}
                  >
                    {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-foreground">{eventName ?? "Event"}</p>
              )}
              <p className="text-xs text-muted-foreground">Rounds and permissions for this event</p>
            </div>

            {/* Who can add rounds */}
            {isCreator && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Who can add rounds</Label>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Only I can add rounds</p>
                    <p className="text-xs text-muted-foreground">When on, only you can link rounds to this event</p>
                  </div>
                  <Switch
                    checked={onlyCreatorCanAddRounds}
                    onCheckedChange={handleToggleOnlyCreatorCanAdd}
                    disabled={updating}
                  />
                </div>
              </div>
            )}

            {/* Rounds/games in this event - newest first */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Rounds in this event ({eventRounds.length})</Label>
              {eventRounds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rounds linked yet. Add one below.</p>
              ) : (
                <ul className="space-y-2">
                  {[...eventRounds]
                    .sort((a, b) => new Date(b.date_played).getTime() - new Date(a.date_played).getTime())
                    .map((r) => (
                    <li
                      key={`${r.gameType}:${r.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{r.round_name || r.course_name}</p>
                        <p className="text-xs text-muted-foreground">{r.course_name} · {formatDate(r.date_played)}</p>
                      </div>
                      {isCreator && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveFromEvent(r.id, r.gameType)}
                          disabled={updating}
                          aria-label="Remove from event"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Add round to event */}
            {(isCreator || !onlyCreatorCanAddRounds) && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Add round to event</Label>
                {roundsWithoutEvent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All your rounds are already in an event or none found.</p>
                ) : (
                  <div className="flex gap-2">
                    <Select value={addRoundId ?? ""} onValueChange={(v) => setAddRoundId(v || null)} disabled={updating}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose a round..." />
                      </SelectTrigger>
                      <SelectContent className="z-[200]" position="popper">
                        {roundsWithoutEvent.map((r) => (
                          <SelectItem key={`${r.gameType}:${r.id}`} value={`${r.gameType}:${r.id}`}>
                            <div className="flex flex-col py-0.5">
                              <span className="font-medium">{r.round_name || r.course_name}</span>
                              <span className="text-xs text-muted-foreground">{formatDate(r.date_played)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleAddRoundToEvent}
                      disabled={!addRoundId || updating}
                      className="shrink-0"
                    >
                      {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
