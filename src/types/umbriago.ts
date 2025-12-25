export interface UmbriagioGame {
  id: string;
  user_id: string;
  course_name: string;
  course_id?: string | null;
  tee_set: string | null;
  holes_played: number;
  date_played: string;
  created_at: string;
  round_name?: string | null;
  
  team_a_name: string;
  team_b_name: string;
  team_a_player_1: string;
  team_a_player_2: string;
  team_b_player_1: string;
  team_b_player_2: string;
  
  stake_per_point: number;
  payout_mode: 'difference' | 'total';
  
  team_a_total_points: number;
  team_b_total_points: number;
  
  rolls_per_team: number;
  roll_history: RollEvent[];
  
  is_finished: boolean;
  winning_team: 'A' | 'B' | 'TIE' | null;
  final_payout: number | null;
}

export interface UmbriagioHole {
  id: string;
  game_id: string;
  hole_number: number;
  created_at: string;
  
  team_a_player_1_score: number | null;
  team_a_player_2_score: number | null;
  team_b_player_1_score: number | null;
  team_b_player_2_score: number | null;
  
  par: number;
  
  team_low_winner: 'A' | 'B' | null;
  individual_low_winner: 'A' | 'B' | null;
  closest_to_pin_winner: 'A' | 'B' | null;
  birdie_eagle_winner: 'A' | 'B' | null;
  
  multiplier: 1 | 2 | 4;
  double_called_by: 'A' | 'B' | null;
  double_back_called: boolean;
  
  is_umbriago: boolean;
  team_a_hole_points: number;
  team_b_hole_points: number;
  
  team_a_running_total: number;
  team_b_running_total: number;
}

export interface RollEvent {
  team: 'A' | 'B';
  hole: number;
  points_before: number;
  points_after: number;
}

export interface UmbriagioSetup {
  course_name: string;
  tee_set: string;
  holes_played: number;
  team_a_player_1: string;
  team_a_player_2: string;
  team_b_player_1: string;
  team_b_player_2: string;
  stake_per_point: number;
  payout_mode: 'difference' | 'total';
}
