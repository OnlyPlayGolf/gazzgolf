import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { UserPlus, Users, ArrowLeft, MessageCircle, Lock, UserMinus, QrCode, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TopNavBar } from "@/components/TopNavBar";
import { FeedPost } from "@/components/FeedPost";
import QRCode from "react-qr-code";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ProfileRoundsSection } from "@/components/ProfileRoundsSection";
import { RoundCardData } from "@/components/RoundCard";
import { parseHandicap, formatHandicap } from "@/lib/utils";
import { fetchPostsEngagement } from "@/utils/postsEngagement";

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

type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

export default function PublicProfile() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('none');
  const [friendsCount, setFriendsCount] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [roundsCount, setRoundsCount] = useState(0);
  const [recentRounds, setRecentRounds] = useState<RoundCardData[]>([]);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  const POSTS_PAGE_SIZE = 10;

  const loadData = async () => {
    if (!userId) return;

    setLoading(true);
    setUserPosts([]);
    setPostsCursor(null);
    setPostsHasMore(false);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);

    // If viewing own profile, redirect to UserProfile
    if (user?.id === userId) {
      navigate('/profile');
      return;
    }

    // Load the viewed user's profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profileData) {
      toast({
        title: "Error",
        description: "User not found",
        variant: "destructive"
      });
      navigate(-1);
      return;
    }

    setProfile(profileData);

    // Check friendship status
    if (user) {
      const { data: friendshipData } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester.eq.${user.id},addressee.eq.${userId}),and(requester.eq.${userId},addressee.eq.${user.id})`);

      if (friendshipData && friendshipData.length > 0) {
        const friendship = friendshipData[0];
        if (friendship.status === 'accepted') {
          setFriendshipStatus('accepted');
        } else if (friendship.status === 'pending') {
          if (friendship.requester === user.id) {
            setFriendshipStatus('pending_sent');
          } else {
            setFriendshipStatus('pending_received');
          }
        }
      } else {
        setFriendshipStatus('none');
      }
    }

    // Get friends count for the viewed user
    const { count: totalFriendsCount } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .or(`requester.eq.${userId},addressee.eq.${userId}`)
      .eq('status', 'accepted');

    setFriendsCount(totalFriendsCount || 0);

    // Only load friends, rounds, posts if they are friends
    if (user && friendshipStatus === 'accepted') {
      await loadFriendContent(userId, user.id);
    } else {
      // Re-check friendship for loading content
      const { data: checkFriendship } = await supabase
        .from('friendships')
        .select('status')
        .or(`and(requester.eq.${user?.id},addressee.eq.${userId}),and(requester.eq.${userId},addressee.eq.${user?.id})`)
        .eq('status', 'accepted')
        .single();

      if (checkFriendship) {
        await loadFriendContent(userId, user?.id || '');
      }
    }

    setLoading(false);
  };

  const loadFriendContent = async (targetUserId: string, currentUser: string) => {
    // Load friends with profiles (up to 3 for display)
    const { data: friendshipsData } = await supabase
      .from('friendships')
      .select('requester, addressee')
      .or(`requester.eq.${targetUserId},addressee.eq.${targetUserId}`)
      .eq('status', 'accepted')
      .limit(3);

    if (friendshipsData && friendshipsData.length > 0) {
      const friendIds = friendshipsData.map(f => 
        f.requester === targetUserId ? f.addressee : f.requester
      );

      const { data: friendsProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', friendIds);

      setFriends(friendsProfiles || []);
    }

    // Load unified rounds (includes all game types)
    const { loadUnifiedRounds } = await import('@/utils/unifiedRoundsLoader');
    const allRounds = await loadUnifiedRounds(targetUserId);
    
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
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(POSTS_PAGE_SIZE + 1);

    if (postsData) {
      const page = postsData.slice(0, POSTS_PAGE_SIZE);
      const engagement = await fetchPostsEngagement(
        page.map((p: any) => p.id),
        currentUser || null
      );
      setUserPosts(
        page.map((p: any) => ({
          ...p,
          _engagement: engagement[p.id] || { likeCount: 0, commentCount: 0, likedByMe: false },
        }))
      );
      setPostsHasMore(postsData.length > POSTS_PAGE_SIZE);
      setPostsCursor(page.length > 0 ? page[page.length - 1].created_at : null);
    }
  };

  const loadMorePosts = async () => {
    if (postsLoadingMore || !postsHasMore || !postsCursor || !userId) return;
    setPostsLoadingMore(true);
    try {
      const { data: morePosts, error } = await supabase
        .from('posts')
        .select(`
          *,
          profile:user_id (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('user_id', userId)
        .lt('created_at', postsCursor)
        .order('created_at', { ascending: false })
        .limit(POSTS_PAGE_SIZE + 1);

      if (error) {
        console.error('Error loading more posts:', error);
        return;
      }

      const nextPage = (morePosts || []).slice(0, POSTS_PAGE_SIZE);
      const engagement = await fetchPostsEngagement(
        nextPage.map((p: any) => p.id),
        currentUserId
      );
      setUserPosts((prev) => [
        ...prev,
        ...nextPage.map((p: any) => ({
          ...p,
          _engagement: engagement[p.id] || { likeCount: 0, commentCount: 0, likedByMe: false },
        })),
      ]);
      setPostsHasMore((morePosts || []).length > POSTS_PAGE_SIZE);
      setPostsCursor(nextPage.length > 0 ? nextPage[nextPage.length - 1].created_at : postsCursor);
    } finally {
      setPostsLoadingMore(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!currentUserId || !userId) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester: currentUserId,
          addressee: userId,
          status: 'pending'
        });

      if (error) throw error;

      setFriendshipStatus('pending_sent');
      toast({
        title: "Success",
        description: "Friend request sent"
      });
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive"
      });
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!currentUserId || !userId) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('requester', userId)
        .eq('addressee', currentUserId);

      if (error) throw error;

      setFriendshipStatus('accepted');
      toast({
        title: "Success",
        description: "Friend request accepted"
      });
      
      // Reload content now that they're friends
      loadData();
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast({
        title: "Error",
        description: "Failed to accept friend request",
        variant: "destructive"
      });
    }
  };

  const handleMessageFriend = async () => {
    if (!currentUserId || !userId) return;

    try {
      const { data: conversationId, error } = await supabase
        .rpc('ensure_friend_conversation', { friend_id: userId });

      if (error) throw error;

      navigate(`/messages?conversation=${conversationId}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive"
      });
    }
  };

  const handleRemoveFriend = async () => {
    if (!currentUserId || !userId) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(requester.eq.${currentUserId},addressee.eq.${userId}),and(requester.eq.${userId},addressee.eq.${currentUserId})`);

      if (error) throw error;

      setFriendshipStatus('none');
      setFriends([]);
      setRecentRounds([]);
      setUserPosts([]);
      setShowRemoveConfirm(false);
      toast({
        title: "Success",
        description: "Friend removed"
      });
    } catch (error) {
      console.error('Error removing friend:', error);
      toast({
        title: "Error",
        description: "Failed to remove friend",
        variant: "destructive"
      });
    }
  };

  const handleCancelFriendRequest = async () => {
    if (!currentUserId || !userId) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('requester', currentUserId)
        .eq('addressee', userId);

      if (error) throw error;

      setFriendshipStatus('none');
      toast({
        title: "Success",
        description: "Friend request cancelled"
      });
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      toast({
        title: "Error",
        description: "Failed to cancel friend request",
        variant: "destructive"
      });
    }
  };

  const qrCodeUrl = `${window.location.origin}/add-friend/${userId}`;

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        Loading...
      </div>
    );
  }

  const displayName = profile.display_name || profile.username || 'User';
  // Format handicap correctly: use parseHandicap to handle both string ("+10", "10") and numeric formats
  // Plus handicaps are stored as negative internally, formatHandicap displays them with "+"
  const handicapValue = profile.handicap ? parseHandicap(profile.handicap) : null;
  const handicapDisplay = handicapValue !== null && handicapValue !== undefined
    ? `HCP ${formatHandicap(handicapValue)}`
    : 'HCP Not Set';

  const isFriend = friendshipStatus === 'accepted';

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      <div className="relative px-4 py-6 pt-20">
        {/* Back button */}
        <div className="absolute top-20 left-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={24} />
          </Button>
        </div>

        {/* Profile photo */}
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

        {/* Action buttons based on friendship status */}
        <div className="flex justify-center gap-3 mb-6">
          {friendshipStatus === 'none' && (
            <Button onClick={handleSendFriendRequest} className="gap-2">
              <UserPlus size={18} />
              Add Friend
            </Button>
          )}
          {friendshipStatus === 'pending_sent' && (
            <Button variant="outline" onClick={handleCancelFriendRequest} className="gap-2">
              <X size={18} />
              Cancel Request
            </Button>
          )}
          {friendshipStatus === 'pending_received' && (
            <Button onClick={handleAcceptFriendRequest} className="gap-2">
              <UserPlus size={18} />
              Accept Request
            </Button>
          )}
          {friendshipStatus === 'accepted' && (
            <>
              <Button variant="outline" onClick={handleMessageFriend} className="gap-2">
                <MessageCircle size={18} />
                Message
              </Button>
              <Button variant="outline" onClick={() => setShowRemoveConfirm(true)} className="gap-2 text-destructive hover:text-destructive">
                <UserMinus size={18} />
                Remove
              </Button>
            </>
          )}
        </div>

        {/* Friends section - show Add Friend box if not friends */}
        {isFriend ? (
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex items-center gap-3 px-4 h-12 border-2 border-border rounded-full">
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
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full border-2"
              onClick={() => setShowQRCode(true)}
            >
              <QrCode size={20} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="flex items-center gap-3 px-4 h-12 border-2 border-border rounded-full">
              <Users size={20} className="text-muted-foreground" />
              <span className="text-lg font-semibold text-foreground">{friendsCount}</span>
              <span className="text-sm text-muted-foreground">Friends</span>
            </div>
          </div>
        )}

        {/* Rounds section */}
        <ProfileRoundsSection
          rounds={recentRounds}
          totalCount={roundsCount}
          userId={userId || ''}
          isOwnProfile={false}
          isFriend={isFriend}
          displayName={displayName}
        />

        {/* Statistics section - locked if not friends */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-foreground">Statistics</h2>
          </div>

          {isFriend ? (
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Rounds</p>
                  <p className="text-2xl font-bold text-foreground">{roundsCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Avg Score</p>
                  <p className="text-2xl font-bold text-foreground">
                    {averageScore !== null ? (averageScore > 0 ? '+' : '') + averageScore : '-'}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Lock size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">Add {displayName} as a friend to see their stats</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Posts Section Header */}
        <h2 className="text-xl font-bold text-foreground mb-3">Posts</h2>
      </div>

      {/* Posts Section - locked if not friends, edge to edge */}
      {isFriend ? (
        userPosts.length > 0 ? (
          <div className="space-y-0 mb-6">
            {userPosts.map((post) => (
              <FeedPost key={post.id} post={post} currentUserId={currentUserId || ''} onPostDeleted={loadData} />
            ))}
            {postsHasMore && (
              <div className="px-4 py-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={loadMorePosts}
                  disabled={postsLoadingMore}
                >
                  {postsLoadingMore ? "Loading..." : "View More"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 mb-6">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">
                  No posts yet. Share a drill, round or comment to get started!
                </p>
              </CardContent>
            </Card>
          </div>
        )
      ) : (
        <div className="px-4 mb-6">
          <Card>
            <CardContent className="p-6 text-center">
              <Lock size={24} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Add {displayName} as a friend to see their posts</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 p-4">
            <h3 className="text-lg font-semibold">{displayName}'s QR Code</h3>
            <div className="bg-white p-4 rounded-lg">
              <QRCode value={qrCodeUrl} size={200} />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Scan this code to add {displayName} as a friend
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Friend Confirmation Dialog */}
      <Dialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 p-4">
            <UserMinus size={48} className="text-destructive" />
            <h3 className="text-lg font-semibold">Remove Friend?</h3>
            <p className="text-sm text-muted-foreground text-center">
              Are you sure you want to remove {displayName} as a friend?
            </p>
            <div className="flex gap-3 w-full">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowRemoveConfirm(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1"
                onClick={handleRemoveFriend}
              >
                Remove
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
