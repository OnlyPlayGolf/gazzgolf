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

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLevelId, setCurrentLevelId] = useState<string | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [friendsAvatars, setFriendsAvatars] = useState<any[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<any[]>([]);

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

      // Load friends' recent activity
      if (friendsData && friendsData.length > 0) {
        const friendIds = friendsData.map(f => 
          f.user_a === user.id ? f.user_b : f.user_a
        );

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
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-primary">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="object-cover" />
                ) : (
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : 
                     profile?.username ? profile.username.charAt(0).toUpperCase() : "?"}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">
                  {profile?.display_name || profile?.username || 'Golfer'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {profile?.handicap ? `HCP ${profile.handicap}` : 'No handicap set'} 
                  {profile?.country && ` | ${profile.country}`}
                </p>
                {profile?.home_club && (
                  <p className="text-sm text-muted-foreground">{profile.home_club}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Friends Section */}
        <Card 
          className="cursor-pointer hover:border-primary transition-colors" 
          onClick={() => navigate('/friends', { state: { from: 'home' } })}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {friendsAvatars.length > 0 ? (
                    friendsAvatars.map((friend, index) => (
                      <Avatar key={friend.id} className="h-12 w-12 border-2 border-background">
                        {friend.avatar_url ? (
                          <img src={friend.avatar_url} alt={friend.display_name || friend.username} className="object-cover" />
                        ) : (
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {friend.display_name ? friend.display_name.charAt(0).toUpperCase() : 
                             friend.username ? friend.username.charAt(0).toUpperCase() : "?"}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    ))
                  ) : (
                    <Avatar className="h-12 w-12 border-2 border-background">
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        <Users size={20} />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{friendsCount}</p>
                  <p className="text-sm text-muted-foreground">Friends</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Friends Activity Feed */}
        {friendsActivity.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Friends Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
    </div>
  );
};

export default Index;
