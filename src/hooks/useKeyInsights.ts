import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';
import { fetchUserStats, getStatInsights, StrokesGainedStats } from "@/utils/statisticsCalculations";

export function useKeyInsights(user: SupabaseUser | null) {
  const [performanceStats, setPerformanceStats] = useState<{ strokesGained: StrokesGainedStats; insights: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPerformanceStats(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadPerformanceStats = async () => {
      try {
        const stats = await fetchUserStats(user.id, 'all');
        if (!cancelled) {
          const insights = getStatInsights(stats);
          setPerformanceStats({ strokesGained: stats.strokesGained, insights });
        }
      } catch (error) {
        console.error('Error loading performance stats:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPerformanceStats();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { performanceStats, loading };
}
