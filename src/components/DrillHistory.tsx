import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface DrillHistoryProps {
  drillTitle: string;
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

        const { data: drill } = await supabase
          .from('drills')
          .select('id')
          .eq('title', drillTitle)
          .single();

        if (!drill) return;

        const { data: drillResults } = await supabase
          .from('drill_results')
          .select('*')
          .eq('drill_id', drill.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Newspaper size={20} className="text-primary" />
            Drill History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {results.map((result) => (
            <div
              key={result.id}
              className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {format(new Date(result.created_at), 'MMM d, yyyy • h:mm a')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-foreground">
                  {result.total_points} points
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
