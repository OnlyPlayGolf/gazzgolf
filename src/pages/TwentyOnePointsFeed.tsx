import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Newspaper, Trash2, X, Check } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const DRILL_TITLE = "21 Points";

interface PlayerResult {
  odId: string;
  displayName: string;
  totalPoints: number;
  pointsPerHole: number[];
}

interface GameResult {
  id: string;
  created_at: string;
  total_points: number;
  attempts_json: {
    players?: PlayerResult[];
    winnerOdId?: string;
    holesPlayed?: number;
  };
}

export default function TwentyOnePointsFeed() {
  const [results, setResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resultToDelete, setResultToDelete] = useState<GameResult | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const { toast } = useToast();

  const fetchResults = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUserId(null);
        setResults([]);
        return;
      }
      setCurrentUserId(user.id);

      const { data: drills } = await supabase
        .from("drills")
        .select("id")
        .eq("title", DRILL_TITLE)
        .limit(1);

      if (!drills?.length) {
        setResults([]);
        return;
      }

      const { data } = await supabase
        .from("drill_results")
        .select("id, created_at, total_points, attempts_json")
        .eq("drill_id", drills[0].id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setResults((data as GameResult[]) || []);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleDeleteModeToggle = () => {
    if (deleteMode) {
      setDeleteMode(false);
    } else {
      setDeleteMode(true);
      setSelectMode(false);
      setSelectedResults(new Set());
    }
  };

  const handleSelectModeToggle = () => {
    if (selectMode) {
      setSelectMode(false);
      setSelectedResults(new Set());
    } else {
      setSelectMode(true);
      setDeleteMode(false);
    }
  };

  const toggleResultSelection = (resultId: string) => {
    setSelectedResults((prev) => {
      const next = new Set(prev);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  };

  const handleResultClickInDeleteMode = (result: GameResult) => {
    setResultToDelete(result);
    setDeleteDialogOpen(true);
  };

  const handleDeleteResult = async () => {
    if (!resultToDelete || !currentUserId) return;
    try {
      const { error } = await supabase
        .from("drill_results")
        .delete()
        .eq("id", resultToDelete.id)
        .eq("user_id", currentUserId);

      if (error) throw error;
      toast({ title: "Result deleted", description: "The drill result has been deleted successfully." });
      setDeleteDialogOpen(false);
      setResultToDelete(null);
      setDeleteMode(false);
      await fetchResults();
    } catch (e: any) {
      toast({ title: "Error deleting result", description: e.message || "Failed to delete result", variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    if (!currentUserId) return;
    const toDelete = results.filter((r) => selectedResults.has(r.id));
    let success = 0;
    for (const result of toDelete) {
      try {
        const { error } = await supabase
          .from("drill_results")
          .delete()
          .eq("id", result.id)
          .eq("user_id", currentUserId);
        if (!error) success += 1;
      } catch {
        /* skip */
      }
    }
    toast({ title: "Deleted", description: `${success} result${success !== 1 ? "s" : ""} deleted.` });
    setShowBulkDeleteDialog(false);
    setSelectMode(false);
    setSelectedResults(new Set());
    await fetchResults();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">Loading history...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Newspaper size={20} className="text-primary" />
              Drill History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No completed 21 Points sessions yet. Finish a game to see it here.
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Newspaper size={20} className="text-primary" />
              Drill History
            </CardTitle>
            <div className="flex items-center gap-2">
              {deleteMode && !selectMode && (
                <Button variant="outline" size="sm" onClick={handleSelectModeToggle} className="h-9">
                  Select
                </Button>
              )}
              {selectMode && selectedResults.size > 0 && (
                <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)} className="h-9">
                  Delete ({selectedResults.size})
                </Button>
              )}
              <Button
                variant={deleteMode || selectMode ? "secondary" : "ghost"}
                size="icon"
                onClick={handleDeleteModeToggle}
                className="h-9 w-9"
                aria-label={deleteMode ? "Cancel delete" : "Delete results"}
              >
                {deleteMode || selectMode ? <X size={20} /> : <Trash2 size={20} />}
              </Button>
            </div>
          </div>
          {deleteMode && !selectMode && (
            <p className="text-sm text-destructive mt-2">Tap a result to delete it, or click &quot;Select&quot; to delete multiple</p>
          )}
          {selectMode && (
            <p className="text-sm text-destructive mt-2">
              {selectedResults.size > 0 ? `${selectedResults.size} result${selectedResults.size !== 1 ? "s" : ""} selected` : "Tap results to select them"}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {results.map((r) => {
              const players = (r.attempts_json?.players || []) as PlayerResult[];
              const myTotal = currentUserId
                ? (players.find((p) => p.odId === currentUserId)?.totalPoints ?? r.total_points)
                : r.total_points;
              const isSelected = selectedResults.has(r.id);

              return (
                <div key={r.id} className="relative">
                  {selectMode && (
                    <div
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer bg-background"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleResultSelection(r.id);
                      }}
                    >
                      {isSelected && <Check size={14} className="text-primary" />}
                    </div>
                  )}
                  <AccordionItem
                    value={r.id}
                    className={`${selectMode ? "ml-10" : ""} ${
                      deleteMode && !selectMode ? "ring-2 ring-destructive/50 hover:ring-destructive cursor-pointer" : ""
                    } ${selectMode && isSelected ? "ring-2 ring-destructive" : ""}`}
                  >
                    <AccordionTrigger
                      className="hover:no-underline py-4"
                      onClick={
                        deleteMode || selectMode
                          ? (e) => {
                              e.preventDefault();
                              if (selectMode) toggleResultSelection(r.id);
                              else if (deleteMode) handleResultClickInDeleteMode(r);
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between w-full pr-2 text-left">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(r.created_at), "MMM d, yyyy · h:mm a")}
                        </span>
                        <span className="text-lg font-bold text-foreground tabular-nums">{myTotal} pts</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Total points</p>
                        {[...players]
                          .sort((a, b) => b.totalPoints - a.totalPoints)
                          .map((p) => (
                            <div key={p.odId} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 text-sm">
                              <span className="font-medium truncate">{p.displayName}</span>
                              <span className="font-semibold tabular-nums shrink-0 ml-2">{p.totalPoints} pts</span>
                            </div>
                          ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </div>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Result</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this drill result? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResultToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteResult}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedResults.size} Result{selectedResults.size !== 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedResults.size} result{selectedResults.size !== 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedResults.size} Result{selectedResults.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
