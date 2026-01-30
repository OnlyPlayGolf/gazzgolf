import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';

/**
 * Extracts the round number from a round name pattern like "Event Name - Round 3"
 * Returns null if pattern doesn't match
 */
function extractRoundNumber(roundName: string | null | undefined): number | null {
  if (!roundName) return null;
  
  // Match patterns like "Event - Round 3" or "Event - Round 1"
  const match = roundName.match(/- Round (\d+)$/i);
  if (match && match[1]) {
    const roundNum = parseInt(match[1], 10);
    return isNaN(roundNum) ? null : roundNum;
  }
  
  return null;
}

/**
 * Filters stroke play rounds to show only the latest round from each multi-round game (same event_id)
 */
function filterMultiRoundRounds(rounds: Array<{ id: string; event_id: string | null; round_name: string | null; created_at: string }>): Array<{ id: string; event_id: string | null; round_name: string | null; created_at: string }> {
  // Separate rounds with event_id from those without
  const multiRoundRounds: Array<{ id: string; event_id: string; round_name: string | null; created_at: string }> = [];
  const singleRounds: Array<{ id: string; event_id: string | null; round_name: string | null; created_at: string }> = [];
  
  for (const round of rounds) {
    if (round.event_id) {
      multiRoundRounds.push(round as { id: string; event_id: string; round_name: string | null; created_at: string });
    } else {
      singleRounds.push(round);
    }
  }
  
  // Group multi-round games by event_id
  const roundsByEvent = new Map<string, Array<{ id: string; event_id: string; round_name: string | null; created_at: string }>>();
  
  for (const round of multiRoundRounds) {
    const eventId = round.event_id;
    if (!roundsByEvent.has(eventId)) {
      roundsByEvent.set(eventId, []);
    }
    roundsByEvent.get(eventId)!.push(round);
  }
  
  // For each event, keep only the latest round
  const filteredMultiRoundRounds: Array<{ id: string; event_id: string | null; round_name: string | null; created_at: string }> = [];
  
  for (const [eventId, eventRounds] of roundsByEvent.entries()) {
    if (eventRounds.length === 1) {
      // Single round in event - keep it
      filteredMultiRoundRounds.push(eventRounds[0]);
    } else {
      // Multiple rounds - find the latest one
      let latestRound: { id: string; event_id: string; round_name: string | null; created_at: string } | null = null;
      let highestRoundNumber: number | null = null;
      let latestCreatedAt: string | null = null;
      
      for (const round of eventRounds) {
        const roundNumber = extractRoundNumber(round.round_name);
        
        if (roundNumber !== null) {
          // Use round number to determine latest
          if (highestRoundNumber === null || roundNumber > highestRoundNumber) {
            highestRoundNumber = roundNumber;
            latestRound = round;
          } else if (roundNumber === highestRoundNumber) {
            // Tie on round number - use created_at as tiebreaker
            if (!latestCreatedAt || round.created_at > latestCreatedAt) {
              latestCreatedAt = round.created_at;
              latestRound = round;
            }
          }
        } else {
          // Can't extract round number - use created_at
          if (latestCreatedAt === null || round.created_at > latestCreatedAt) {
            latestCreatedAt = round.created_at;
            latestRound = round;
          }
        }
      }
      
      // If we found a latest round, add it
      if (latestRound) {
        filteredMultiRoundRounds.push(latestRound);
      }
    }
  }
  
  // Combine filtered multi-round rounds with single rounds
  return [...filteredMultiRoundRounds, ...singleRounds];
}

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

  const loadFriendsOnCourse = async () => {
    if (!user) {
      setFriendsOnCourse([]);
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

      if (!friendsData || friendsData.length === 0) {
        setFriendsOnCourse([]);
        setLoading(false);
        return;
      }

      const friendIds = friendsData.map(f => 
        f.user_a === user.id ? f.user_b : f.user_a
      );

      // Fetch friends' games from last 12 hours for "Friends on Course"
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      // Fetch all game types from friends in parallel (rounds by creator + round_players for rounds where a friend is participant)
      const [
        { data: friendRoundsLive },
        { data: roundPlayersWhereFriend },
        { data: friendCopenhagen },
        { data: friendSkins },
        { data: friendBestBall },
        { data: friendScramble },
        { data: friendWolf },
        { data: friendUmbriago },
        { data: friendMatchPlay }
      ] = await Promise.all([
        supabase.from('rounds').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, event_id').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
        supabase.from('round_players').select('round_id, user_id').in('user_id', friendIds),
        supabase.from('copenhagen_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
        supabase.from('skins_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, players').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
        supabase.from('best_ball_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, team_a_players, team_b_players').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
        supabase.from('scramble_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, teams').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
        supabase.from('wolf_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
        supabase.from('umbriago_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
        supabase.from('match_play_games').select('id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2').in('user_id', friendIds).gte('created_at', twelveHoursAgo),
      ]);

      // Rounds where a friend is participant (not necessarily creator): fetch round details for last 12h
      const participantRoundIds = [...new Set((roundPlayersWhereFriend || []).map((rp: { round_id: string }) => rp.round_id))];
      let roundsWhereFriendParticipant: Array<{ id: string; user_id: string; course_name: string; round_name: string | null; created_at: string; event_id: string | null }> = [];
      if (participantRoundIds.length > 0) {
        const { data: participantRounds } = await supabase
          .from('rounds')
          .select('id, user_id, course_name, round_name, created_at, event_id')
          .in('id', participantRoundIds)
          .gte('created_at', twelveHoursAgo);
        roundsWhereFriendParticipant = participantRounds || [];
      }

      // Merge rounds: creator rounds + rounds where a friend is participant (dedupe by id)
      const roundsById = new Map<string, { id: string; user_id: string; course_name: string; round_name: string | null; created_at: string; event_id: string | null }>();
      for (const r of friendRoundsLive || []) {
        roundsById.set(r.id, { id: r.id, user_id: r.user_id, course_name: r.course_name, round_name: r.round_name, created_at: r.created_at, event_id: r.event_id });
      }
      for (const r of roundsWhereFriendParticipant) {
        if (!roundsById.has(r.id)) roundsById.set(r.id, r);
      }
      const allRoundsForFilter = Array.from(roundsById.values());

      // Filter multi-round stroke play games to show only latest round
      const filteredRounds = filterMultiRoundRounds(
        allRoundsForFilter.map(r => ({
          id: r.id,
          event_id: r.event_id,
          round_name: r.round_name,
          created_at: r.created_at,
        }))
      );
      const filteredRoundIds = new Set(filteredRounds.map(r => r.id));

      // Group round_players by round_id (friend participants per round)
      const friendParticipantsByRoundId = new Map<string, string[]>();
      for (const rp of roundPlayersWhereFriend || []) {
        const rpTyped = rp as { round_id: string; user_id: string };
        if (!friendParticipantsByRoundId.has(rpTyped.round_id)) friendParticipantsByRoundId.set(rpTyped.round_id, []);
        friendParticipantsByRoundId.get(rpTyped.round_id)!.push(rpTyped.user_id);
      }

      const friendIdSet = new Set(friendIds);

      // Collect all games with their owner user IDs
      const allGames: { gameId: string; gameType: GameType; userId: string; courseName: string; createdAt: string }[] = [];

      // Process rounds: one entry per friend in the round (creator if friend + every participant who is a friend)
      for (const roundId of filteredRoundIds) {
        const round = roundsById.get(roundId);
        if (!round) continue;
        const friendIdsInRound = new Set<string>();
        if (friendIdSet.has(round.user_id)) friendIdsInRound.add(round.user_id);
        for (const uid of friendParticipantsByRoundId.get(roundId) || []) friendIdsInRound.add(uid);
        for (const uid of friendIdsInRound) {
          allGames.push({
            gameId: round.id,
            gameType: 'round',
            userId: uid,
            courseName: round.course_name,
            createdAt: round.created_at,
          });
        }
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

      setFriendsOnCourse(friendsOnCourseData);
    } catch (error) {
      console.error('Error loading friends on course:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFriendsOnCourse();
  }, [user?.id]);

  return { friendsOnCourse, loading, refresh: loadFriendsOnCourse };
}
