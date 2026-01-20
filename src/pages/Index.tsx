import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Target, TrendingUp, Users, Calendar, ChevronRight, Trophy, Zap, Star, Menu as MenuIcon, User as UserIcon, MessageSquare, Settings, Info, Mail } from "lucide-react";
import onlyplayLogo from "@/assets/onlyplay-golf-logo.png";
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
import { buildGameUrl } from "@/hooks/useRoundNavigation";
import { GameMode } from "@/types/roundShell";
import { OngoingRoundsSection } from "@/components/OngoingRoundsSection";
import { useHomeProfile } from "@/hooks/useHomeProfile";
import { useFriendsOnCourse, FriendOnCourseData } from "@/hooks/useFriendsOnCourse";
import { useOngoingGames } from "@/hooks/useOngoingGames";
import { useKeyInsights } from "@/hooks/useKeyInsights";
import { useFeedPosts } from "@/hooks/useFeedPosts";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [currentLevelId, setCurrentLevelId] = useState<string | null>(null);
  const [postsToShow, setPostsToShow] = useState(10);

  // Progressive loading hooks - each section manages its own loading state
  const { profile, loading: profileLoading } = useHomeProfile(user);
  const { friendsOnCourse, loading: friendsOnCourseLoading, refresh: refreshFriendsOnCourse } = useFriendsOnCourse(user);
  const { ongoingGames, loading: ongoingGamesLoading, refresh: refreshOngoingGames } = useOngoingGames(user);
  const { performanceStats, loading: keyInsightsLoading } = useKeyInsights(user);
  const { friendsPosts, loading: feedPostsLoading, refresh: refreshFeedPosts } = useFeedPosts(user);

  const handleGameDeleted = () => {
    // Refresh both ongoing games and friends on course when a game is deleted
    // Using void to fire-and-forget since we don't need to await at the call site
    void Promise.all([refreshOngoingGames(), refreshFriendsOnCourse()]);
  };

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
      loadCurrentLevel();
    }
  }, [user?.id]);

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

  const handlePostCreated = () => {
    // Refresh feed posts when a new post is created
    refreshFeedPosts();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-4 space-y-2">
          {/* Welcome Header */}
          <div className="text-center">
            <img 
              src={onlyplayLogo} 
              alt="OnlyPlay Golf" 
              className="h-28 mx-auto"
            />
            <p className="text-primary text-base -mt-1">Train & Play. Like a game. Together.</p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 gap-2">
            <Card className="border-primary/20 hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/friends')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary text-primary-foreground rounded-full">
                    <Users size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Play With Friends</h3>
                    <p className="text-sm text-muted-foreground">Create groups, share rounds, and see who's on top.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/categories')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary text-primary-foreground rounded-full">
                    <Target size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Practice Like a Game</h3>
                    <p className="text-sm text-muted-foreground">Play drills, track scores, and climb the leaderboards.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/rounds')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary text-primary-foreground rounded-full">
                    <Calendar size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Play Rounds & Games</h3>
                    <p className="text-sm text-muted-foreground">Log rounds and compete in game modes with friends.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="mt-8 space-y-3">
            <Button onClick={() => navigate('/auth')} className="w-full" size="lg">
              Sign In to Get Started
            </Button>
            <Button 
              onClick={() => navigate('/auth', { state: { view: 'signup' } })} 
              variant="outline"
              className="w-full" 
              size="lg"
            >
              Create New Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      <div className="space-y-6 pt-20">
        {/* Friends On Course Section */}
        {friendsOnCourse.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground px-4">Friends On Course</h2>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-4 pb-2 px-4">
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
                          // Use standardized buildGameUrl with entryPoint for back button behavior
                          const getGameRoute = () => {
                            const mode = friend.gameType as GameMode;
                            return buildGameUrl(mode, friend.gameId, 'leaderboard', {
                              entryPoint: 'friends_on_course',
                              viewType: 'spectator'
                            });
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

        {/* Post Box - renders when profile is loaded */}
        {!profileLoading && user && (
          <PostBox profile={profile} userId={user.id} onPostCreated={handlePostCreated} />
        )}

        {/* Ongoing Rounds Section - renders when data is available */}
        {!ongoingGamesLoading && <OngoingRoundsSection ongoingGames={ongoingGames} onGameDeleted={handleGameDeleted} />}

        {/* Performance Snapshot - always renders (handles loading internally) */}
        <PerformanceSnapshot performanceStats={performanceStats} />

        {/* Friends Activity Feed - renders when data is available */}
        {!feedPostsLoading && user && friendsPosts.length > 0 && (
          <div className="space-y-4">
            {/* Posts */}
            {friendsPosts.slice(0, postsToShow).map((post) => (
              <FeedPost key={post.id} post={post} currentUserId={user.id} onPostDeleted={refreshFeedPosts} />
            ))}
            {/* View More Button */}
            {friendsPosts.length > postsToShow && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setPostsToShow(prev => prev + 10)}
                  className="w-full max-w-md"
                >
                  View More
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
