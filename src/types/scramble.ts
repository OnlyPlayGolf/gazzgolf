export interface ScrambleTeam {
  id: string;
  name: string;
  players: ScramblePlayer[];
}

export interface ScramblePlayer {
  id: string;
  name: string;
  handicap?: number | null;
  tee?: string;
  isGuest?: boolean;
  userId?: string;
}

export interface ScrambleGame {
  id: string;
  user_id: string;
  course_name: string;
  course_id?: string | null;
  tee_set: string | null;
  holes_played: number;
  date_played: string;
  created_at: string;
  round_name?: string | null;
  
  teams: ScrambleTeam[];
  
  min_drives_per_player: number | null;
  use_handicaps: boolean;
  scoring_type: 'gross' | 'net';
  stats_mode?: string | null;
  
  is_finished: boolean;
  winning_team: string | null;
}

export interface ScrambleHole {
  id: string;
  game_id: string;
  hole_number: number;
  par: number;
  stroke_index: number | null;
  created_at: string;
  
  team_scores: Record<string, number | null>; // teamId -> score (null means not holed/"-")
}

export interface ScrambleSetupData {
  course_name: string;
  course_id?: string;
  tee_set: string;
  holes_played: number;
  teams: ScrambleTeam[];
  min_drives_per_player: number | null;
  use_handicaps: boolean;
  scoring_type: 'gross' | 'net';
}
