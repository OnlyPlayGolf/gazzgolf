import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Camera, QrCode, Users, Menu, ChevronRight, User as UserIcon, Settings as SettingsIcon, Info, MessageSquare, Crown, LogOut, HelpCircle } from "lucide-react";
import { StatisticsOverview } from "@/components/statistics/StatisticsOverview";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TopNavBar } from "@/components/TopNavBar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QRCode from "react-qr-code";
import { FeedPost } from "@/components/FeedPost";
import { ProfileRoundsSection } from "@/components/ProfileRoundsSection";
import { RoundCardData } from "@/components/RoundCard";
import { loadUnifiedRounds } from "@/utils/unifiedRoundsLoader";
import { parseHandicap, formatHandicap } from "@/lib/utils";

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  country: string | null;
  handicap: string | null;
  home_club: string | null;
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
  const [recentRounds, setRecentRounds] = useState<RoundCardData[]>([]);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [userPosts, setUserPosts] = useState<any[]>([]);

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

    // Load unified rounds (includes all game types)
    const allRounds = await loadUnifiedRounds(user.id);
    
    setRoundsCount(allRounds.length);
    setRecentRounds(allRounds.slice(0, 3));

    // Calculate average score from stroke play rounds only
    const strokePlayRounds = allRounds.filter(r => r.gameType === 'round' || !r.gameType);
    if (strokePlayRounds.length > 0) {
      const scores = strokePlayRounds.map(r => r.score);
      const total = scores.reduce((sum, score) => sum + score, 0);
      setAverageScore(Math.round((total / scores.length) * 10) / 10);
    }

    // Load user's posts
    const { data: postsData } = await supabase
      .from('posts')
      .select(`
        *,
        profile:user_id (
          display_name,
          username,
          avatar_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (postsData) {
      setUserPosts(postsData);
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
  // Format handicap correctly: use parseHandicap to handle both string ("+10", "10") and numeric formats
  // Plus handicaps are stored as negative internally, formatHandicap displays them with "+"
  const handicapValue = profile.handicap ? parseHandicap(profile.handicap) : null;
  const handicapDisplay = handicapValue !== null && handicapValue !== undefined
    ? `HCP ${formatHandicap(handicapValue)}`
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
              <div className="space-y-3 mt-8">
                {/* Personal Information */}
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
                          <div className="p-2 rounded-lg bg-muted">
                            <UserIcon size={18} className="text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">Personal Information</div>
                            <div className="text-xs text-muted-foreground">Edit your profile details</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                {/* Account Membership */}
                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      onClick={() => { 
                        navigate('/account-membership'); 
                        setMenuOpen(false);
                      }}
                      className="w-full h-auto p-4 justify-start text-left"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Crown size={18} className="text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">Account Membership</div>
                            <div className="text-xs text-muted-foreground">View plans and benefits</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                {/* Settings */}
                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      onClick={() => { 
                        navigate('/settings'); 
                        setMenuOpen(false);
                      }}
                      className="w-full h-auto p-4 justify-start text-left"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <SettingsIcon size={18} className="text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">Settings</div>
                            <div className="text-xs text-muted-foreground">Metrics, notifications, privacy</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                {/* About */}
                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      onClick={() => { 
                        navigate('/about'); 
                        setMenuOpen(false);
                      }}
                      className="w-full h-auto p-4 justify-start text-left"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Info size={18} className="text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">About</div>
                            <div className="text-xs text-muted-foreground">App info and legal</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                {/* Feedback */}
                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      onClick={() => { 
                        navigate('/feedback'); 
                        setMenuOpen(false);
                      }}
                      className="w-full h-auto p-4 justify-start text-left"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <MessageSquare size={18} className="text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">Feedback</div>
                            <div className="text-xs text-muted-foreground">Share your thoughts</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                {/* Support */}
                <Card className="border-border">
                  <CardContent className="p-0">
                    <Button
                      variant="ghost"
                      onClick={() => { 
                        navigate('/support'); 
                        setMenuOpen(false);
                      }}
                      className="w-full h-auto p-4 justify-start text-left"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <HelpCircle size={18} className="text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">Support</div>
                            <div className="text-xs text-muted-foreground">FAQ and help</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                {/* Log Out */}
                <Card className="border-border mt-4">
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
                          <div className="p-2 rounded-lg bg-destructive/10">
                            <LogOut size={18} className="text-destructive" />
                          </div>
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

        {/* Profile photo - centered at top */}
        <div className="flex flex-col items-center">
          <ProfilePhoto
            src={profile.avatar_url}
            alt={displayName}
            fallback={displayName}
            size="2xl"
            className="border-4 border-background shadow-lg"
          />
        </div>
      </div>

      {/* Profile info - centered under photo, matching friends' profiles */}
      <div className="px-4">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-foreground mb-2">{displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {handicapDisplay}
            {profile.home_club && ` | ${profile.home_club}`}
            {profile.country && ` | ${profile.country}`}
          </p>
        </div>

        {/* Additional content */}

        {/* Friends and QR code */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <button
            onClick={() => navigate('/friends', { state: { from: 'profile' } })}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity px-4 h-12 border-2 border-border rounded-full min-w-[200px]"
          >
            <div className="flex -space-x-2 p-1">
              {friends.length > 0 ? (
                  friends.slice(0, 3).map((friend) => (
                    <ProfilePhoto
                      key={friend.id}
                      src={friend.avatar_url}
                      alt={friend.display_name || friend.username || "U"}
                      fallback={friend.display_name || friend.username || "U"}
                      size="sm"
                      className="border-2 border-background"
                    />
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
            onClick={() => setQrDialogOpen(true)}
          >
            <QrCode size={24} />
          </Button>
        </div>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">My Friend QR Code</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCode 
                  value={`${window.location.origin}/add-friend/${profile.id}`}
                  size={200}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Share this QR code with friends to let them add you instantly!
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Rounds section */}
        <ProfileRoundsSection
          rounds={recentRounds}
          totalCount={roundsCount}
          userId={profile.id}
          isOwnProfile={true}
          isFriend={true}
        />

        {/* Statistics section */}
        <StatisticsOverview userId={profile.id} />

        {/* Posts Section Header */}
        <h2 className="text-xl font-bold text-foreground mb-3">Posts</h2>
      </div>

      {/* Posts without side padding - edge to edge */}
      {userPosts.length > 0 ? (
        <div className="space-y-0 mb-6">
          {userPosts.map((post) => (
            <FeedPost key={post.id} post={post} currentUserId={profile.id} onPostDeleted={loadProfileData} />
          ))}
        </div>
      ) : (
        <div className="px-4 mb-6">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No posts yet</p>
              <Button
                variant="link"
                className="text-primary mt-2"
                onClick={() => navigate('/')}
              >
                Share your first golf moment
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

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
