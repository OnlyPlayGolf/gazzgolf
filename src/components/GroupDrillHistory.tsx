import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

const getDrillDisplayTitle = (title: string): string => {
  if (title === "Up & Down Putts 6-10m") return "Up & Down Putts 6-10m";
  if (title === "Short Putt Test") return "Short Putt Test";
  return title;
};

interface GroupDrillHistoryProps {
  groupId: string;
  groupCreatedAt?: string;
  includeCoaches?: boolean;
}

interface DrillResultWithProfile {
  id: string;
  total_points: number;
  created_at: string;
  drill_title: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

type DrillCategory = 'Putting' | 'Short Game' | 'Approach' | 'Tee Shots';

// Normalize drill titles (map old titles to new ones)
const normalizeDrillTitle = (title: string): string => {
  const titleMap: Record<string, string> = {
    '18-hole PGA Tour Putting Test': 'PGA Tour 18-hole Test',
  };
  return titleMap[title] || title;
};

const getDrillCategory = (drillTitle: string): DrillCategory | null => {
  // Normalize the title first
  const normalizedTitle = normalizeDrillTitle(drillTitle);
  
  const categoryMap: Record<string, DrillCategory> = {
    'Aggressive Putting 4-6m': 'Putting',
    'PGA Tour 18-hole Test': 'Putting',
    '18-hole PGA Tour Putting Test': 'Putting', // Legacy title
    'Short Putt Test': 'Putting',
    "Up & Down Putts 6-10m": 'Putting',
    "Lag Putting Drill 8-20m": 'Putting',
    '8-Ball Circuit': 'Short Game',
    '18 Up & Downs': 'Short Game',
    'Easy Chip Drill': 'Short Game',
    'Approach Control 130-180m': 'Approach',
    "9 Windows Shot Shape Test": 'Approach',
    "Wedge Ladder 60-120m": 'Approach',
    'Wedge Game 40-80m': 'Approach',
    'Shot Shape Master': 'Tee Shots',
    'Driver Control Drill': 'Tee Shots',
  };
  return categoryMap[normalizedTitle] || categoryMap[drillTitle] || null;
};

// Define drill order for each category (matching PuttingDrills.tsx order)
const drillOrderByCategory: Record<DrillCategory, string[]> = {
  'Putting': ['Short Putt Test', 'PGA Tour 18-hole Test', 'Aggressive Putting 4-6m', "Up & Down Putts 6-10m", "Lag Putting Drill 8-20m"],
  'Short Game': ['8-Ball Circuit', '18 Up & Downs', 'Easy Chip Drill'],
  'Approach': ['Wedge Game 40-80m', 'Wedge Ladder 60-120m', 'Approach Control 130-180m', "9 Windows Shot Shape Test"],
  'Tee Shots': ['Shot Shape Master', 'Driver Control Drill'],
};

const getScoreUnit = (drillName: string): string => {
  const drillUnits: { [key: string]: string } = {
    "Short Putt Test": "putts",
    "PGA Tour 18-hole Test": "putts",
    "Up & Down Putts 6-10m": "pts",
    "Aggressive Putting 4-6m": "putts",
    "8-Ball Circuit": "pts",
    "Approach Control 130-180m": "pts",
    "Shot Shape Master": "pts",
    "Easy Chip Drill": "streak",
    "18 Up & Downs": "shots",
    "9 Windows Shot Shape Test": "shots",
    "Wedge Ladder 60-120m": "shots",
    "Wedge Game 40-80m": "pts",
    "Driver Control Drill": "pts",
    "Lag Putting Drill 8-20m": "pts",
  };
  return drillUnits[drillName] || "pts";
};

interface DrillInfo {
  id: string;
  title: string;
}

export function GroupDrillHistory({ groupId, groupCreatedAt, includeCoaches = false }: GroupDrillHistoryProps) {
  const [results, setResults] = useState<DrillResultWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrill, setSelectedDrill] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [drills, setDrills] = useState<DrillInfo[]>([]);
  const [members, setMembers] = useState<{ user_id: string; display_name: string | null; username: string | null }[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchGroupHistory = async () => {
      try {
        // Get all group members with their roles
        const { data: groupMembers } = await supabase
          .from('group_members')
          .select(`
            user_id,
            role,
            profiles!inner(display_name, username, avatar_url)
          `)
          .eq('group_id', groupId);

        if (!groupMembers || groupMembers.length === 0) {
          setLoading(false);
          return;
        }

        // Coach groups default: only show players in history.
        // When includeCoaches is enabled, include everyone (including owner/admin).
        const playerMembers = includeCoaches
          ? groupMembers
          : groupMembers.filter((m: any) => m.role === 'member');
        
        const memberIds = playerMembers.map(m => m.user_id);
        const memberProfiles = playerMembers.map((m: any) => ({
          user_id: m.user_id,
          display_name: m.profiles.display_name,
          username: m.profiles.username,
          avatar_url: m.profiles.avatar_url
        }));
        setMembers(memberProfiles);

        // Get all drills
        const { data: drillsData } = await supabase
          .from('drills')
          .select('id, title')
          .order('title');

        if (drillsData) {
          // Deduplicate and filter to known drills
          const uniqueDrills = Array.from(
            new Map(drillsData.filter(d => getDrillCategory(d.title)).map(drill => [drill.title, drill])).values()
          );
          setDrills(uniqueDrills);
        }

        // Build query for drill results - only include drills completed after group creation
        let drillResultsQuery = supabase
          .from('drill_results')
          .select(`
            id,
            total_points,
            created_at,
            user_id,
            drill_id,
            drills!inner(title)
          `)
          .in('user_id', memberIds)
          .order('created_at', { ascending: false })
          .limit(100);

        // Filter by group creation date if provided
        if (groupCreatedAt) {
          drillResultsQuery = drillResultsQuery.gte('created_at', groupCreatedAt);
        }

        const { data: drillResults } = await drillResultsQuery;

        if (drillResults) {
          const resultsWithProfiles: DrillResultWithProfile[] = drillResults.map((r: any) => {
            const member = memberProfiles.find(m => m.user_id === r.user_id);
            return {
              id: r.id,
              total_points: r.total_points,
              created_at: r.created_at,
              drill_title: r.drills.title,
              user_id: r.user_id,
              display_name: member?.display_name || null,
              username: member?.username || null,
              avatar_url: member?.avatar_url || null
            };
          });
          setResults(resultsWithProfiles);
        }
      } catch (error) {
        console.error('Error fetching group drill history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroupHistory();
  }, [groupId, groupCreatedAt, includeCoaches]);

  const filteredResults = results.filter(result => {
    const drillMatch = selectedDrill === "all" || result.drill_title === selectedDrill;
    const memberMatch = selectedMember === "all" || result.user_id === selectedMember;
    return drillMatch && memberMatch;
  });

  if (loading) {
    return (
      <p className="text-center text-muted-foreground py-8">Loading history...</p>
    );
  }

  if (results.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No drill results yet from group members.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="w-full p-2 rounded-md border bg-background text-foreground text-sm"
        >
          <option value="all">All Members</option>
          {members.map(member => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name || member.username || 'Unknown'}
            </option>
          ))}
        </select>

        <select
          value={selectedDrill}
          onChange={(e) => setSelectedDrill(e.target.value)}
          className="w-full p-2 rounded-md border bg-background text-foreground text-sm"
        >
          <option value="all">All Drills</option>
          {(() => {
            const categories: DrillCategory[] = ['Putting', 'Short Game', 'Approach', 'Tee Shots'];
            const drillsByCategory = new Map<DrillCategory, DrillInfo[]>();
            
            drills.forEach(drill => {
              const category = getDrillCategory(drill.title);
              if (category) {
                if (!drillsByCategory.has(category)) {
                  drillsByCategory.set(category, []);
                }
                // Only add if not already added (avoid duplicates)
                if (!drillsByCategory.get(category)!.some(d => d.id === drill.id)) {
                  drillsByCategory.get(category)!.push(drill);
                }
              }
            });
            
            return categories.map(category => {
              const categoryDrills = drillsByCategory.get(category);
              if (!categoryDrills || categoryDrills.length === 0) return null;
              
              // Sort drills to match the order in drillOrderByCategory
              const order = drillOrderByCategory[category] || [];
              const sortedDrills = [...categoryDrills].sort((a, b) => {
                const normalizedA = normalizeDrillTitle(a.title);
                const normalizedB = normalizeDrillTitle(b.title);
                const indexA = order.indexOf(normalizedA) !== -1 ? order.indexOf(normalizedA) : order.indexOf(a.title);
                const indexB = order.indexOf(normalizedB) !== -1 ? order.indexOf(normalizedB) : order.indexOf(b.title);
                // If drill not in order array, put it at the end
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
              });
              
              return (
                <optgroup key={category} label={category}>
                  {sortedDrills.map(drill => {
                    const displayTitle = normalizeDrillTitle(drill.title);
                    return (
                      <option key={drill.id} value={drill.title}>
                        {getDrillDisplayTitle(displayTitle)}
                      </option>
                    );
                  })}
                </optgroup>
              );
            });
          })()}
        </select>
      </div>

      {/* Results List */}
      <div className="space-y-2">
        {filteredResults.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No results match your filters.
          </p>
        ) : (
          filteredResults.map((result) => (
            <div
              key={result.id}
              className="p-3 rounded-lg bg-secondary/30 space-y-2"
            >
              <div className="flex items-center gap-3">
                <ProfilePhoto
                  src={result.avatar_url}
                  alt={result.display_name || result.username || "U"}
                  fallback={result.display_name || result.username || "U"}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {result.display_name || result.username || 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {getDrillDisplayTitle(result.drill_title)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-primary">
                    {result.total_points} {getScoreUnit(result.drill_title)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(result.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredResults.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {filteredResults.length} of {results.length} results
        </p>
      )}
    </div>
  );
}
