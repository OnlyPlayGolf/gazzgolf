import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, QrCode, Users, Target, TrendingUp, BarChart3, Menu, ChevronRight, Mail, User as UserIcon, Settings as SettingsIcon, Info, MessageCircle as MessageCircleIcon, Crown, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TopNavBar } from "@/components/TopNavBar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

interface Friend {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export default function UserProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [roundsCount, setRoundsCount] = useState(0);
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

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

    // Load friends with profiles
    const { data: friendshipsData } = await supabase
      .from('friendships')
      .select('requester, addressee')
      .or(`requester.eq.${user.id},addressee.eq.${user.id}`)
      .eq('status', 'accepted')
      .limit(3);

    if (friendshipsData && friendshipsData.length > 0) {
      const friendIds = friendshipsData.map(f => 
        f.requester === user.id ? f.addressee : f.requester
      );

      const { data: friendsProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', friendIds);

      setFriends(friendsProfiles || []);
      setFriendsCount(friendshipsData.length);
    }

    // Also get total friends count
    const { count: totalFriendsCount } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .or(`requester.eq.${user.id},addressee.eq.${user.id}`)
      .eq('status', 'accepted');

    setFriendsCount(totalFriendsCount || 0);

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
      <TopNavBar />
      <div className="relative px-4 py-6 pt-20">
        {/* Hamburger Menu in top right */}
        <div className="absolute top-20 right-4 z-10">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Open Menu"
              >
                <Menu size={24} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="space-y-4 mt-8">
                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      onClick={() => { 
                        navigate('/profile-settings'); 
                        setMenuOpen(false);
                      }}
                      className="w-full h-auto p-4 justify-start text-left"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <UserIcon size={20} className="text-primary" />
                          <div className="font-medium text-foreground">Edit Profile</div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      disabled
                      className="w-full h-auto p-4 justify-start text-left disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <Crown size={20} className="text-muted-foreground" />
                          <div>
                            <div className="font-medium text-muted-foreground">Account Membership</div>
                            <div className="text-xs text-muted-foreground">Coming soon</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      disabled
                      className="w-full h-auto p-4 justify-start text-left disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <MessageCircleIcon size={20} className="text-muted-foreground" />
                          <div>
                            <div className="font-medium text-muted-foreground">Notifications</div>
                            <div className="text-xs text-muted-foreground">Coming soon</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      disabled
                      className="w-full h-auto p-4 justify-start text-left disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <SettingsIcon size={20} className="text-muted-foreground" />
                          <div>
                            <div className="font-medium text-muted-foreground">Settings</div>
                            <div className="text-xs text-muted-foreground">Coming soon</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      disabled
                      className="w-full h-auto p-4 justify-start text-left disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <Info size={20} className="text-muted-foreground" />
                          <div>
                            <div className="font-medium text-muted-foreground">About</div>
                            <div className="text-xs text-muted-foreground">Coming soon</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      asChild
                      className="w-full h-auto p-4 justify-start text-left"
                    >
                      <a href="mailto:feedback@golftraining.app" className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <Mail size={20} className="text-primary" />
                          <div className="font-medium text-foreground">Feedback</div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      disabled
                      className="w-full h-auto p-4 justify-start text-left disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <MessageCircleIcon size={20} className="text-muted-foreground" />
                          <div>
                            <div className="font-medium text-muted-foreground">Support</div>
                            <div className="text-xs text-muted-foreground">Coming soon</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setMenuOpen(false);
                        setTimeout(() => setLogoutDialogOpen(true), 300);
                      }}
                      className="w-full h-auto p-4 justify-start text-left text-destructive hover:text-destructive"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <LogOut size={20} className="text-destructive" />
                          <div className="font-medium">Log Out</div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Profile photo */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-border">
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
      <div className="px-4">
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
            onClick={() => navigate('/friends', { state: { from: 'profile' } })}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity px-4 h-12 border-2 border-border rounded-full min-w-[200px]"
          >
            <div className="flex -space-x-2 p-1">
              {friends.length > 0 ? (
                friends.slice(0, 3).map((friend, index) => (
                  <Avatar key={friend.id} className="h-8 w-8 border-2 border-background">
                    <AvatarImage src={friend.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {(friend.display_name || friend.username || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))
              ) : (
                <>
                  <div className="h-8 w-8 rounded-full bg-primary/20 border-2 border-background" />
                  <div className="h-8 w-8 rounded-full bg-primary/40 border-2 border-background" />
                  <div className="h-8 w-8 rounded-full bg-primary/60 border-2 border-background" />
                </>
              )}
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
              onClick={() => navigate('/rounds', { state: { from: 'profile' } })}
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

      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await supabase.auth.signOut();
                setLogoutDialogOpen(false);
                navigate('/auth');
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Log Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
