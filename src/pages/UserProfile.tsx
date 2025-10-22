import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Camera, QrCode, Users, Plus, ChevronRight } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { formatDistanceToNow } from "date-fns";

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  handicap: string | null;
  home_club: string | null;
  country: string | null;
}

interface RecentRound {
  id: string;
  course_name: string;
  date_played: string;
  holes_played: number;
}

interface RoundSummary {
  round_id: string;
  total_score: number;
  total_par: number;
  score_vs_par: number;
}

export default function UserProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [roundsCount, setRoundsCount] = useState(0);
  const [recentRounds, setRecentRounds] = useState<Array<RecentRound & { summary: RoundSummary | null }>>([]);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

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
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
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

      // Load friends count
      const { count: friendsCount } = await supabase
        .from('friends_pairs')
        .select('a, b', { count: 'exact', head: true })
        .or(`a.eq.${user.id},b.eq.${user.id}`);

      setFriendsCount(friendsCount || 0);

      // Load rounds count
      const { count: roundsCount } = await supabase
        .from('rounds')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setRoundsCount(roundsCount || 0);

      // Load recent rounds with summaries
      const { data: roundsData } = await supabase
        .from('rounds')
        .select('id, course_name, date_played, holes_played')
        .eq('user_id', user.id)
        .order('date_played', { ascending: false })
        .limit(3);

      if (roundsData) {
        // Get summaries for these rounds
        const roundsWithSummaries = await Promise.all(
          roundsData.map(async (round) => {
            const { data: summary } = await supabase
              .from('round_summaries')
              .select('round_id, total_score, total_par, score_vs_par')
              .eq('round_id', round.id)
              .maybeSingle();

            return {
              ...round,
              summary
            };
          })
        );

        setRecentRounds(roundsWithSummaries);

        // Calculate average score
        const validScores = roundsWithSummaries
          .filter(r => r.summary?.score_vs_par !== null && r.summary?.score_vs_par !== undefined)
          .map(r => r.summary!.score_vs_par);

        if (validScores.length > 0) {
          const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
          setAverageScore(avg);
        }
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      
      {/* Header with Background and Profile Photo */}
      <div className="relative h-48 bg-gradient-to-br from-green-600 to-green-800">
        {/* Profile Photo Circle */}
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-background">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="object-cover" />
              ) : (
                <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                  {profile.display_name ? profile.display_name.charAt(0).toUpperCase() :
                   profile.username ? profile.username.charAt(0).toUpperCase() : "?"}
                </AvatarFallback>
              )}
            </Avatar>
            <Button
              size="icon"
              variant="secondary"
              className="absolute bottom-0 right-0 rounded-full h-10 w-10"
              onClick={() => navigate('/profile-settings')}
            >
              <Camera size={18} />
            </Button>
          </div>
        </div>

        {/* QR Code Button */}
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full"
        >
          <QrCode size={24} />
        </Button>
      </div>

      <div className="pt-20 px-4 space-y-6">
        {/* User Info */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {profile.display_name || profile.username || 'Golfer'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {profile.handicap && `HCP ${profile.handicap}`}
            {profile.home_club && ` | ${profile.home_club}`}
            {profile.country && ` | ${profile.country}`}
          </p>
        </div>

        {/* Friends Section */}
        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate('/friends')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="text-primary" size={24} />
              <div>
                <p className="font-semibold text-foreground text-lg">{friendsCount}</p>
                <p className="text-sm text-muted-foreground">Vänner</p>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground" size={20} />
          </CardContent>
        </Card>

        {/* Recent Rounds Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-foreground">Rundor ({roundsCount})</h2>
            <Button
              variant="link"
              className="text-success"
              onClick={() => navigate('/rounds')}
            >
              visa alla
            </Button>
          </div>

          <div className="space-y-3">
            {recentRounds.length > 0 ? (
              recentRounds.map((round) => (
                <Card
                  key={round.id}
                  className="border-2 border-success/30 bg-success/5 cursor-pointer hover:border-success transition-colors"
                  onClick={() => navigate(`/rounds/${round.id}/summary`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          Game {new Date(round.date_played).toISOString().split('T')[0]}
                        </h3>
                        <p className="text-sm text-muted-foreground">{round.course_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(round.date_played).toISOString().split('T')[0]}
                        </p>
                      </div>
                      {round.summary?.score_vs_par !== null && round.summary?.score_vs_par !== undefined && (
                        <div className="text-3xl font-bold text-foreground">
                          {round.summary.score_vs_par > 0 ? '+' : ''}{round.summary.score_vs_par}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No rounds yet</p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => navigate('/rounds/setup')}
                  >
                    Start Your First Round
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Statistics Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-foreground">Statistik</h2>
            <Button
              variant="link"
              className="text-success"
              onClick={() => navigate('/rounds')}
            >
              Visa alla
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <Button
                    size="icon"
                    className="rounded-full h-12 w-12 mb-2 bg-success hover:bg-success/90"
                  >
                    <Plus size={24} />
                  </Button>
                  <p className="text-xs text-muted-foreground">Mål</p>
                </div>

                <div className="text-center">
                  <div className="text-4xl font-bold text-foreground mb-2">
                    {averageScore !== null ? averageScore.toFixed(1) : '--'}
                  </div>
                  <p className="text-xs text-muted-foreground">Översikt</p>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground mb-2">
                    {roundsCount}
                  </div>
                  <p className="text-xs text-muted-foreground">Rundor</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate('/levels')}
          >
            <div className="text-2xl">🎯</div>
            <span className="text-sm">Levels</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate('/categories')}
          >
            <div className="text-2xl">⛳</div>
            <span className="text-sm">Drills</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate('/groups')}
          >
            <Users className="text-primary" size={24} />
            <span className="text-sm">Groups</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate('/leaderboards')}
          >
            <div className="text-2xl">🏆</div>
            <span className="text-sm">Leaderboards</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
