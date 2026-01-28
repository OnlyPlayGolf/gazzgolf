import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PersonalBestBarProps {
  drillTitle: string;
  refreshTrigger?: number;
}

const PersonalBestBar = ({ drillTitle, refreshTrigger }: PersonalBestBarProps) => {
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPersonalBest();
  }, [drillTitle, refreshTrigger]);

  const loadPersonalBest = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Ensure drill exists and get its UUID by title
      const { data: drillId } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: drillTitle });

      if (!drillId) {
        setLoading(false);
        return;
      }

      // Get personal best (direction depends on drill)
      const bestAscending = drillTitle === 'PGA Tour 18-hole' || drillTitle === 'PGA Tour 18-hole Test';
      const { data: results } = await supabase
        .from('drill_results')
        .select('total_points, created_at')
        .eq('drill_id', drillId)
        .eq('user_id', user.id)
        .order('total_points', { ascending: bestAscending })
        .order('created_at', { ascending: true })
        .limit(1);

      if (results && results.length > 0) {
        setPersonalBest(results[0].total_points);
      }
    } catch (error) {
      console.error('Error loading personal best:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || personalBest === null) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/20">
              <Trophy className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Your Personal Best</p>
              <p className="text-2xl font-bold text-foreground">{personalBest} {drillTitle === 'PGA Tour 18-hole' || drillTitle === 'PGA Tour 18-hole Test' ? 'putts' : 'points'}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonalBestBar;
