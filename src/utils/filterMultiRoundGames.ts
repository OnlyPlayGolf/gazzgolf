import type { RoundCardData } from "@/components/RoundCard";

/**
 * Extended RoundCardData that includes event_id for filtering multi-round games
 */
interface RoundCardDataWithEventId extends RoundCardData {
  event_id?: string | null;
}

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
 * Filters multi-round stroke play games to show only the latest/active round.
 * 
 * For stroke play rounds (gameType === 'round') that share the same event_id:
 * - Groups rounds by event_id
 * - For each group with multiple rounds, keeps only the latest round
 * - Latest round is determined by highest round number in round_name, 
 *   or most recent created_at if round number can't be extracted
 * 
 * All other rounds (single-round games, other game types) are unchanged.
 */
export function filterMultiRoundGames(rounds: RoundCardDataWithEventId[]): RoundCardData[] {
  // Separate stroke play rounds from other games
  const strokePlayRounds: RoundCardDataWithEventId[] = [];
  const otherRounds: RoundCardData[] = [];
  
  for (const round of rounds) {
    // Only filter stroke play rounds that have an event_id (indicating multi-round game)
    if ((round.gameType === 'round' || !round.gameType) && round.event_id) {
      strokePlayRounds.push(round);
    } else {
      // All other rounds pass through unchanged
      otherRounds.push(round);
    }
  }
  
  // Group stroke play rounds by event_id
  const roundsByEvent = new Map<string, RoundCardDataWithEventId[]>();
  
  for (const round of strokePlayRounds) {
    const eventId = round.event_id!;
    if (!roundsByEvent.has(eventId)) {
      roundsByEvent.set(eventId, []);
    }
    roundsByEvent.get(eventId)!.push(round);
  }
  
  // For each event, keep only the latest round
  const filteredStrokePlayRounds: RoundCardData[] = [];
  
  for (const [eventId, eventRounds] of roundsByEvent.entries()) {
    if (eventRounds.length === 1) {
      // Single round in event - keep it
      const { event_id, ...roundWithoutEventId } = eventRounds[0];
      filteredStrokePlayRounds.push(roundWithoutEventId);
    } else {
      // Multiple rounds - find the latest one
      let latestRound: RoundCardDataWithEventId | null = null;
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
            // Tie on round number - use date as tiebreaker (fallback to round name for consistency)
            // Since we can't reliably get created_at here, we'll keep the first one with this round number
            // In practice, this should be rare
          }
        } else {
          // Can't extract round number - use date as fallback
          const roundDate = round.date;
          
          if (latestCreatedAt === null || (roundDate && roundDate > latestCreatedAt)) {
            latestCreatedAt = roundDate;
            latestRound = round;
          }
        }
      }
      
      // If we found a latest round, add it (without event_id)
      if (latestRound) {
        const { event_id, ...roundWithoutEventId } = latestRound;
        filteredStrokePlayRounds.push(roundWithoutEventId);
      }
    }
  }
  
  // Combine filtered stroke play rounds with other rounds
  return [...filteredStrokePlayRounds, ...otherRounds];
}
