import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronDown } from "lucide-react";

const getDrillDisplayTitle = (title: string): string => {
  // Use normalized title for display
  return normalizeDrillTitle(title);
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
  attempts_json?: {
    players?: Array<{
      odId: string;
      displayName: string;
      totalPoints: number;
      pointsPerHole?: number[];
    }>;
    winnerOdId?: string;
    holesPlayed?: number;
    gameId?: string;
  };
}

type DrillCategory = 'Putting' | 'Short Game' | 'Approach' | 'Tee Shots';

// Normalize drill titles (map old/variant titles to canonical ones)
const normalizeDrillTitle = (title: string): string => {
  const titleMap: Record<string, string> = {
    '18-hole PGA Tour Putting Test': 'PGA Tour 18-hole',
    "PGA Tour 18 Holes": 'PGA Tour 18-hole',
    "PGA Tour 18-hole Test": 'PGA Tour 18-hole',
    "PGA Tour 18-hole": 'PGA Tour 18-hole',
    "TW's 9 Windows Test": "9 Windows Shot Shape",
    "9 Windows Shot Shape Test": "9 Windows Shot Shape",
    "9 Windows Shot Shape": "9 Windows Shot Shape",
    "Aggressive Putting": "Aggressive Putting 4-6m",
    "Aggressive Putting 4-6m": "Aggressive Putting 4-6m",
    "Short Putt Test": "Short Putt Test",
    "Up & Down Putts 6-10m": "Up & Down Putts 6-10m",
    "Lag Putting Drill 8-20m": "Lag Putting Drill 8-20m",
    "8-Ball Circuit": "8-Ball Circuit",
    "18 Up & Downs": "18 Up & Downs",
    "Easy Chip Drill": "Easy Chip Drill",
    "Approach Control 130-180m": "Approach Control 130-180m",
    "Wedge Ladder 60-120m": "Wedge Ladder 60-120m",
    "Wedge Game 40-80m": "Wedge Game 40-80m",
    "Shot Shape Master": "Shot Shape Master",
    "Driver Control Drill": "Driver Control Drill",
    "21 Points": "21 Points",
  };
  return titleMap[title] || title;
};

const getDrillCategory = (drillTitle: string): DrillCategory | null => {
  // Normalize the title first
  const normalizedTitle = normalizeDrillTitle(drillTitle);
  
  const categoryMap: Record<string, DrillCategory> = {
    'Aggressive Putting 4-6m': 'Putting',
    'PGA Tour 18-hole': 'Putting',
    'PGA Tour 18-hole Test': 'Putting', // Legacy title
    '18-hole PGA Tour Putting Test': 'Putting', // Legacy title
    'Short Putt Test': 'Putting',
    "Up & Down Putts 6-10m": 'Putting',
    "Lag Putting Drill 8-20m": 'Putting',
    '8-Ball Circuit': 'Short Game',
    '18 Up & Downs': 'Short Game',
    'Easy Chip Drill': 'Short Game',
    '21 Points': 'Short Game',
    'Approach Control 130-180m': 'Approach',
    "9 Windows Shot Shape": 'Approach',
    "9 Windows Shot Shape Test": 'Approach', // Legacy title
    "Wedge Ladder 60-120m": 'Approach',
    'Wedge Game 40-80m': 'Approach',
    'Shot Shape Master': 'Tee Shots',
    'Driver Control Drill': 'Tee Shots',
  };
  return categoryMap[normalizedTitle] || categoryMap[drillTitle] || null;
};

// Define drill order for each category (matching PuttingDrills.tsx order)
const drillOrderByCategory: Record<DrillCategory, string[]> = {
  'Putting': ['Short Putt Test', 'PGA Tour 18-hole', 'Aggressive Putting 4-6m', "Up & Down Putts 6-10m", "Lag Putting Drill 8-20m"],
  'Short Game': ['8-Ball Circuit', '18 Up & Downs', 'Easy Chip Drill', '21 Points'],
  'Approach': ['Wedge Game 40-80m', 'Wedge Ladder 60-120m', 'Approach Control 130-180m', "9 Windows Shot Shape"],
  'Tee Shots': ['Shot Shape Master', 'Driver Control Drill'],
};

const getScoreUnit = (drillName: string): string => {
  // Normalize the drill name first to handle variations
  const normalizedName = normalizeDrillTitle(drillName);
  
  const drillUnits: { [key: string]: string } = {
    "Short Putt Test": "in a row",
    "PGA Tour 18-hole": "putts",
    "PGA Tour 18-hole Test": "putts", // Legacy
    "Up & Down Putts 6-10m": "pts",
    "Aggressive Putting 4-6m": "putts",
    "8-Ball Circuit": "pts",
    "Approach Control 130-180m": "pts",
    "Shot Shape Master": "pts",
    "Easy Chip Drill": "in a row",
    "18 Up & Downs": "shots",
    "9 Windows Shot Shape": "shots",
    "9 Windows Shot Shape Test": "shots", // Legacy
    "Wedge Ladder 60-120m": "shots",
    "Wedge Game 40-80m": "pts",
    "Driver Control Drill": "pts",
    "Lag Putting Drill 8-20m": "pts",
    "21 Points": "pts",
  };
  // Try normalized name first, then original, then default
  return drillUnits[normalizedName] || drillUnits[drillName] || "pts";
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
  const [selectedRounds, setSelectedRounds] = useState<Record<string, number>>({});

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
          // Deduplicate by normalized title to remove duplicates like "Aggressive Putting" vs "Aggressive Putting 4-6m"
          const drillsByNormalizedTitle = new Map<string, DrillInfo>();
          
          // First pass: collect all drills by normalized title
          drillsData
            .filter(d => getDrillCategory(d.title))
            .forEach(drill => {
              const normalizedTitle = normalizeDrillTitle(drill.title);
              if (!drillsByNormalizedTitle.has(normalizedTitle)) {
                drillsByNormalizedTitle.set(normalizedTitle, drill);
              }
            });
          
          // Second pass: prefer canonical titles (titles that match their normalized form)
          drillsData
            .filter(d => getDrillCategory(d.title))
            .forEach(drill => {
              const normalizedTitle = normalizeDrillTitle(drill.title);
              const existing = drillsByNormalizedTitle.get(normalizedTitle);
              // If the current drill's title matches the normalized title exactly, prefer it
              if (existing && drill.title === normalizedTitle && existing.title !== normalizedTitle) {
                drillsByNormalizedTitle.set(normalizedTitle, drill);
              }
            });
          
          const list = Array.from(drillsByNormalizedTitle.values());
          // Ensure "21 Points" appears in the list even if not yet in DB
          if (!list.some(d => normalizeDrillTitle(d.title) === '21 Points')) {
            list.push({ id: 'synthetic-21-points', title: '21 Points' });
          }
          setDrills(list);
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
            attempts_json,
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
              avatar_url: member?.avatar_url || null,
              attempts_json: r.attempts_json || undefined,
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
    // Normalize both the result title and selected drill for comparison
    const normalizedResultTitle = normalizeDrillTitle(result.drill_title);
    const normalizedSelectedDrill = selectedDrill === "all" ? "all" : normalizeDrillTitle(selectedDrill);
    
    const drillMatch = normalizedSelectedDrill === "all" || 
                      normalizedResultTitle === normalizedSelectedDrill ||
                      result.drill_title === selectedDrill; // Also check original for backwards compatibility
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
          <Accordion type="single" collapsible className="w-full space-y-2">
            {filteredResults.map((result) => {
              const is21Points = normalizeDrillTitle(result.drill_title) === '21 Points';
              const isEightBall = normalizeDrillTitle(result.drill_title) === '8-Ball Circuit';
              const players = (result.attempts_json?.players || []) as Array<{
                odId: string;
                displayName: string;
                totalPoints: number;
              }>;

              if (is21Points && players.length > 0) {
                // 21 Points: show expandable dropdown with all players' scores
                const sortedPlayers = [...players].sort((a, b) => b.totalPoints - a.totalPoints);
                return (
                  <AccordionItem key={result.id} value={result.id} className="border-none">
                    <div className="p-3 rounded-lg bg-secondary/30">
                      <AccordionTrigger className="hover:no-underline py-0">
                        <div className="flex items-center gap-3 w-full pr-2">
                          <ProfilePhoto
                            src={result.avatar_url}
                            alt={result.display_name || result.username || "U"}
                            fallback={result.display_name || result.username || "U"}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="font-medium text-sm truncate">
                              {result.display_name || result.username || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {getDrillDisplayTitle(result.drill_title)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-primary">
                              {result.total_points !== null && result.total_points !== undefined ? (
                                `${result.total_points} ${getScoreUnit(result.drill_title)}`
                              ) : (
                                'No score'
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(result.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 pt-2 border-t mt-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Total points</p>
                          {sortedPlayers.map((p) => (
                            <div key={p.odId} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 text-sm">
                              <span className="font-medium truncate">{p.displayName}</span>
                              <span className="font-semibold tabular-nums shrink-0 ml-2">{p.totalPoints} pts</span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                );
              }

              if (isEightBall && Array.isArray(result.attempts_json)) {
                // 8-Ball Circuit: show expandable dropdown with round tabs and shots
                const attemptsData = result.attempts_json;
                
                // Helper function to format outcome labels
                const formatOutcome = (outcome: string): string => {
                  switch (outcome) {
                    case '1m':
                      return 'Inside 1 meter';
                    case '2m':
                      return 'Inside 2 meters';
                    case '3m':
                      return 'Inside 3 meters';
                    case 'miss':
                      return 'Outside 3 meters';
                    case 'holed':
                      return 'Holed';
                    default:
                      return outcome;
                  }
                };

                // Group attempts by round
                const rounds: Record<number, typeof attemptsData> = {};
                attemptsData.forEach((attempt: any) => {
                  if (attempt.station && attempt.round !== undefined && attempt.outcome !== undefined) {
                    const round = attempt.round;
                    if (!rounds[round]) {
                      rounds[round] = [];
                    }
                    rounds[round].push(attempt);
                  }
                });

                // Get selected round for this result (default to round 1)
                const selectedRound = selectedRounds[result.id] ?? 1;
                const currentRoundAttempts = rounds[selectedRound] || [];

                return (
                  <AccordionItem key={result.id} value={result.id} className="border-none">
                    <div className="p-3 rounded-lg bg-secondary/30">
                      <AccordionTrigger className="hover:no-underline py-0">
                        <div className="flex items-center gap-3 w-full pr-2">
                          <ProfilePhoto
                            src={result.avatar_url}
                            alt={result.display_name || result.username || "U"}
                            fallback={result.display_name || result.username || "U"}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="font-medium text-sm truncate">
                              {result.display_name || result.username || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {getDrillDisplayTitle(result.drill_title)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-primary">
                              {result.total_points !== null && result.total_points !== undefined ? (
                                `${result.total_points} ${getScoreUnit(result.drill_title)}`
                              ) : (
                                'No score'
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(result.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2 border-t mt-2">
                          {/* Round Tabs */}
                          <div className="flex gap-2 justify-center items-center">
                            {[1, 2, 3, 4, 5].map((roundNum) => (
                              <Button
                                key={roundNum}
                                variant={selectedRound === roundNum ? "default" : "outline"}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRounds(prev => ({ ...prev, [result.id]: roundNum }));
                                }}
                                className="w-12"
                              >
                                {roundNum}
                              </Button>
                            ))}
                          </div>

                          {/* Shots for selected round */}
                          <div className="space-y-2">
                            {currentRoundAttempts.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center">No shots for this round</p>
                            ) : (
                              currentRoundAttempts.map((attempt: any, index: number) => (
                                <div
                                  key={index}
                                  className="p-3 rounded-lg border bg-muted/30"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium">
                                        {attempt.station}
                                      </p>
                                      {attempt.outcome && (
                                        <p className="text-sm text-muted-foreground">
                                          {formatOutcome(attempt.outcome)}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <p className="text-lg font-bold text-primary">
                                        {attempt.points ?? 0}
                                      </p>
                                      <p className="text-xs text-muted-foreground">points</p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                );
              }

              // Other drills: simple card (no dropdown)
              return (
                <div
                  key={result.id}
                  className="p-3 rounded-lg bg-secondary/30"
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
                        {result.total_points !== null && result.total_points !== undefined ? (
                          `${result.total_points} ${getScoreUnit(result.drill_title)}`
                        ) : (
                          'No score'
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(result.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </Accordion>
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
