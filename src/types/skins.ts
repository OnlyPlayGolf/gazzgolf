export interface SkinsPlayer {
  name: string;
  handicap: number | null;
  tee: string | null;
  group_name: string;
}

export interface SkinsPlayerScore {
  gross: number;
  net: number;
}

export interface SkinsGame {
  id: string;
  user_id: string;
  course_id: string | null;
  course_name: string;
  date_played: string;
  holes_played: number;
  skin_value: number;
  carryover_enabled: boolean;
  use_handicaps: boolean;
  handicap_mode: 'gross' | 'net';
  is_finished: boolean;
  players: SkinsPlayer[];
  winner_player: string | null;
  created_at: string;
}

export interface SkinsHole {
  id: string;
  game_id: string;
  hole_number: number;
  par: number;
  stroke_index: number | null;
  player_scores: Record<string, SkinsPlayerScore>;
  skins_available: number;
  winner_player: string | null;
  is_carryover: boolean;
  created_at: string;
}

export interface SkinsLeaderboardEntry {
  playerName: string;
  groupName: string;
  skinsWon: number;
  totalValue: number;
  holesWon: number[];
}
