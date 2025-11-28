import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, X } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";

interface UserProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  country: string | null;
  handicap: string | null;
}

export default function AddFriendFromQR() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyFriends, setAlreadyFriends] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setCurrentUser(user.id);

      // Check if trying to add themselves
      if (user.id === userId) {
        toast({
          title: "Invalid Action",
          description: "You cannot add yourself as a friend!",
          variant: "destructive",
        });
        navigate('/profile');
        return;
      }

      // Load target user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        toast({
          title: "Error",
          description: "User not found",
          variant: "destructive",
        });
        navigate('/profile');
        return;
      }

      setProfile(profileData);

      // Check if already friends or request exists
      const { data: friendshipData } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester.eq.${user.id},addressee.eq.${userId}),and(requester.eq.${userId},addressee.eq.${user.id})`);

      if (friendshipData && friendshipData.length > 0) {
        setAlreadyFriends(true);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load user information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!currentUser || !userId) return;

    try {
      setLoading(true);

      // Insert friend request
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester: currentUser,
          addressee: userId,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Friend request sent!",
        description: `Your friend request has been sent to ${profile?.display_name || profile?.username || 'this user'}.`,
      });

      navigate('/friends');
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      
      if (error.code === '23505') {
        toast({
          title: "Already sent",
          description: "You've already sent a friend request to this user.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to send friend request",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.display_name || profile.username || 'User';
  const handicapValue = profile.handicap ? parseFloat(profile.handicap) : null;
  const handicapDisplay = handicapValue !== null 
    ? `HCP ${handicapValue > 0 ? '+' : ''}${handicapValue}`
    : 'HCP Not Set';

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      <div className="p-4 pt-24 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Add Friend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User Profile */}
            <div className="flex flex-col items-center">
              <Avatar className="h-24 w-24 border-4 border-border mb-4">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-bold text-foreground mb-1">{displayName}</h2>
              <p className="text-sm text-muted-foreground">
                {handicapDisplay}
                {profile.country && ` | ${profile.country}`}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {alreadyFriends ? (
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => navigate('/friends')}
                >
                  Already Friends
                </Button>
              ) : (
                <Button 
                  className="flex-1"
                  onClick={handleAddFriend}
                  disabled={loading}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Friend
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => navigate('/profile')}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
