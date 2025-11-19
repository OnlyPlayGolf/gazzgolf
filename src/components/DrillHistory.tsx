import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, Calendar, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface DrillHistoryProps {
  drillTitle: string;
}

const DRILL_ALIASES: Record<string, string[]> = {
  "Up & Down Putting Drill": ["Up & Down Putting"],
  "Wedge Point Game": ["Wedges 40–80 m — 2 Laps", "Wedges 40–80 m — Distance Control"],
  "8-Ball Drill": ["8-Ball Drill (points)"]
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

export function DrillHistory({ drillTitle }: DrillHistoryProps) {
  const [results, setResults] = useState<DrillResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const titles = [drillTitle, ...(DRILL_ALIASES[drillTitle] || [])];

        // Find all matching drills (current and legacy titles)
        const { data: drillsList } = await supabase
          .from('drills')
          .select('id, title')
          .in('title', titles);

        if (!drillsList || drillsList.length === 0) return;
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
              Drill History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No drill results yet. Complete the drill to see your history here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                  {window.completed ? (
                    <div className="flex flex-col items-end gap-1">
                      <Check className="h-5 w-5 text-green-600" />
                      <p className="text-xs text-muted-foreground">
                        {window.attempts || 1} {window.attempts === 1 ? 'shot' : 'shots'}
                      </p>
                    </div>
                  ) : (
                    <X className="h-5 w-5 text-red-600" />
                  )}
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
                  <p className="text-sm font-medium">
                    {attempt.attemptNumber
                      ? `Attempt ${attempt.attemptNumber}`
                      : `Attempt ${index + 1}`}
                  </p>
                  {attempt.distance && (
                    <p className="text-sm text-muted-foreground">
                      Distance: {attempt.distance}m
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
                      Result: {attempt.result}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    {(() => { const v = (attempt.points ?? attempt.score ?? attempt.putts ?? 0) as number; return `${v > 0 ? '+' : ''}${v}`; })()}
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
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Newspaper size={20} className="text-primary" />
            Drill History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {results.map((result) => (
              <AccordionItem key={result.id} value={result.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <Calendar size={16} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(result.created_at), 'MMM d, yyyy • h:mm a')}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-foreground">
                      {result.total_points} points
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {renderAttemptDetails(result)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
