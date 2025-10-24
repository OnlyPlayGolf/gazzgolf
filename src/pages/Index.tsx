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
  const [stats, setStats] = useState({
    monthlyRounds: 0,
    monthlyDrills: 0,
    monthlyLevels: 0,
    scoringAverage: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLevelId, setCurrentLevelId] = useState<string | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [friendsAvatars, setFriendsAvatars] = useState<any[]>([]);

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

      // Get start and end of current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Load monthly stats
      const [roundsCount, drillsCount, levelsCount, roundsData] = await Promise.all([
        // Rounds this month
        supabase
          .from('rounds')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('date_played', monthStart)
          .lte('date_played', monthEnd),
        
        // Drills completed this month
        supabase
          .from('drill_results')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd + 'T23:59:59'),
        
        // Completed levels this month
        supabase
          .from('level_progress')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('completed', true)
          .gte('completed_at', monthStart)
          .lte('completed_at', monthEnd + 'T23:59:59'),

        // Get round summaries for scoring average
        supabase
          .from('round_summaries')
          .select('total_score, total_par')
          .eq('user_id', user.id)
          .gte('date_played', monthStart)
          .lte('date_played', monthEnd)
      ]);

      // Calculate scoring average
      let scoringAvg = 0;
      if (roundsData.data && roundsData.data.length > 0) {
        const totalScoreVsPar = roundsData.data.reduce((sum, round) => {
          return sum + ((round.total_score || 0) - (round.total_par || 0));
        }, 0);
        scoringAvg = totalScoreVsPar / roundsData.data.length;
      }

      setStats({
        monthlyRounds: roundsCount.count || 0,
        monthlyDrills: drillsCount.count || 0,
        monthlyLevels: levelsCount.count || 0,
        scoringAverage: scoringAvg
      });

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

        {/* Monthly Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/rounds', { state: { from: 'home' } })}>
            <CardContent className="p-4 text-center">
              <Calendar className="mx-auto mb-2 text-primary" size={24} />
              <p className="text-2xl font-bold text-foreground">{stats.monthlyRounds}</p>
              <p className="text-xs text-muted-foreground">Rounds This Month</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/categories', { state: { from: 'home' } })}>
            <CardContent className="p-4 text-center">
              <Target className="mx-auto mb-2 text-primary" size={24} />
              <p className="text-2xl font-bold text-foreground">{stats.monthlyDrills}</p>
              <p className="text-xs text-muted-foreground">Drills This Month</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/levels', { state: { from: 'home' } })}>
            <CardContent className="p-4 text-center">
              <Trophy className="mx-auto mb-2 text-primary" size={24} />
              <p className="text-2xl font-bold text-foreground">{stats.monthlyLevels}</p>
              <p className="text-xs text-muted-foreground">Levels This Month</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="mx-auto mb-2 text-primary" size={24} />
              <p className="text-2xl font-bold text-foreground">
                {stats.scoringAverage > 0 ? `+${stats.scoringAverage.toFixed(1)}` : 
                 stats.scoringAverage < 0 ? stats.scoringAverage.toFixed(1) : 
                 stats.scoringAverage === 0 && stats.monthlyRounds > 0 ? 'E' : '-'}
              </p>
              <p className="text-xs text-muted-foreground">Scoring Average</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Zap size={20} className="text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-between" 
              onClick={() => navigate('/rounds/setup', { state: { from: 'home' } })}
            >
              <span className="flex items-center gap-2">
                <Calendar size={16} />
                Start New Round
              </span>
              <ChevronRight size={16} />
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-between" 
              onClick={() => navigate('/drills/favourites', { state: { from: 'home' } })}
            >
              <span className="flex items-center gap-2">
                <Star size={16} />
                Favourite Drills
              </span>
              <ChevronRight size={16} />
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-between" 
              onClick={() => navigate('/profile?tab=leaderboards', { state: { from: 'home' } })}
            >
              <span className="flex items-center gap-2">
                <Trophy size={16} />
                View Leaderboards
              </span>
              <ChevronRight size={16} />
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-between" 
              onClick={() => {
                if (currentLevelId) {
                  const levels = getLevelsWithProgress();
                  const lvl = levels.find(l => l.id === currentLevelId);
                  if (lvl) {
                    navigate(`/levels/${lvl.difficulty.toLowerCase()}`, { state: { from: 'home' } });
                  } else {
                    navigate('/levels', { state: { from: 'home' } });
                  }
                } else {
                  navigate('/levels', { state: { from: 'home' } });
                }
              }}
            >
              <span className="flex items-center gap-2">
                <TrendingUp size={16} />
                Continue Levels
              </span>
              <ChevronRight size={16} />
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">Recent Rounds</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/rounds', { state: { from: 'home' } })}
                >
                  View All
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.map((round) => (
                <div 
                  key={round.id} 
                  className="p-3 border rounded-lg hover:border-primary transition-colors cursor-pointer"
                  onClick={() => navigate(`/rounds/${round.id}/summary`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{round.course_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(round.date_played).toLocaleDateString()} • {round.holes_played} holes
                      </p>
                    </div>
                    <ChevronRight size={20} className="text-muted-foreground" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
