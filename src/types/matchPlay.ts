export interface MatchPlayGame {
  id: string;
  user_id: string;
  course_name: string;
  course_id?: string | null;
  event_id?: string | null;
  group_id?: string | null;
  tee_set: string | null;
  holes_played: number;
  date_played: string;
  created_at: string;
  round_name?: string | null;
  
  player_1: string;
  player_1_handicap?: number | null;
  player_1_tee?: string | null;
  
  player_2: string;
  player_2_handicap?: number | null;
  player_2_tee?: string | null;
  
  use_handicaps: boolean;
  mulligans_per_player?: number;
  
  match_status: number; // positive = player 1 up, negative = player 2 up, 0 = all square
  holes_remaining: number;
  
  is_finished: boolean;
  winner_player: string | null;
  final_result: string | null; // e.g. "3 & 2", "1 Up", "All Square"
}

export interface MatchPlayHole {
  id: string;
  game_id: string;
  hole_number: number;
  created_at: string;
  
  par: number;
  stroke_index?: number | null;
  
  player_1_gross_score: number | null;
  player_1_net_score: number | null;
  player_2_gross_score: number | null;
  player_2_net_score: number | null;
  
  player_1_mulligan?: boolean;
  player_2_mulligan?: boolean;
  
  hole_result: number; // 1 = player 1 won, -1 = player 2 won, 0 = halved
  
  match_status_after: number;
  holes_remaining_after: number;
}

export interface MatchPlaySetup {
  course_name: string;
  course_id?: string;
  tee_set?: string;
  holes_played: number;
  player_1: string;
  player_1_handicap?: number;
  player_2: string;
  player_2_handicap?: number;
  use_handicaps: boolean;
}
