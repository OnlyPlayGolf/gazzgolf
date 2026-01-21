import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';
import { fetchPostsEngagement } from "@/utils/postsEngagement";
import { getPublicProfilesMap } from "@/utils/publicProfiles";

export function useFeedPosts(user: SupabaseUser | null) {
  const [friendsPosts, setFriendsPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeedPosts = useCallback(async () => {
    if (!user) {
      setFriendsPosts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Load friends first
      const { data: friendsData } = await supabase
        .from('friendships')
        .select('user_a, user_b, requester, addressee')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('status', 'accepted');

      if (friendsData && friendsData.length > 0) {
        const friendIds = friendsData.map(f => 
          f.user_a === user.id ? f.user_b : f.user_a
        );

        // Get friends' posts (and own posts) - include scorecard_snapshot
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
          const profileMap = await getPublicProfilesMap(
            supabase as any,
            posts.map((p: any) => p.user_id)
          );
          const engagement = await fetchPostsEngagement(
            posts.map((p: any) => p.id),
            user.id
          );
          const withEngagement = posts.map((p: any) => {
            const publicProfile = profileMap.get(p.user_id);
            const mergedProfile = {
              ...(p.profile || {}),
              ...(publicProfile
                ? {
                    display_name: publicProfile.display_name,
                    username: publicProfile.username,
                    avatar_url: publicProfile.avatar_url,
                  }
                : {}),
            };
            return {
              ...p,
              profile: mergedProfile,
              _engagement: engagement[p.id] || { likeCount: 0, commentCount: 0, likedByMe: false },
            };
          });
          setFriendsPosts(withEngagement);
        }
      } else {
        // No friends, just get own posts
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
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (posts) {
          const profileMap = await getPublicProfilesMap(
            supabase as any,
            posts.map((p: any) => p.user_id)
          );
          const engagement = await fetchPostsEngagement(
            posts.map((p: any) => p.id),
            user.id
          );
          const withEngagement = posts.map((p: any) => {
            const publicProfile = profileMap.get(p.user_id);
            const mergedProfile = {
              ...(p.profile || {}),
              ...(publicProfile
                ? {
                    display_name: publicProfile.display_name,
                    username: publicProfile.username,
                    avatar_url: publicProfile.avatar_url,
                  }
                : {}),
            };
            return {
              ...p,
              profile: mergedProfile,
              _engagement: engagement[p.id] || { likeCount: 0, commentCount: 0, likedByMe: false },
            };
          });
          setFriendsPosts(withEngagement);
        }
      }
    } catch (error) {
      console.error('Error loading feed posts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadFeedPosts();
  }, [loadFeedPosts]);

  return { friendsPosts, loading, refresh: loadFeedPosts };
}
