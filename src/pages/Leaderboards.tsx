import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Users, Target, ArrowLeft, TrendingUp } from "lucide-react";
import { FadeSlide } from "@/components/motion/FadeSlide";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';

const getDrillDisplayTitle = (title: string): string => {
  // Database names are now the display names, so return as-is
  return title;
};

// Map level category/difficulty to display name
const getLevelCategoryDisplayName = (category: string): string => {
  const lower = category.toLowerCase();
  if (lower === "beginner") return "First Timer";
  if (lower === "intermediate") return "Beginner";
  if (lower === "professional") return "Pro";
  // Capitalize first letter for other categories (Amateur, Tour)
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
};


interface LevelLeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  completed_levels: number;
  highest_level: number | null;
  category: string;
}

interface Drill {
  id: string;
  title: string;
  short_desc: string | null;
  lower_is_better: boolean;
}

interface DrillLeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  best_score: number;
  /** 21 Points only: wins, games, win_pct */
  wins?: number;
  games?: number;
  win_pct?: number;
}

const Leaderboards = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const drillParam = searchParams.get('drill');
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [favoriteGroupIds, setFavoriteGroupIds] = useState<string[]>([]);
  const [friendsLevelLeaderboard, setFriendsLevelLeaderboard] = useState<LevelLeaderboardEntry[]>([]);
  const [groupsLevelLeaderboard, setGroupsLevelLeaderboard] = useState<LevelLeaderboardEntry[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [selectedDrill, setSelectedDrill] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [friendsDrillLeaderboard, setFriendsDrillLeaderboard] = useState<DrillLeaderboardEntry[]>([]);
  const [mainTab, setMainTab] = useState<'levels' | 'drills'>(
    sectionParam === 'drills' ? 'drills' : 'levels'
  );

  // Normalize drill titles (map old/variant titles to canonical ones)
  const normalizeDrillTitle = (title: string): string => {
    const titleMap: Record<string, string> = {
      '18-hole PGA Tour Putting Test': 'PGA Tour 18-hole Test',
      "PGA Tour 18 Holes": 'PGA Tour 18-hole Test',
      "PGA Tour 18-hole Test": 'PGA Tour 18-hole Test',
      "TW's 9 Windows Test": "9 Windows Shot Shape Test",
      "9 Windows Shot Shape Test": "9 Windows Shot Shape Test",
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

  // Map categories to drill titles (order matches PuttingDrills.tsx)
  const drillCategories: Record<string, string[]> = {
    'Putting': ['Short Putt Test', 'PGA Tour 18-hole Test', 'Aggressive Putting 4-6m', "Up & Down Putts 6-10m", "Lag Putting Drill 8-20m"],
    'Short Game': ['8-Ball Circuit', '18 Up & Downs', 'Easy Chip Drill', '21 Points'],
    'Approach': ['Wedge Game 40-80m', 'Wedge Ladder 60-120m', 'Approach Control 130-180m', "9 Windows Shot Shape Test"],
    'Tee Shots': ['Shot Shape Master', 'Driver Control Drill'],
  };

  // Get unit label for drill
  const getDrillUnit = (drillTitle: string): string => {
    // Putts
    if (drillTitle === 'Aggressive Putting 4-6m' || drillTitle === 'PGA Tour 18-hole Test') {
      return 'putts';
    }
    // Shots
    if (drillTitle === '18 Up & Downs' || drillTitle === "Wedge Ladder 60-120m" || drillTitle === "9 Windows Shot Shape Test") {
      return 'shots';
    }
    // In a row
    if (drillTitle === 'Easy Chip Drill' || drillTitle === 'Short Putt Test') {
      return 'in a row';
    }
    // Points (21 Points, 8-Ball, etc.)
    if (drillTitle === '21 Points') {
      return 'points';
    }
    // Default
    return 'points';
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/auth');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadFavoriteGroups();
      loadLevelLeaderboards();
      loadDrills();
    }
  }, [user]);

  useEffect(() => {
    if (sectionParam === 'drills') {
      setMainTab('drills');
    } else {
      setMainTab('levels');
    }
  }, [sectionParam]);

  useEffect(() => {
    if (selectedDrill && user) {
      loadDrillLeaderboards();
    }
  }, [selectedDrill, user]);

  // Reset selectedDrill when category changes
  useEffect(() => {
    if (selectedCategory !== 'all') {
      const categoryDrills = drills.filter(d => drillCategories[selectedCategory]?.includes(d.title));
      if (categoryDrills.length > 0 && !categoryDrills.some(d => d.title === selectedDrill)) {
        setSelectedDrill(categoryDrills[0].title);
      }
    }
  }, [selectedCategory]);

  const loadFavoriteGroups = async () => {
    if (!user) return;

    try {
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('favourite_group_ids')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settingsData?.favourite_group_ids) {
        setFavoriteGroupIds(settingsData.favourite_group_ids);
      }
    } catch (error) {
      console.error('Error loading favorite groups:', error);
    }
  };

  const loadLevelLeaderboards = async () => {
    if (!user) return;

    try {
      // Disabled auto-sync from local storage to DB to avoid false positives

      const { data: friendsData, error: friendsError } = await supabase
        .rpc('friends_level_leaderboard');
      
      if (friendsError) {
        console.error('Error loading friends level leaderboard:', friendsError);
      } else {
        setFriendsLevelLeaderboard(friendsData || []);
      }

      const { data: groupsData, error: groupsError } = await supabase
        .rpc('favourite_groups_level_leaderboard');
      
      if (groupsError) {
        console.error('Error loading groups level leaderboard:', groupsError);
      } else {
        setGroupsLevelLeaderboard(groupsData || []);
      }
    } catch (error) {
      console.error('Error loading level leaderboards:', error);
    }
  };

  const loadDrills = async () => {
    try {
      const { data, error } = await supabase
        .from('drills')
        .select('id, title, short_desc, lower_is_better')
        .order('title');

      if (error) {
        console.error('Error loading drills:', error);
      } else {
        // Deduplicate by normalized title to remove duplicates like "PGA Tour 18 Holes" vs "PGA Tour 18-hole Test"
        const drillsByNormalizedTitle = new Map<string, Drill>();
        
        // First pass: collect all drills by normalized title
        (data || []).forEach(drill => {
          const normalizedTitle = normalizeDrillTitle(drill.title);
          if (!drillsByNormalizedTitle.has(normalizedTitle)) {
            drillsByNormalizedTitle.set(normalizedTitle, drill);
          }
        });
        
        // Second pass: prefer canonical titles (titles that match their normalized form)
        (data || []).forEach(drill => {
          const normalizedTitle = normalizeDrillTitle(drill.title);
          const existing = drillsByNormalizedTitle.get(normalizedTitle);
          // If the current drill's title matches the normalized title exactly, prefer it
          if (existing && drill.title === normalizedTitle && existing.title !== normalizedTitle) {
            drillsByNormalizedTitle.set(normalizedTitle, drill);
          }
        });
        
        let uniqueDrills = Array.from(drillsByNormalizedTitle.values());
        // Ensure "21 Points" appears in the list even if not yet in DB
        if (!uniqueDrills.some(d => normalizeDrillTitle(d.title) === '21 Points')) {
          uniqueDrills = [...uniqueDrills, { id: 'synthetic-21-points', title: '21 Points', short_desc: null, lower_is_better: false }];
        }
        setDrills(uniqueDrills);
        
        // If drill param is provided, select that drill (use canonical title so it matches an option)
        const matchParam = uniqueDrills.find(d => d.title === drillParam || normalizeDrillTitle(d.title) === drillParam);
        if (drillParam && matchParam) {
          setSelectedDrill(matchParam.title);
          // Set category based on drill
          for (const [category, titles] of Object.entries(drillCategories)) {
            if (titles.includes(matchParam.title) || titles.includes(normalizeDrillTitle(matchParam.title))) {
              setSelectedCategory(category);
              break;
            }
          }
        } else if (uniqueDrills.length > 0) {
          // Default to "8-Ball Circuit" if available, otherwise use first drill
          const defaultDrill = uniqueDrills.find(d => d.title === '8-Ball Circuit') || uniqueDrills[0];
          setSelectedDrill(defaultDrill.title);
        }
      }
    } catch (error) {
      console.error('Error loading drills:', error);
    }
  };

  const loadDrillLeaderboards = async () => {
    if (!selectedDrill || !user) return;

    const is21Points = normalizeDrillTitle(selectedDrill) === '21 Points';

    try {
      if (is21Points) {
        // 21 Points: wins / games / win% from attempts_json, friends only
        const { data: pairs } = await supabase
          .from('friends_pairs')
          .select('a, b')
          .or(`a.eq.${user.id},b.eq.${user.id}`);
        const friendIds: string[] = pairs?.map((p: { a: string; b: string }) => (p.a === user.id ? p.b : p.a)) ?? [];
        const { data: drillRows } = await supabase
          .from('drills')
          .select('id')
          .eq('title', '21 Points')
          .limit(1);
        if (!drillRows?.length) {
          setFriendsDrillLeaderboard([]);
          return;
        }
        const { data: resultRows } = await supabase
          .from('drill_results')
          .select('attempts_json')
          .eq('drill_id', drillRows[0].id);
        const byOdId = new Map<string, { wins: number; games: number }>();
        const seenGameIds = new Set<string>();
        for (const row of resultRows || []) {
          const aj = (row as { attempts_json?: { gameId?: string; players?: { odId: string }[]; winnerOdId?: string } }).attempts_json;
          if (!aj?.players) continue;
          if (aj.gameId) {
            if (seenGameIds.has(aj.gameId)) continue;
            seenGameIds.add(aj.gameId);
          }
          const winnerOdId = aj.winnerOdId;
          for (const p of aj.players) {
            if (p.odId?.startsWith?.('temp_')) continue;
            const cur = byOdId.get(p.odId) ?? { wins: 0, games: 0 };
            cur.games += 1;
            if (p.odId === winnerOdId) cur.wins += 1;
            byOdId.set(p.odId, cur);
          }
        }
        // Include current user so they see their own 21 Points scores
        const idsWithStats = [user.id, ...friendIds].filter((id) => byOdId.has(id));
        if (idsWithStats.length === 0) {
          setFriendsDrillLeaderboard([]);
          return;
        }
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', idsWithStats);
        const list: DrillLeaderboardEntry[] = (profiles || []).map((p: { id: string; display_name: string | null; username: string | null; avatar_url: string | null }) => {
          const s = byOdId.get(p.id)!;
          const winPct = s.games > 0 ? (s.wins / s.games) * 100 : 0;
          return {
            user_id: p.id,
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url,
            best_score: winPct,
            wins: s.wins,
            games: s.games,
            win_pct: winPct,
          };
        });
        list.sort((a, b) => (b.win_pct ?? 0) - (a.win_pct ?? 0));
        setFriendsDrillLeaderboard(list);
        return;
      }

      const { data: friendsData, error: friendsError } = await supabase
        .rpc('friends_leaderboard_for_drill_by_title', { p_drill_title: selectedDrill });

      if (friendsError) {
        console.error('Error loading friends drill leaderboard:', friendsError);
        setFriendsDrillLeaderboard([]);
      } else {
        setFriendsDrillLeaderboard(friendsData || []);
      }
    } catch (error) {
      console.error('Error loading drill leaderboards:', error);
    }
  };

  if (!user) {
    return null;
  }

  // Filter drills based on selected category
  const filteredDrills = selectedCategory === 'all' 
    ? drills 
    : drills.filter(d => drillCategories[selectedCategory]?.includes(d.title));

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/practice')}
            className="h-10 w-10"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Leaderboards</h1>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'levels' | 'drills')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="levels">
              <TrendingUp size={16} className="mr-2" />
              Levels
            </TabsTrigger>
            <TabsTrigger value="drills">
              <Target size={16} className="mr-2" />
              Drills
            </TabsTrigger>
          </TabsList>

          <TabsContent value="levels" className="space-y-6">
            {/* Level Leaderboards */}
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20} />
                Level Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Friends Level Leaderboard */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users size={16} />
                  Friends
                </h3>
                {friendsLevelLeaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {friendsLevelLeaderboard.map((entry, index) => {
                      return (
                        <div 
                          key={entry.user_id} 
                          className="flex items-center justify-between p-3 rounded-md bg-secondary/50"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="w-8 text-center">
                              {index + 1}
                            </Badge>
                            <ProfilePhoto
                              src={entry.avatar_url}
                              alt={entry.display_name || entry.username || "User"}
                              fallback={entry.display_name || entry.username || "?"}
                              size="sm"
                            />
                            <div>
                              <p className="font-medium text-foreground text-sm">
                                {entry.display_name || entry.username || 'Unknown'}
                              </p>
                              {entry.highest_level && (
                                <p className="text-xs text-muted-foreground">
                                  Level {entry.highest_level} • {getLevelCategoryDisplayName(entry.category)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">
                              {entry.completed_levels} level{entry.completed_levels !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-muted-foreground">completed</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    Complete levels to see your progress!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="drills" className="space-y-6">
            {/* Drill Leaderboards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target size={20} />
                  Drills Leaderboards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.keys(drillCategories).map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Select Drill</Label>
                  <Select value={selectedDrill} onValueChange={setSelectedDrill}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a drill..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(drillCategories).map(([category, titles]) => {
                        // Check both normalized and original titles
                        const categoryDrills = filteredDrills.filter(d => {
                          const normalized = normalizeDrillTitle(d.title);
                          return titles.includes(d.title) || titles.includes(normalized);
                        });
                        if (categoryDrills.length === 0) return null;
                        // Sort drills to match the order in drillCategories array
                        const sortedDrills = categoryDrills.sort((a, b) => {
                          const normalizedA = normalizeDrillTitle(a.title);
                          const normalizedB = normalizeDrillTitle(b.title);
                          const indexA = titles.indexOf(normalizedA) !== -1 ? titles.indexOf(normalizedA) : titles.indexOf(a.title);
                          const indexB = titles.indexOf(normalizedB) !== -1 ? titles.indexOf(normalizedB) : titles.indexOf(b.title);
                          return indexA - indexB;
                        });
                        return (
                          <SelectGroup key={category}>
                            <SelectLabel>{category}</SelectLabel>
                            {sortedDrills.map((drill) => {
                              const displayTitle = normalizeDrillTitle(drill.title);
                              return (
                                <SelectItem key={drill.id} value={drill.title}>
                                  {getDrillDisplayTitle(displayTitle)}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedDrill && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Users size={16} />
                      Friends
                    </h3>
                    <FadeSlide>
                      {friendsDrillLeaderboard.length > 0 ? (
                        <div className="space-y-2">
                          {friendsDrillLeaderboard.map((entry, index) => {
                            const is21PointsEntry = normalizeDrillTitle(selectedDrill) === '21 Points' && entry.wins != null;
                            return (
                              <div 
                                key={entry.user_id} 
                                className="flex items-center justify-between p-3 rounded-md bg-secondary/50"
                              >
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="w-8 text-center">
                                    {index + 1}
                                  </Badge>
                                  <ProfilePhoto
                                    src={entry.avatar_url}
                                    alt={entry.display_name || entry.username || "User"}
                                    fallback={entry.display_name || entry.username || "?"}
                                    size="sm"
                                  />
                                  <div>
                                    <p className="font-medium text-foreground text-sm">
                                      {entry.display_name || entry.username || 'Unknown'}
                                    </p>
                                    {is21PointsEntry && (
                                      <p className="text-xs text-muted-foreground">
                                        {entry.wins}W – {entry.games}G
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  {is21PointsEntry ? (
                                    <>
                                      <p className="font-semibold text-foreground">
                                        {entry.win_pct != null ? Math.round(entry.win_pct) : 0}%
                                      </p>
                                      <p className="text-xs text-muted-foreground">win rate</p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-semibold text-foreground">
                                        {entry.best_score}
                                      </p>
                                      <p className="text-xs text-muted-foreground">{getDrillUnit(selectedDrill)}</p>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm text-center py-4">
                          Complete this drill to see your score!
                        </p>
                      )}
                    </FadeSlide>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Leaderboards;