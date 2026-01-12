export interface WolfGame {
  id: string;
  user_id: string;
  course_name: string;
  course_id?: string | null;
  round_name?: string | null;
  holes_played: number;
  date_played: string;
  created_at: string;
  
  // Players (4-6 players, order is tee-off order)
  player_1: string;
  player_2: string;
  player_3: string;
  player_4: string | null;
  player_5: string | null;
  player_6: string | null;
  
  // Points settings
  lone_wolf_win_points: number;
  lone_wolf_loss_points: number;
  team_win_points: number;
  
  // Wolf goes first or last
  wolf_position: 'first' | 'last';
  
  // Double option
  double_enabled: boolean;
  
  // Stats tracking
  stats_mode?: string | null;
  
  // Player scores (running totals)
  player_1_points: number;
  player_2_points: number;
  player_3_points: number;
  player_4_points: number;
  player_5_points: number;
  player_6_points: number;
  
  is_finished: boolean;
  winner_player: string | null;
}

export interface WolfHole {
  id: string;
  game_id: string;
  hole_number: number;
  created_at: string;
  
  par: number;
  
  // Who is the wolf this hole
  wolf_player: number; // 1-6, which player is wolf
  
  // Wolf's choice
  wolf_choice: 'lone' | 'partner' | null;
  partner_player: number | null; // 1-6, which player wolf chose as partner
  
  // Double/press
  multiplier: number;
  double_called_by: number | null; // Player number who doubled first
  double_back_called: boolean; // Whether opponent doubled back
  
  // Scores for each player
  player_1_score: number | null;
  player_2_score: number | null;
  player_3_score: number | null;
  player_4_score: number | null;
  player_5_score: number | null;
  player_6_score: number | null;
  
  // Points earned this hole
  player_1_hole_points: number;
  player_2_hole_points: number;
  player_3_hole_points: number;
  player_4_hole_points: number;
  player_5_hole_points: number;
  player_6_hole_points: number;
  
  // Running totals
  player_1_running_total: number;
  player_2_running_total: number;
  player_3_running_total: number;
  player_4_running_total: number;
  player_5_running_total: number;
  player_6_running_total: number;
  
  // Winning side
  winning_side: 'wolf' | 'opponents' | 'tie' | null;
}

export interface WolfSettings {
  lone_wolf_win_points: number;
  lone_wolf_loss_points: number;
  team_win_points: number;
  wolf_position: 'first' | 'last';
}
