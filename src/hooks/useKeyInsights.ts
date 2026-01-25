import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';
import { fetchUserStats, getStatInsights, StrokesGainedStats } from "@/utils/statisticsCalculations";

interface WeeklyStreak {
  streak: number;
  type: 'drill' | 'level' | 'round';
}

// Helper function to get week start (Monday) of a date
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

// Helper function to get week identifier (YYYY-MM-DD of week start)
function getWeekId(date: Date): string {
  const weekStart = getWeekStart(date);
  return weekStart.toISOString().split('T')[0];
}

// Calculate weekly streak from activity dates
function calculateWeeklyStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  
  // Get unique week IDs
  const weekIds = new Set(dates.map(d => getWeekId(d)));
  const sortedWeeks = Array.from(weekIds)
    .map(id => new Date(id))
    .sort((a, b) => b.getTime() - a.getTime()); // Most recent first
  
  if (sortedWeeks.length === 0) return 0;
  
  // Check if the most recent week includes today
  const currentWeekStart = getWeekStart(new Date());
  const mostRecentWeekStart = getWeekStart(sortedWeeks[0]);
  
  // If most recent week is not current week, no active streak
  if (mostRecentWeekStart.getTime() !== currentWeekStart.getTime()) {
    return 0;
  }
  
  // Count consecutive weeks starting from current week
  let streak = 1;
  let expectedWeekStart = new Date(currentWeekStart);
  expectedWeekStart.setDate(expectedWeekStart.getDate() - 7); // Go back one week
  
  for (let i = 1; i < sortedWeeks.length; i++) {
    const weekStart = getWeekStart(sortedWeeks[i]);
    const expectedWeekId = getWeekId(expectedWeekStart);
    const weekId = getWeekId(weekStart);
    
    if (weekId === expectedWeekId) {
      streak++;
      expectedWeekStart.setDate(expectedWeekStart.getDate() - 7); // Go back another week
    } else {
      break;
    }
  }
  
  return streak;
}

async function fetchWeeklyStreak(userId: string): Promise<WeeklyStreak> {
  const now = new Date();
  const eightWeeksAgo = new Date(now.getTime() - (8 * 7 * 24 * 60 * 60 * 1000));
  
  // Fetch drill completions
  const { data: drillResults } = await supabase
    .from('drill_results')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', eightWeeksAgo.toISOString());
  
  // Fetch level completions
  const { data: levelProgress } = await supabase
    .from('level_progress')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('completed', true)
    .not('completed_at', 'is', null)
    .gte('completed_at', eightWeeksAgo.toISOString());
  
  // Fetch rounds
  const { data: rounds } = await supabase
    .from('rounds')
    .select('date_played, created_at')
    .eq('user_id', userId)
    .gte('date_played', eightWeeksAgo.toISOString().split('T')[0]);
  
  // Combine all activity dates
  const allDates: Date[] = [];
  
  if (drillResults) {
    drillResults.forEach(r => {
      if (r.created_at) allDates.push(new Date(r.created_at));
    });
  }
  
  if (levelProgress) {
    levelProgress.forEach(l => {
      if (l.completed_at) allDates.push(new Date(l.completed_at));
    });
  }
  
  if (rounds) {
    rounds.forEach(r => {
      if (r.date_played) {
        const date = new Date(r.date_played);
        // Use created_at if available for more precise timing
        if (r.created_at) {
          allDates.push(new Date(r.created_at));
        } else {
          allDates.push(date);
        }
      }
    });
  }
  
  const streak = calculateWeeklyStreak(allDates);
  
  // Determine type based on most recent activity
  if (allDates.length === 0) {
    return { streak: 0, type: 'round' };
  }
  
  const sortedDates = allDates.sort((a, b) => b.getTime() - a.getTime());
  const mostRecent = sortedDates[0];
  
  // Check what type the most recent activity is
  const isDrill = drillResults?.some(r => r.created_at && new Date(r.created_at).getTime() === mostRecent.getTime());
  const isLevel = levelProgress?.some(l => l.completed_at && new Date(l.completed_at).getTime() === mostRecent.getTime());
  
  let type: 'drill' | 'level' | 'round' = 'round';
  if (isDrill) type = 'drill';
  else if (isLevel) type = 'level';
  
  return { streak, type };
}

export function useKeyInsights(user: SupabaseUser | null) {
  const [performanceStats, setPerformanceStats] = useState<{ strokesGained: StrokesGainedStats; insights: any[]; weeklyStreak: WeeklyStreak } | null>(null);
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
        const insights = getStatInsights(stats);
        const weeklyStreak = await fetchWeeklyStreak(user.id);
        
        if (!cancelled) {
          setPerformanceStats({ strokesGained: stats.strokesGained, insights, weeklyStreak });
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
