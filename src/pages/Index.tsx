import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { LiveRoundCard } from "@/components/LiveRoundCard";

interface LiveGame {
  id: string;
  gameType: 'round' | 'match_play' | 'umbriago' | 'wolf' | 'copenhagen';
  ownerProfile: any;
  courseName: string;
  holesPlayed: number;
  totalHoles: number;
  status?: string;
  createdAt: string;
  isParticipant?: boolean;
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
  const [friendsOnCourse, setFriendsOnCourse] = useState<any[]>([]);
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
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

        // Fetch live games from friends (last 6 hours, not finished)
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        const allLiveGames: LiveGame[] = [];

        // Fetch live rounds
        const { data: liveRounds } = await supabase
          .from('rounds')
          .select('id, user_id, course_name, holes_played, created_at')
          .in('user_id', friendIds)
          .gte('created_at', sixHoursAgo)
          .order('created_at', { ascending: false });

        // Check which rounds user is a participant in
        const { data: userRoundParticipation } = await supabase
          .from('round_players')
          .select('round_id')
          .eq('user_id', user.id);
        
        const participatingRoundIds = new Set(userRoundParticipation?.map(rp => rp.round_id) || []);

        if (liveRounds) {
          for (const round of liveRounds) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, display_name, username, avatar_url')
              .eq('id', round.user_id)
              .single();

            // Count completed holes
            const { count } = await supabase
              .from('holes')
              .select('*', { count: 'exact', head: true })
              .eq('round_id', round.id);

            allLiveGames.push({
              id: round.id,
              gameType: 'round',
              ownerProfile: profile,
              courseName: round.course_name,
              holesPlayed: count || 0,
              totalHoles: round.holes_played,
              createdAt: round.created_at,
              isParticipant: participatingRoundIds.has(round.id),
            });
          }
        }

        // Fetch live match play games
        const { data: liveMatchPlay } = await supabase
          .from('match_play_games')
          .select('*')
          .in('user_id', friendIds)
          .eq('is_finished', false)
          .gte('created_at', sixHoursAgo);

        if (liveMatchPlay) {
          for (const game of liveMatchPlay) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, display_name, username, avatar_url')
              .eq('id', game.user_id)
              .single();

            const holesPlayed = game.holes_played - game.holes_remaining;
            const status = game.match_status === 0 ? 'All Square' : 
              game.match_status > 0 ? `${game.player_1} ${Math.abs(game.match_status)} Up` :
              `${game.player_2} ${Math.abs(game.match_status)} Up`;

            allLiveGames.push({
              id: game.id,
              gameType: 'match_play',
              ownerProfile: profile,
              courseName: game.course_name,
              holesPlayed,
              totalHoles: game.holes_played,
              status,
              createdAt: game.created_at,
            });
          }
        }

        // Sort by most recent
        allLiveGames.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setLiveGames(allLiveGames);
        
        // Set friends on course based on live games
        const activeProfiles = allLiveGames.map(g => g.ownerProfile).filter(Boolean);
        const uniqueProfiles = activeProfiles.filter((p, i, arr) => 
          arr.findIndex(x => x.id === p.id) === i
        );
        setFriendsOnCourse(uniqueProfiles);
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
        {/* Live Friends Games Section */}
        {liveGames.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Friends on the course</h2>
            {liveGames.map((game) => (
              <LiveRoundCard
                key={`${game.gameType}-${game.id}`}
                gameId={game.id}
                gameType={game.gameType}
                ownerProfile={game.ownerProfile}
                courseName={game.courseName}
                holesPlayed={game.holesPlayed}
                totalHoles={game.totalHoles}
                status={game.status}
                createdAt={game.createdAt}
                isParticipant={game.isParticipant}
              />
            ))}
          </div>
        )}

        {/* Post Box */}
        <PostBox profile={profile} userId={user.id} onPostCreated={loadUserData} />

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
                        <Avatar className="h-10 w-10 border border-border">
                          {activity.profile?.avatar_url ? (
                            <img src={activity.profile.avatar_url} alt={friendName} className="object-cover" />
                          ) : (
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {friendName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
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
