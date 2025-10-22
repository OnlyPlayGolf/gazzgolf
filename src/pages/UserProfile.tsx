import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, QrCode, Settings, Users, Target, TrendingUp, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  country: string | null;
  handicap: string | null;
  home_club: string | null;
}

interface RecentRound {
  id: string;
  course_name: string;
  date: string;
  score: number;
}

export default function UserProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [roundsCount, setRoundsCount] = useState(0);
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [averageScore, setAverageScore] = useState<number | null>(null);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    // Load profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(profileData);

    // Load friends count
    const { count: friendsCount } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .or(`requester.eq.${user.id},addressee.eq.${user.id}`)
      .eq('status', 'accepted');

    setFriendsCount(friendsCount || 0);

    // Load rounds count
    const { count: roundsCount } = await supabase
      .from('rounds')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    setRoundsCount(roundsCount || 0);
    
    // Load recent rounds with scores from holes
    const { data: roundsData } = await supabase
      .from('rounds')
      .select('id, course_name, date_played')
      .eq('user_id', user.id)
      .order('date_played', { ascending: false })
      .limit(3);

    if (roundsData && roundsData.length > 0) {
      // Get holes data for each round to calculate scores
      const roundsWithScores = await Promise.all(
        roundsData.map(async (round) => {
          const { data: holesData } = await supabase
            .from('holes')
            .select('score, par')
            .eq('round_id', round.id);

          const totalScore = holesData?.reduce((sum, hole) => sum + hole.score, 0) || 0;
          const totalPar = holesData?.reduce((sum, hole) => sum + hole.par, 0) || 0;
          const scoreToPar = totalScore - totalPar;

          return {
            id: round.id,
            course_name: round.course_name || 'Unknown Course',
            date: round.date_played,
            score: scoreToPar
          };
        })
      );

      setRecentRounds(roundsWithScores);

      // Calculate average score to par
      const scores = roundsWithScores.map(r => r.score);
      if (scores.length > 0) {
        const total = scores.reduce((sum, score) => sum + score, 0);
        setAverageScore(Math.round((total / scores.length) * 10) / 10);
      }
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      toast({
        title: "Success",
        description: "Profile photo updated successfully",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Error",
        description: "Failed to upload photo",
        variant: "destructive",
      });
    }
  };

  if (!profile) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  const displayName = profile.display_name || profile.username || 'User';
  const handicapValue = profile.handicap ? parseFloat(profile.handicap) : null;
  const handicapDisplay = handicapValue !== null 
    ? `HCP ${handicapValue > 0 ? '+' : ''}${handicapValue}`
    : 'HCP Not Set';

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with gradient background */}
      <div className="relative h-48 bg-gradient-to-br from-[hsl(120,50%,30%)] to-[hsl(120,50%,20%)]">
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => navigate('/profile-settings')}
          >
            <Settings size={20} />
          </Button>
        </div>

        {/* Profile photo */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-background">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 h-10 w-10 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
              <Camera size={20} className="text-primary-foreground" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="mt-20 px-4">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-foreground mb-2">{displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {handicapDisplay}
            {profile.home_club && ` | ${profile.home_club}`}
            {profile.country && ` | ${profile.country}`}
          </p>
        </div>

        {/* Friends and QR code */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <button
            onClick={() => navigate('/friends')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex -space-x-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 border-2 border-background" />
              <div className="h-8 w-8 rounded-full bg-primary/40 border-2 border-background" />
              <div className="h-8 w-8 rounded-full bg-primary/60 border-2 border-background" />
            </div>
            <span className="text-lg font-semibold text-foreground">{friendsCount}</span>
            <span className="text-sm text-muted-foreground">Friends</span>
          </button>

          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={() => {
              toast({
                title: "QR Code",
                description: "QR code sharing coming soon!",
              });
            }}
          >
            <QrCode size={24} />
          </Button>
        </div>

        {/* Rounds section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-foreground">Rounds ({roundsCount})</h2>
            <Button
              variant="link"
              className="text-primary"
              onClick={() => navigate('/rounds')}
            >
              View all
            </Button>
          </div>

          {recentRounds.length > 0 ? (
            <Card className="bg-[hsl(120,30%,95%)] border-[hsl(120,30%,85%)]">
              <CardContent className="p-4">
                {recentRounds.map((round) => (
                  <div key={round.id} className="mb-3 last:mb-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          Game {new Date(round.date).toLocaleDateString()}
                        </h3>
                        <p className="text-sm text-muted-foreground">{round.course_name}</p>
                        <p className="text-xs text-muted-foreground">{round.date}</p>
                      </div>
                      <div className="text-3xl font-bold text-foreground">
                        {round.score > 0 ? '+' : ''}{round.score}
                      </div>
                    </div>
                    <div className="flex -space-x-2 mt-2">
                      <div className="h-6 w-6 rounded-full bg-primary/30 border border-background" />
                      <div className="h-6 w-6 rounded-full bg-primary/50 border border-background" />
                      <div className="h-6 w-6 rounded-full bg-primary/70 border border-background" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No rounds played yet</p>
                <Button
                  variant="link"
                  className="text-primary mt-2"
                  onClick={() => navigate('/rounds')}
                >
                  Start your first round
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Statistics section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-foreground">Statistics</h2>
            <Button variant="link" className="text-primary">
              View all
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="p-4 text-center">
                <Target className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground mb-1">Goals</p>
              </CardContent>
            </Card>

            <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground mb-1">Overview</p>
                {averageScore !== null && (
                  <p className="text-2xl font-bold text-foreground">{averageScore}</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground mb-1">Compare</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-20 flex flex-col items-center justify-center gap-2"
            onClick={() => navigate('/levels')}
          >
            <Target size={24} />
            <span>Levels</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex flex-col items-center justify-center gap-2"
            onClick={() => navigate('/drills')}
          >
            <TrendingUp size={24} />
            <span>Drills</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex flex-col items-center justify-center gap-2"
            onClick={() => navigate('/groups')}
          >
            <Users size={24} />
            <span>Groups</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex flex-col items-center justify-center gap-2"
            onClick={() => navigate('/leaderboards')}
          >
            <BarChart3 size={24} />
            <span>Leaderboards</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
