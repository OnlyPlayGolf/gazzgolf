import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';

type GameType = 'round' | 'copenhagen' | 'skins' | 'best_ball' | 'scramble' | 'wolf' | 'umbriago' | 'match_play';

export interface FriendOnCourseData {
  friendId: string;
  friendName: string;
  friendAvatar: string | null;
  gameId: string;
  gameType: GameType;
  courseName: string;
  createdAt: string;
}

export function useFriendsOnCourse(user: SupabaseUser | null) {
  const [friendsOnCourse, setFriendsOnCourse] = useState<FriendOnCourseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFriendsOnCourse([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadFriendsOnCourse = async () => {
      try {
        // Load friends first
        const { data: friendsData } = await supabase
          .from('friendships')
          .select('user_a, user_b, requester, addressee')
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .eq('status', 'accepted');

        if (!friendsData || friendsData.length === 0) {
          if (!cancelled) {
            setFriendsOnCourse([]);
            setLoading(false);
          }
          return;
        }

        const friendIds = friendsData.map(f => 
          f.user_a === user.id ? f.user_b : f.user_a
        );

        // Fetch friends' games from last 12 hours for "Friends on Course"
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

        // Fetch all game types from friends in parallel
        const [
          { data: friendRoundsLive },
          { data: friendCopenhagen },
          { data: friendSkins },
          { data: friendBestBall },
          { data: friendScramble },
          { data: friendWolf },
          { data: friendUmbriago },
          { data: friendMatchPlay }
        ] = await Promise.all([
          supabase.from('rounds').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('copenhagen_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('skins_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, players').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('best_ball_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, team_a_players, team_b_players').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('scramble_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, teams').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('wolf_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('umbriago_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
          supabase.from('match_play_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
        ]);

        // Collect all games with their owner user IDs
        const allGames: { gameId: string; gameType: GameType; userId: string; courseName: string; createdAt: string }[] = [];

        // Process rounds
        for (const round of friendRoundsLive || []) {
          allGames.push({
            gameId: round.id,
            gameType: 'round',
            userId: round.user_id,
            courseName: round.course_name,
            createdAt: round.created_at,
          });
        }

        // Process other game types
        for (const game of friendCopenhagen || []) {
          allGames.push({ gameId: game.id, gameType: 'copenhagen', userId: game.user_id, courseName: game.course_name, createdAt: game.created_at });
        }
        for (const game of friendSkins || []) {
          allGames.push({ gameId: game.id, gameType: 'skins', userId: game.user_id, courseName: game.course_name, createdAt: game.created_at });
        }
        for (const game of friendBestBall || []) {
          allGames.push({ gameId: game.id, gameType: 'best_ball', userId: game.user_id, courseName: game.course_name, createdAt: game.created_at });
        }
        for (const game of friendScramble || []) {
          allGames.push({ gameId: game.id, gameType: 'scramble', userId: game.user_id, courseName: game.course_name, createdAt: game.created_at });
        }
        for (const game of friendWolf || []) {
          allGames.push({ gameId: game.id, gameType: 'wolf', userId: game.user_id, courseName: game.course_name, createdAt: game.created_at });
        }
        for (const game of friendUmbriago || []) {
          allGames.push({ gameId: game.id, gameType: 'umbriago', userId: game.user_id, courseName: game.course_name, createdAt: game.created_at });
        }
        for (const game of friendMatchPlay || []) {
          allGames.push({ gameId: game.id, gameType: 'match_play', userId: game.user_id, courseName: game.course_name, createdAt: game.created_at });
        }

        // Collect unique friend user IDs on course
        const uniqueFriendIds = [...new Set(allGames.map(g => g.userId))];

        // Fetch profiles for all friends on course
        let friendsOnCourseData: FriendOnCourseData[] = [];
        if (uniqueFriendIds.length > 0) {
          const { data: onCourseProfiles } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', uniqueFriendIds);

          const profileMap = new Map(
            (onCourseProfiles || []).map(p => [p.id, p])
          );

          // Create FriendOnCourseData entries
          for (const game of allGames) {
            const profile = profileMap.get(game.userId);
            const displayName = profile?.display_name || profile?.username || 'Friend';
            const firstName = displayName.split(' ')[0];
            
            friendsOnCourseData.push({
              friendId: game.userId,
              friendName: firstName,
              friendAvatar: profile?.avatar_url || null,
              gameId: game.gameId,
              gameType: game.gameType,
              courseName: game.courseName,
              createdAt: game.createdAt,
            });
          }
        }

        // Sort by most recently started (createdAt desc)
        friendsOnCourseData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (!cancelled) {
          setFriendsOnCourse(friendsOnCourseData);
        }
      } catch (error) {
        console.error('Error loading friends on course:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadFriendsOnCourse();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { friendsOnCourse, loading };
}
