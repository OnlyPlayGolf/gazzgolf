import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Newspaper, Check, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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
import { useToast } from "@/hooks/use-toast";

interface DrillHistoryProps {
  drillTitle: string;
  /** Removes the word “Drill” from visible copy (used for specific drills) */
  hideDrillWord?: boolean;
}

const DRILL_ALIASES: Record<string, string[]> = {
  "Up & Down Putting Drill": ["Up & Down Putting"],
  "Wedge Point Game": ["Wedges 40–80 m — 2 Laps", "Wedges 40–80 m — Distance Control"],
  "8-Ball Drill": ["8-Ball Drill (points)"],
  "Driver Control Drill": ["Driver Control"],
  "18 Up & Downs": []
};

interface DrillAttempt {
  attemptNumber?: number;
  distance?: number;
  outcome?: string;
  points?: number;
  bonusPoints?: number;
  club?: string;
  shotType?: string;
  result?: string;
  [key: string]: any;
}

interface DrillResult {
  id: string;
  total_points: number;
  created_at: string;
  attempts_json: any;
}

export function DrillHistory({ drillTitle, hideDrillWord = false, onDelete }: DrillHistoryProps) {
  const [results, setResults] = useState<DrillResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resultToDelete, setResultToDelete] = useState<DrillResult | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchResults = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUserId(null);
        return;
      }

      setCurrentUserId(user.id);

      const titles = [drillTitle, ...(DRILL_ALIASES[drillTitle] || [])];

      // Find all matching drills (current and legacy titles)
      const { data: drillsList } = await supabase
        .from('drills')
        .select('id, title')
        .in('title', titles);

      if (!drillsList || drillsList.length === 0) {
        setResults([]);
        return;
      }
      const drillIds = drillsList.map(d => d.id);

      const { data: drillResults } = await supabase
        .from('drill_results')
        .select('*')
        .in('drill_id', drillIds)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setResults(drillResults || []);
    } catch (error) {
      console.error('Error fetching drill history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [drillTitle]);

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
              {hideDrillWord ? "History" : "Drill History"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              {hideDrillWord
                ? "No results yet. Complete the practice to see your history here."
                : "No drill results yet. Complete the drill to see your history here."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  };

  const handleResultClickInDeleteMode = (result: DrillResult) => {
    setResultToDelete(result);
    setDeleteDialogOpen(true);
  };

  const handleDeleteResult = async () => {
    if (!resultToDelete || !currentUserId) return;

    try {
      // Verify the result belongs to the current user
      const { error } = await supabase
        .from('drill_results')
        .delete()
        .eq('id', resultToDelete.id)
        .eq('user_id', currentUserId);

      if (error) throw error;

      toast({
        title: "Result deleted",
        description: "The drill result has been deleted successfully.",
      });

      setDeleteDialogOpen(false);
      setResultToDelete(null);
      setDeleteMode(false);
      await fetchResults();
      
      // Notify parent component to refresh leaderboards if callback provided
      if (onDelete) {
        onDelete();
      }
    } catch (error: any) {
      console.error('Error deleting result:', error);
      toast({
        title: "Error deleting result",
        description: error.message || "Failed to delete result",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (!currentUserId) return;

    const resultsToDelete = results.filter(r => selectedResults.has(r.id));
    let successCount = 0;
    let failCount = 0;

    for (const result of resultsToDelete) {
      try {
        // Verify the result belongs to the current user and delete it
        const { data, error } = await supabase
          .from('drill_results')
          .delete()
          .eq('id', result.id)
          .eq('user_id', currentUserId)
          .select();

        if (error) throw error;

        // Only count as success if at least one row was deleted
        if (data && data.length > 0) {
          successCount++;
        } else {
          throw new Error('No rows were deleted. The result may not exist or you may not have permission to delete it.');
        }
      } catch (error) {
        console.error('Error deleting result:', result.id, error);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: `${successCount} result${successCount !== 1 ? 's' : ''} deleted`,
        description: "The drill results have been deleted successfully.",
      });
    }
    if (failCount > 0) {
      toast({
        title: `Failed to delete ${failCount} result${failCount !== 1 ? 's' : ''}`,
        variant: "destructive",
      });
    }

    setShowBulkDeleteDialog(false);
    setSelectedResults(new Set());
    setSelectMode(false);
    setDeleteMode(false);
    await fetchResults();
    
    // Notify parent component to refresh leaderboards if callback provided
    if (onDelete) {
      onDelete();
    }
  };

  const renderAttemptDetails = (result: DrillResult) => {
    const attemptsData = result.attempts_json;
    
    // Check if this is TW's 9 Windows Test format
    const isTW9Windows = Array.isArray(attemptsData) && 
      attemptsData.length > 0 && 
      attemptsData[0]?.height !== undefined && 
      attemptsData[0]?.shape !== undefined &&
      attemptsData[0]?.windowNumber !== undefined;

    if (isTW9Windows) {
      return (
        <div className="space-y-2 pt-2">
          {attemptsData.map((window: any, index: number) => (
            <div
              key={index}
              className="p-3 rounded-lg border bg-muted"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Window {window.windowNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {window.height} • {window.shape}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    {typeof window.attempts === 'number' ? window.attempts : '?'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {typeof window.attempts === 'number' ? (window.attempts === 1 ? 'shot' : 'shots') : 'shots'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // Check if this is Wedges Progression format
    const isWedgesProgression = Array.isArray(attemptsData) && 
      attemptsData.length > 0 && 
      attemptsData[0]?.distance !== undefined && 
      Array.isArray(attemptsData[0]?.attempts);

    if (isWedgesProgression) {
      return (
        <div className="space-y-2 pt-2">
          {attemptsData.map((distanceData: any, index: number) => (
            <div
              key={index}
              className="p-3 rounded-lg border bg-muted"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {distanceData.distance}m
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {distanceData.completed ? '✓ Completed' : 'Not completed'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    {distanceData.attempts?.length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {distanceData.attempts?.length === 1 ? 'shot' : 'shots'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Check if this is 18 Up & Downs format
    const isUpDownsTest = Array.isArray(attemptsData) && 
      attemptsData.length > 0 && 
      attemptsData[0]?.lie !== undefined && 
      attemptsData[0]?.distance !== undefined &&
      attemptsData[0]?.shots !== undefined;

    if (isUpDownsTest) {
      const upAndDowns = attemptsData.filter((station: any) => station.shots !== null && station.shots <= 2).length;
      return (
        <div className="space-y-3 pt-2">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm font-medium text-center">
              <span className="text-primary font-bold">{upAndDowns}/18</span> Up & Downs
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {attemptsData.map((station: any, index: number) => {
              const isUpAndDown = station.shots !== null && station.shots <= 2;
              return (
                <div
                  key={index}
                  className="p-2 rounded-lg border bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{index + 1}.</span>
                      <span className="text-xs font-medium">
                        {station.lie} <span className="text-foreground">{station.distance}m</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isUpAndDown ? 'text-primary' : 'text-foreground'}`}>
                        {station.shots}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Standard drill format
    const attempts = Array.isArray(attemptsData) ? attemptsData : [];

    return (
      <div className="space-y-2 pt-2">
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attempt details available</p>
        ) : (
          attempts.map((attempt, index) => (
            <div
              key={index}
              className="p-3 rounded-lg border bg-muted"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  {drillTitle !== "8-Ball Drill" && (
                    <p className="text-sm font-medium">
                      {attempt.attemptNumber
                        ? `Attempt ${attempt.attemptNumber}`
                        : `Attempt ${index + 1}`}
                    </p>
                  )}
                  {attempt.distance && (
                    <p className="text-sm text-muted-foreground">
                      Distance: {(() => {
                        if (typeof attempt.distance === 'string') {
                          // Replace "m" with "meters" but preserve "(2ft)" format
                          let distance = attempt.distance.replace(/(\d+(?:\.\d+)?)m(?=\s|\)|$)/g, '$1 meters');
                          // Remove any trailing "m" that shouldn't be there
                          distance = distance.replace(/meters\)m$/, 'meters)');
                          return distance;
                        }
                        return `${attempt.distance} meters`;
                      })()}
                    </p>
                  )}
                  {attempt.club && (
                    <p className="text-sm text-muted-foreground">
                      Club: {attempt.club}
                    </p>
                  )}
                  {attempt.shotType && (
                    <p className="text-sm text-muted-foreground">
                      Type: {attempt.shotType}
                    </p>
                  )}
                  {attempt.round !== undefined && (
                    <p className="text-sm text-muted-foreground">
                      Round: {attempt.round}
                    </p>
                  )}
                  {attempt.station && (
                    <p className="text-sm text-muted-foreground">
                      Station: {attempt.station}
                    </p>
                  )}
                  {attempt.outcome && (
                    <p className="text-sm text-muted-foreground">
                      Outcome: {attempt.outcome}
                    </p>
                  )}
                  {attempt.result && (
                    <p className="text-sm text-muted-foreground">
                      Result: {attempt.result.replace('-', ' ')}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    {(() => { const v = (attempt.points ?? attempt.score ?? attempt.putts ?? 0) as number; return `${v}`; })()}
                  </p>
                  {attempt.bonusPoints !== undefined && attempt.bonusPoints > 0 && (
                    <p className="text-sm text-green-600">
                      +{attempt.bonusPoints} bonus
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Newspaper size={20} className="text-primary" />
              {hideDrillWord ? "History" : "Drill History"}
            </CardTitle>
            {results.length > 0 && (
              <div className="flex items-center gap-2">
                {deleteMode && !selectMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectModeToggle}
                    className="h-9"
                  >
                    Select
                  </Button>
                )}
                {selectMode && selectedResults.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    className="h-9"
                  >
                    Delete ({selectedResults.size})
                  </Button>
                )}
                <Button
                  variant={(deleteMode || selectMode) ? "secondary" : "ghost"}
                  size="icon"
                  onClick={handleDeleteModeToggle}
                  className="h-9 w-9"
                  aria-label={deleteMode ? "Cancel delete" : "Delete results"}
                >
                  {(deleteMode || selectMode) ? <X size={20} /> : <Trash2 size={20} />}
                </Button>
              </div>
            )}
          </div>
          {deleteMode && !selectMode && (
            <p className="text-sm text-destructive mt-2">
              Tap a result to delete it, or click "Select" to delete multiple
            </p>
          )}
          {selectMode && (
            <p className="text-sm text-destructive mt-2">
              {selectedResults.size > 0 
                ? `${selectedResults.size} result${selectedResults.size !== 1 ? 's' : ''} selected` 
                : "Tap results to select them"}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {results.map((result) => {
              const isSelected = selectedResults.has(result.id);
              
              // Determine click handler based on mode
              let clickHandler: (() => void) | undefined;
              if (selectMode) {
                clickHandler = () => toggleResultSelection(result.id);
              } else if (deleteMode) {
                clickHandler = () => handleResultClickInDeleteMode(result);
              }

              return (
                <div 
                  key={result.id} 
                  className="relative"
                >
                  {selectMode && (
                    <div 
                      className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer ${
                        isSelected 
                          ? "bg-destructive border-destructive" 
                          : "bg-background border-muted-foreground hover:border-destructive"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleResultSelection(result.id);
                      }}
                    >
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>
                  )}
                  <AccordionItem 
                    value={result.id}
                    className={`${selectMode ? "ml-10" : ""} ${
                      deleteMode && !selectMode
                        ? "ring-2 ring-destructive/50 hover:ring-destructive cursor-pointer" 
                        : selectMode
                          ? isSelected
                            ? "ring-2 ring-destructive cursor-pointer"
                            : "cursor-pointer hover:ring-1 hover:ring-destructive/50"
                          : ""
                    }`}
                  >
                    <AccordionTrigger 
                      className="hover:no-underline"
                      onClick={(e) => {
                        if (deleteMode || selectMode) {
                          e.preventDefault();
                          e.stopPropagation();
                          // Handle the click for selection or deletion
                          if (selectMode) {
                            toggleResultSelection(result.id);
                          } else if (deleteMode) {
                            handleResultClickInDeleteMode(result);
                          }
                        }
                      }}
                    >
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center">
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(result.created_at), 'MMM d, yyyy • h:mm a')}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-foreground">
                          {result.total_points} {drillTitle === "TW's 9 Windows Test" || drillTitle === "18 Up & Downs" || drillTitle === "Åberg's Wedge Ladder" ? 'shots' : drillTitle === "Aggressive Putting" || drillTitle === "PGA Tour 18 Holes" || drillTitle === "Short Putting Test" ? 'putts' : drillTitle === "Easy Chip Drill" ? 'in a row' : 'points'}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {renderAttemptDetails(result)}
                    </AccordionContent>
                  </AccordionItem>
                </div>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Single delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Result</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this drill result? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResultToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteResult}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedResults.size} Result{selectedResults.size !== 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedResults.size} result{selectedResults.size !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedResults.size} Result{selectedResults.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
