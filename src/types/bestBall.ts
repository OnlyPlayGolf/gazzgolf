// Best Ball game types

export interface BestBallPlayer {
  odId: string;
  displayName: string;
  handicap?: number;
  teeColor?: string;
  isTemporary?: boolean;
}

export interface BestBallPlayerScore {
  playerId: string;
  playerName: string;
  grossScore: number | null;
  netScore: number | null;
  handicapStrokes: number;
}

export interface BestBallGame {
  id: string;
  user_id: string;
  course_id: string | null;
  course_name: string;
  date_played: string;
  holes_played: number;
  created_at: string;
  game_type: 'match';
  team_a_name: string;
  team_a_players: BestBallPlayer[];
  team_b_name: string;
  team_b_players: BestBallPlayer[];
  use_handicaps: boolean;
  team_a_total: number;
  team_b_total: number;
  match_status: number;
  holes_remaining: number;
  is_finished: boolean;
  winner_team: 'A' | 'B' | 'TIE' | null;
  final_result: string | null;
}

export interface BestBallHole {
  id: string;
  game_id: string;
  hole_number: number;
  par: number;
  stroke_index: number | null;
  created_at: string;
  team_a_scores: BestBallPlayerScore[];
  team_b_scores: BestBallPlayerScore[];
  team_a_best_gross: number | null;
  team_a_best_net: number | null;
  team_a_counting_player: string | null;
  team_b_best_gross: number | null;
  team_b_best_net: number | null;
  team_b_counting_player: string | null;
  team_a_running_total: number;
  team_b_running_total: number;
  hole_result: number;
  match_status_after: number;
  holes_remaining_after: number;
}
