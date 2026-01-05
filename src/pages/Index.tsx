import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Target, TrendingUp, Users, Calendar, ChevronRight, Trophy, Zap, Star, Menu as MenuIcon, User as UserIcon, MessageSquare, Settings, Info, Mail } from "lucide-react";
import { getLevelsWithProgress } from "@/utils/levelsManager";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TopNavBar } from "@/components/TopNavBar";
import { PostBox } from "@/components/PostBox";
import { FeedPost } from "@/components/FeedPost";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PerformanceSnapshot } from "@/components/PerformanceSnapshot";

type GameType = 'round' | 'copenhagen' | 'skins' | 'best_ball' | 'scramble' | 'wolf' | 'umbriago' | 'match_play';

interface FriendOnCourseData {
  friendId: string;
  friendName: string;
  friendAvatar: string | null;
  gameId: string;
  gameType: GameType;
  courseName: string;
  createdAt: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLevelId, setCurrentLevelId] = useState<string | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [friendsAvatars, setFriendsAvatars] = useState<any[]>([]);
  const [friendsOnCourse, setFriendsOnCourse] = useState<FriendOnCourseData[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<any[]>([]);
  const [friendsPosts, setFriendsPosts] = useState<any[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadUserData();
      loadCurrentLevel();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadCurrentLevel = () => {
    const levels = getLevelsWithProgress();
    // Pick the most recently completed level (by completedAt)
    const completedLevels = levels
      .filter(l => l.completed && typeof l.completedAt === 'number')
      .sort((a, b) => (b.completedAt as number) - (a.completedAt as number));

    if (completedLevels.length > 0) {
      setCurrentLevelId(completedLevels[0].id);
    } else if (levels.length > 0) {
      // If none completed yet, use the very first level
      setCurrentLevelId(levels[0].id);
    }
  };

  const loadUserData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setProfile(profileData);

      // Load friends count and avatars
      const { data: friendsData } = await supabase
        .from('friendships')
        .select('user_a, user_b, requester, addressee')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('status', 'accepted');

      if (friendsData && friendsData.length > 0) {
        setFriendsCount(friendsData.length);
        
        // Get friend user IDs
        const friendIds = friendsData.map(f => 
          f.user_a === user.id ? f.user_b : f.user_a
        ).slice(0, 3); // Only get first 3 for avatars

        // Load friend profiles
        const { data: friendProfiles } = await supabase
          .from('profiles')
          .select('id, avatar_url, display_name, username')
          .in('id', friendIds);

        setFriendsAvatars(friendProfiles || []);
      } else {
        setFriendsCount(0);
        setFriendsAvatars([]);
      }

      // Load friends' recent activity and posts
      if (friendsData && friendsData.length > 0) {
        const friendIds = friendsData.map(f => 
          f.user_a === user.id ? f.user_b : f.user_a
        );

        // Get friends' posts (and own posts)
        const { data: posts } = await supabase
          .from('posts')
          .select(`
            *,
            profile:user_id (
              display_name,
              username,
              avatar_url
            )
          `)
          .or(`user_id.in.(${[user.id, ...friendIds].join(',')}),user_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (posts) {
          setFriendsPosts(posts);
        }

        // Get friends' recent rounds
        const { data: friendRounds } = await supabase
          .from('rounds')
          .select('id, user_id, course_name, date_played, created_at')
          .in('user_id', friendIds)
          .order('created_at', { ascending: false })
          .limit(10);

        if (friendRounds) {
          // Get friend profiles and round summaries
          const activityWithDetails = await Promise.all(
            friendRounds.map(async (round) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('display_name, username, avatar_url')
                .eq('id', round.user_id)
                .single();

              const { data: summary } = await supabase
                .from('round_summaries')
                .select('total_score, total_par')
                .eq('round_id', round.id)
                .maybeSingle();

              return {
                ...round,
                profile,
                summary
              };
            })
          );

          setFriendsActivity(activityWithDetails);
        }

        // Fetch friends' games from last 12 hours for "Friends on Course"
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const friendsOnCourseData: FriendOnCourseData[] = [];

        // Fetch all game types from friends in parallel
        const [
          { data: friendRoundsLive },
          { data: friendCopenhagen },
          { data: friendSkins },
          { data: friendBestBall },
          { data: friendScramble },
          { data: friendWolf },
          { data: friendUmbriago },
          { data: friendMatchPlay }
        ] = await Promise.all([
          supabase.from('rounds').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('copenhagen_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('skins_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, players').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('best_ball_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, team_a_players, team_b_players').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('scramble_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, teams').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('wolf_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('umbriago_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('match_play_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
        ]);

        // Collect all games with their owner user IDs
        const allGames: { gameId: string; gameType: GameType; userId: string; courseName: string; createdAt: string }[] = [];

        // Process rounds
        for (const round of friendRoundsLive || []) {
          allGames.push({
            gameId: round.id,
            gameType: 'round',
            userId: round.user_id,
            courseName: round.course_name,
            createdAt: round.created_at,
          });
        }

        // Process Copenhagen games
        for (const game of friendCopenhagen || []) {
          allGames.push({
            gameId: game.id,
            gameType: 'copenhagen',
            userId: game.user_id,
            courseName: game.course_name,
            createdAt: game.created_at,
          });
        }

        // Process Skins games
        for (const game of friendSkins || []) {
          allGames.push({
            gameId: game.id,
            gameType: 'skins',
            userId: game.user_id,
            courseName: game.course_name,
            createdAt: game.created_at,
          });
        }

        // Process Best Ball games
        for (const game of friendBestBall || []) {
          allGames.push({
            gameId: game.id,
            gameType: 'best_ball',
            userId: game.user_id,
            courseName: game.course_name,
            createdAt: game.created_at,
          });
        }

        // Process Scramble games
        for (const game of friendScramble || []) {
          allGames.push({
            gameId: game.id,
            gameType: 'scramble',
            userId: game.user_id,
            courseName: game.course_name,
            createdAt: game.created_at,
          });
        }

        // Process Wolf games
        for (const game of friendWolf || []) {
          allGames.push({
            gameId: game.id,
            gameType: 'wolf',
            userId: game.user_id,
            courseName: game.course_name,
            createdAt: game.created_at,
          });
        }

        // Process Umbriago games
        for (const game of friendUmbriago || []) {
          allGames.push({
            gameId: game.id,
            gameType: 'umbriago',
            userId: game.user_id,
            courseName: game.course_name,
            createdAt: game.created_at,
          });
        }

        // Process Match Play games
        for (const game of friendMatchPlay || []) {
          allGames.push({
            gameId: game.id,
            gameType: 'match_play',
            userId: game.user_id,
            courseName: game.course_name,
            createdAt: game.created_at,
          });
        }

        // Collect unique friend user IDs on course
        const uniqueFriendIds = [...new Set(allGames.map(g => g.userId))];

        // Fetch profiles for all friends on course
        if (uniqueFriendIds.length > 0) {
          const { data: onCourseProfiles } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', uniqueFriendIds);

          const profileMap = new Map(
            (onCourseProfiles || []).map(p => [p.id, p])
          );

          // Create FriendOnCourseData entries
          for (const game of allGames) {
            const profile = profileMap.get(game.userId);
            const displayName = profile?.display_name || profile?.username || 'Friend';
            const firstName = displayName.split(' ')[0];
            
            friendsOnCourseData.push({
              friendId: game.userId,
              friendName: firstName,
              friendAvatar: profile?.avatar_url || null,
              gameId: game.gameId,
              gameType: game.gameType,
              courseName: game.courseName,
              createdAt: game.createdAt,
            });
          }
        }

        // Sort by most recently started (createdAt desc)
        friendsOnCourseData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setFriendsOnCourse(friendsOnCourseData);
      }

      // Load recent activity (rounds)
      const { data: recentRounds } = await supabase
        .from('rounds')
        .select('*')
        .eq('user_id', user.id)
        .order('date_played', { ascending: false })
        .limit(3);

      setRecentActivity(recentRounds || []);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-4 space-y-6">
          {/* Welcome Header */}
          <div className="text-center pt-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to Golf Training</h1>
            <p className="text-muted-foreground">Track your progress, complete drills, and improve your game</p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 gap-4 mt-8">
            <Card className="border-primary/20 hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/categories')}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Target size={24} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Practice Drills</h3>
                    <p className="text-sm text-muted-foreground">Improve your skills with targeted drills</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/levels')}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <TrendingUp size={24} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Level Challenges</h3>
                    <p className="text-sm text-muted-foreground">Complete levels and track your progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/rounds')}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Calendar size={24} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Round Tracker</h3>
                    <p className="text-sm text-muted-foreground">Log and analyze your golf rounds</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="mt-8">
            <Button onClick={() => navigate('/auth')} className="w-full" size="lg">
              Sign In to Get Started
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      <div className="p-4 space-y-6 pt-20">
        {/* Friends On Course Section */}
        {friendsOnCourse.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Friends On Course</h2>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-4 pb-2">
                {(() => {
                  // Group friends by gameId + gameType to show friends in the same round together
                  const gameGroups = new Map<string, FriendOnCourseData[]>();
                  friendsOnCourse.forEach(friend => {
                    const key = `${friend.gameType}-${friend.gameId}`;
                    if (!gameGroups.has(key)) {
                      gameGroups.set(key, []);
                    }
                    gameGroups.get(key)!.push(friend);
                  });

                  // Convert to array and sort by most recent
                  const sortedGroups = Array.from(gameGroups.entries()).sort((a, b) => {
                    const aDate = new Date(a[1][0].createdAt).getTime();
                    const bDate = new Date(b[1][0].createdAt).getTime();
                    return bDate - aDate;
                  });

                  return sortedGroups.map(([groupKey, friends]) => {
                    const isGroup = friends.length > 1;
                    
                    return (
                      <div 
                        key={groupKey}
                        className={`flex ${isGroup ? 'bg-muted/50 rounded-xl px-2 py-2 gap-1 border border-border/50' : ''}`}
                      >
                        {friends.map((friend, idx) => {
                          // Determine the route based on game type
                          const getGameRoute = () => {
                            switch (friend.gameType) {
                              case 'round': return `/rounds/${friend.gameId}/leaderboard`;
                              case 'match_play': return `/match-play/${friend.gameId}/leaderboard`;
                              case 'best_ball': return `/best-ball/${friend.gameId}/leaderboard`;
                              case 'copenhagen': return `/copenhagen/${friend.gameId}/leaderboard`;
                              case 'scramble': return `/scramble/${friend.gameId}/leaderboard`;
                              case 'skins': return `/skins/${friend.gameId}/leaderboard`;
                              case 'wolf': return `/wolf/${friend.gameId}/leaderboard`;
                              case 'umbriago': return `/umbriago/${friend.gameId}/leaderboard`;
                              default: return `/rounds/${friend.gameId}/leaderboard`;
                            }
                          };

                          return (
                            <div 
                              key={`${friend.friendId}-${idx}`}
                              className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => navigate(getGameRoute())}
                              style={{ width: '64px' }}
                            >
                              <div className={`relative ${isGroup && idx > 0 ? '-ml-3' : ''}`}>
                                <ProfilePhoto
                                  src={friend.friendAvatar}
                                  alt={friend.friendName}
                                  fallback={friend.friendName}
                                  size="lg"
                                  className="border-2 border-background shadow-md h-14 w-14"
                                />
                                {/* Green "playing" indicator */}
                                <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-background" />
                              </div>
                              <span 
                                className="text-xs text-muted-foreground mt-1 truncate text-center"
                                style={{ maxWidth: '56px' }}
                              >
                                {friend.friendName}
                              </span>
                            </div>
                          );
                        })}
                        {isGroup && (
                          <div className="flex items-center pl-1">
                            <span className="text-[10px] text-muted-foreground/70 rotate-90 whitespace-nowrap">
                              same round
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}

        {/* Post Box */}
        <PostBox profile={profile} userId={user.id} onPostCreated={loadUserData} />

        {/* Performance Snapshot */}
        <PerformanceSnapshot userId={user.id} />

        {/* Friends Activity Feed */}
        {(friendsPosts.length > 0 || friendsActivity.length > 0) && (
          <div className="space-y-4">
            
            {/* Posts */}
            {friendsPosts.map((post) => (
              <FeedPost key={post.id} post={post} currentUserId={user.id} onPostDeleted={loadUserData} />
            ))}

            {/* Round Activity */}
            {friendsActivity.length > 0 && (
              <Card>
                <CardContent className="space-y-3 pt-6">
                  {friendsActivity.map((activity) => {
                    const friendName = activity.profile?.display_name || activity.profile?.username || 'A friend';
                    const scoreDiff = activity.summary?.total_score && activity.summary?.total_par 
                      ? activity.summary.total_score - activity.summary.total_par 
                      : null;
                    const scoreDisplay = scoreDiff === null 
                      ? '' 
                      : scoreDiff === 0 
                      ? ' (E)' 
                      : scoreDiff > 0 
                      ? ` (+${scoreDiff})` 
                      : ` (${scoreDiff})`;

                    return (
                      <div
                        key={activity.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/rounds/${activity.id}/summary`)}
                      >
                        <ProfilePhoto
                          src={activity.profile?.avatar_url}
                          alt={friendName}
                          fallback={friendName}
                          size="md"
                          className="border border-border"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            <span className="font-semibold">{friendName}</span> completed a round
                            {scoreDisplay && <span className="text-primary font-semibold">{scoreDisplay}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.course_name} • {new Date(activity.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
