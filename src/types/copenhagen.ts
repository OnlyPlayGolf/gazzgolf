// Copenhagen (6-Point) game types

export interface CopenhagenGame {
  id: string;
  user_id: string;
  course_name: string;
  course_id?: string | null;
  tee_set: string | null;
  holes_played: number;
  date_played: string;
  created_at: string;
  
  player_1: string;
  player_2: string;
  player_3: string;
  
  player_1_handicap: number | null;
  player_2_handicap: number | null;
  player_3_handicap: number | null;
  
  player_1_tee: string | null;
  player_2_tee: string | null;
  player_3_tee: string | null;
  
  use_handicaps: boolean;
  
  player_1_total_points: number;
  player_2_total_points: number;
  player_3_total_points: number;
  
  is_finished: boolean;
  winner_player: string | null;
}

export interface CopenhagenHole {
  id: string;
  game_id: string;
  hole_number: number;
  par: number;
  stroke_index: number | null;
  created_at: string;
  
  player_1_gross_score: number | null;
  player_2_gross_score: number | null;
  player_3_gross_score: number | null;
  
  player_1_net_score: number | null;
  player_2_net_score: number | null;
  player_3_net_score: number | null;
  
  player_1_hole_points: number;
  player_2_hole_points: number;
  player_3_hole_points: number;
  
  player_1_running_total: number;
  player_2_running_total: number;
  player_3_running_total: number;
  
  is_sweep: boolean;
  sweep_winner: number | null; // 1, 2, or 3
}

export interface CopenhagenSetupData {
  course_name: string;
  course_id?: string;
  tee_set: string;
  holes_played: number;
  player_1: string;
  player_2: string;
  player_3: string;
  player_1_handicap?: number;
  player_2_handicap?: number;
  player_3_handicap?: number;
  player_1_tee?: string;
  player_2_tee?: string;
  player_3_tee?: string;
  use_handicaps: boolean;
}

export interface PlayerScore {
  grossScore: number;
  netScore: number;
  playerIndex: number; // 1, 2, or 3
}

export interface HoleResult {
  player1Points: number;
  player2Points: number;
  player3Points: number;
  isSweep: boolean;
  sweepWinner: number | null;
}
