export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      best_ball_games: {
        Row: {
          course_id: string | null
          course_name: string
          created_at: string | null
          date_played: string
          event_id: string | null
          final_result: string | null
          game_type: string
          group_id: string | null
          holes_played: number
          holes_remaining: number
          id: string
          is_finished: boolean
          match_status: number
          mulligans_per_player: number | null
          round_name: string | null
          team_a_name: string
          team_a_players: Json
          team_a_total: number
          team_b_name: string
          team_b_players: Json
          team_b_total: number
          use_handicaps: boolean
          user_id: string
          winner_team: string | null
        }
        Insert: {
          course_id?: string | null
          course_name: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          final_result?: string | null
          game_type?: string
          group_id?: string | null
          holes_played?: number
          holes_remaining?: number
          id?: string
          is_finished?: boolean
          match_status?: number
          mulligans_per_player?: number | null
          round_name?: string | null
          team_a_name?: string
          team_a_players?: Json
          team_a_total?: number
          team_b_name?: string
          team_b_players?: Json
          team_b_total?: number
          use_handicaps?: boolean
          user_id: string
          winner_team?: string | null
        }
        Update: {
          course_id?: string | null
          course_name?: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          final_result?: string | null
          game_type?: string
          group_id?: string | null
          holes_played?: number
          holes_remaining?: number
          id?: string
          is_finished?: boolean
          match_status?: number
          mulligans_per_player?: number | null
          round_name?: string | null
          team_a_name?: string
          team_a_players?: Json
          team_a_total?: number
          team_b_name?: string
          team_b_players?: Json
          team_b_total?: number
          use_handicaps?: boolean
          user_id?: string
          winner_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "best_ball_games_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "best_ball_games_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "best_ball_games_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "game_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      best_ball_holes: {
        Row: {
          created_at: string | null
          game_id: string
          hole_number: number
          hole_result: number
          holes_remaining_after: number
          id: string
          match_status_after: number
          par: number
          stroke_index: number | null
          team_a_best_gross: number | null
          team_a_best_net: number | null
          team_a_counting_player: string | null
          team_a_running_total: number
          team_a_scores: Json
          team_b_best_gross: number | null
          team_b_best_net: number | null
          team_b_counting_player: string | null
          team_b_running_total: number
          team_b_scores: Json
        }
        Insert: {
          created_at?: string | null
          game_id: string
          hole_number: number
          hole_result?: number
          holes_remaining_after?: number
          id?: string
          match_status_after?: number
          par?: number
          stroke_index?: number | null
          team_a_best_gross?: number | null
          team_a_best_net?: number | null
          team_a_counting_player?: string | null
          team_a_running_total?: number
          team_a_scores?: Json
          team_b_best_gross?: number | null
          team_b_best_net?: number | null
          team_b_counting_player?: string | null
          team_b_running_total?: number
          team_b_scores?: Json
        }
        Update: {
          created_at?: string | null
          game_id?: string
          hole_number?: number
          hole_result?: number
          holes_remaining_after?: number
          id?: string
          match_status_after?: number
          par?: number
          stroke_index?: number | null
          team_a_best_gross?: number | null
          team_a_best_net?: number | null
          team_a_counting_player?: string | null
          team_a_running_total?: number
          team_a_scores?: Json
          team_b_best_gross?: number | null
          team_b_best_net?: number | null
          team_b_counting_player?: string | null
          team_b_running_total?: number
          team_b_scores?: Json
        }
        Relationships: [
          {
            foreignKeyName: "best_ball_holes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "best_ball_games"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      copenhagen_games: {
        Row: {
          course_id: string | null
          course_name: string
          created_at: string | null
          date_played: string
          event_id: string | null
          group_id: string | null
          holes_played: number
          id: string
          is_finished: boolean
          player_1: string
          player_1_handicap: number | null
          player_1_tee: string | null
          player_1_total_points: number
          player_2: string
          player_2_handicap: number | null
          player_2_tee: string | null
          player_2_total_points: number
          player_3: string
          player_3_handicap: number | null
          player_3_tee: string | null
          player_3_total_points: number
          presses: Json | null
          round_name: string | null
          stake_per_point: number
          tee_set: string | null
          use_handicaps: boolean
          user_id: string
          winner_player: string | null
        }
        Insert: {
          course_id?: string | null
          course_name: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          group_id?: string | null
          holes_played?: number
          id?: string
          is_finished?: boolean
          player_1: string
          player_1_handicap?: number | null
          player_1_tee?: string | null
          player_1_total_points?: number
          player_2: string
          player_2_handicap?: number | null
          player_2_tee?: string | null
          player_2_total_points?: number
          player_3: string
          player_3_handicap?: number | null
          player_3_tee?: string | null
          player_3_total_points?: number
          presses?: Json | null
          round_name?: string | null
          stake_per_point?: number
          tee_set?: string | null
          use_handicaps?: boolean
          user_id: string
          winner_player?: string | null
        }
        Update: {
          course_id?: string | null
          course_name?: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          group_id?: string | null
          holes_played?: number
          id?: string
          is_finished?: boolean
          player_1?: string
          player_1_handicap?: number | null
          player_1_tee?: string | null
          player_1_total_points?: number
          player_2?: string
          player_2_handicap?: number | null
          player_2_tee?: string | null
          player_2_total_points?: number
          player_3?: string
          player_3_handicap?: number | null
          player_3_tee?: string | null
          player_3_total_points?: number
          presses?: Json | null
          round_name?: string | null
          stake_per_point?: number
          tee_set?: string | null
          use_handicaps?: boolean
          user_id?: string
          winner_player?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "copenhagen_games_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copenhagen_games_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copenhagen_games_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "game_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      copenhagen_holes: {
        Row: {
          created_at: string | null
          game_id: string
          hole_number: number
          id: string
          is_sweep: boolean
          par: number
          player_1_gross_score: number | null
          player_1_hole_points: number
          player_1_mulligan: boolean | null
          player_1_net_score: number | null
          player_1_running_total: number
          player_2_gross_score: number | null
          player_2_hole_points: number
          player_2_mulligan: boolean | null
          player_2_net_score: number | null
          player_2_running_total: number
          player_3_gross_score: number | null
          player_3_hole_points: number
          player_3_mulligan: boolean | null
          player_3_net_score: number | null
          player_3_running_total: number
          press_points: Json | null
          stroke_index: number | null
          sweep_winner: number | null
        }
        Insert: {
          created_at?: string | null
          game_id: string
          hole_number: number
          id?: string
          is_sweep?: boolean
          par?: number
          player_1_gross_score?: number | null
          player_1_hole_points?: number
          player_1_mulligan?: boolean | null
          player_1_net_score?: number | null
          player_1_running_total?: number
          player_2_gross_score?: number | null
          player_2_hole_points?: number
          player_2_mulligan?: boolean | null
          player_2_net_score?: number | null
          player_2_running_total?: number
          player_3_gross_score?: number | null
          player_3_hole_points?: number
          player_3_mulligan?: boolean | null
          player_3_net_score?: number | null
          player_3_running_total?: number
          press_points?: Json | null
          stroke_index?: number | null
          sweep_winner?: number | null
        }
        Update: {
          created_at?: string | null
          game_id?: string
          hole_number?: number
          id?: string
          is_sweep?: boolean
          par?: number
          player_1_gross_score?: number | null
          player_1_hole_points?: number
          player_1_mulligan?: boolean | null
          player_1_net_score?: number | null
          player_1_running_total?: number
          player_2_gross_score?: number | null
          player_2_hole_points?: number
          player_2_mulligan?: boolean | null
          player_2_net_score?: number | null
          player_2_running_total?: number
          player_3_gross_score?: number | null
          player_3_hole_points?: number
          player_3_mulligan?: boolean | null
          player_3_net_score?: number | null
          player_3_running_total?: number
          press_points?: Json | null
          stroke_index?: number | null
          sweep_winner?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "copenhagen_holes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "copenhagen_games"
            referencedColumns: ["id"]
          },
        ]
      }
      course_holes: {
        Row: {
          black_distance: number | null
          blue_distance: number | null
          course_id: string
          created_at: string
          gold_distance: number | null
          hole_number: number
          id: string
          orange_distance: number | null
          par: number
          red_distance: number | null
          silver_distance: number | null
          stroke_index: number
          white_distance: number | null
          yellow_distance: number | null
        }
        Insert: {
          black_distance?: number | null
          blue_distance?: number | null
          course_id: string
          created_at?: string
          gold_distance?: number | null
          hole_number: number
          id?: string
          orange_distance?: number | null
          par: number
          red_distance?: number | null
          silver_distance?: number | null
          stroke_index: number
          white_distance?: number | null
          yellow_distance?: number | null
        }
        Update: {
          black_distance?: number | null
          blue_distance?: number | null
          course_id?: string
          created_at?: string
          gold_distance?: number | null
          hole_number?: number
          id?: string
          orange_distance?: number | null
          par?: number
          red_distance?: number | null
          silver_distance?: number | null
          stroke_index?: number
          white_distance?: number | null
          yellow_distance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "course_holes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          tee_names: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          tee_names?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          tee_names?: Json | null
        }
        Relationships: []
      }
      drill_results: {
        Row: {
          attempts_json: Json
          created_at: string | null
          drill_id: string
          id: string
          total_points: number
          user_id: string
        }
        Insert: {
          attempts_json: Json
          created_at?: string | null
          drill_id: string
          id?: string
          total_points: number
          user_id: string
        }
        Update: {
          attempts_json?: Json
          created_at?: string | null
          drill_id?: string
          id?: string
          total_points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drill_results_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drills: {
        Row: {
          created_at: string | null
          id: string
          long_desc: string | null
          lower_is_better: boolean | null
          scoring_scheme: Json | null
          short_desc: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          long_desc?: string | null
          lower_is_better?: boolean | null
          scoring_scheme?: Json | null
          short_desc?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          long_desc?: string | null
          lower_is_better?: boolean | null
          scoring_scheme?: Json | null
          short_desc?: string | null
          title?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          course_id: string | null
          course_name: string | null
          created_at: string | null
          creator_id: string
          date_played: string | null
          game_type: string
          id: string
          name: string
        }
        Insert: {
          course_id?: string | null
          course_name?: string | null
          created_at?: string | null
          creator_id: string
          date_played?: string | null
          game_type: string
          id?: string
          name: string
        }
        Update: {
          course_id?: string | null
          course_name?: string | null
          created_at?: string | null
          creator_id?: string
          date_played?: string | null
          game_type?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee: string | null
          created_at: string | null
          id: string
          requester: string | null
          status: Database["public"]["Enums"]["friend_status"]
          user_a: string | null
          user_b: string | null
        }
        Insert: {
          addressee?: string | null
          created_at?: string | null
          id?: string
          requester?: string | null
          status?: Database["public"]["Enums"]["friend_status"]
          user_a?: string | null
          user_b?: string | null
        }
        Update: {
          addressee?: string | null
          created_at?: string | null
          id?: string
          requester?: string | null
          status?: Database["public"]["Enums"]["friend_status"]
          user_a?: string | null
          user_b?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_fkey"
            columns: ["addressee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_fkey"
            columns: ["requester"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_groups: {
        Row: {
          created_at: string
          event_id: string | null
          game_type: string | null
          group_index: number
          group_name: string
          id: string
          round_id: string | null
          starting_hole: number | null
          tee_time: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          game_type?: string | null
          group_index?: number
          group_name?: string
          id?: string
          round_id?: string | null
          starting_hole?: number | null
          tee_time?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          game_type?: string | null
          group_index?: number
          group_name?: string
          id?: string
          round_id?: string | null
          starting_hole?: number | null
          tee_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_groups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_summaries"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "game_groups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      game_likes: {
        Row: {
          created_at: string
          game_id: string
          game_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          game_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          game_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      group_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          group_id: string
          id: string
          max_uses: number | null
          revoked: boolean
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          group_id: string
          id?: string
          max_uses?: number | null
          revoked?: boolean
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          max_uses?: number | null
          revoked?: boolean
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string | null
          group_id: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_coach_group: boolean
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_coach_group?: boolean
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_coach_group?: boolean
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holes: {
        Row: {
          approach_bucket: Database["public"]["Enums"]["approach_bucket"] | null
          approach_results: string[] | null
          created_at: string | null
          first_putt_band: Database["public"]["Enums"]["first_putt_band"] | null
          hole_number: number
          id: string
          mulligan: boolean
          par: number
          penalties: number | null
          player_id: string | null
          pro_shot_data: Json | null
          putts: number | null
          recovery: boolean | null
          round_id: string
          sand_save: boolean | null
          score: number
          tee_result: Database["public"]["Enums"]["tee_result"] | null
          up_and_down: boolean | null
        }
        Insert: {
          approach_bucket?:
            | Database["public"]["Enums"]["approach_bucket"]
            | null
          approach_results?: string[] | null
          created_at?: string | null
          first_putt_band?:
            | Database["public"]["Enums"]["first_putt_band"]
            | null
          hole_number: number
          id?: string
          mulligan?: boolean
          par: number
          penalties?: number | null
          player_id?: string | null
          pro_shot_data?: Json | null
          putts?: number | null
          recovery?: boolean | null
          round_id: string
          sand_save?: boolean | null
          score: number
          tee_result?: Database["public"]["Enums"]["tee_result"] | null
          up_and_down?: boolean | null
        }
        Update: {
          approach_bucket?:
            | Database["public"]["Enums"]["approach_bucket"]
            | null
          approach_results?: string[] | null
          created_at?: string | null
          first_putt_band?:
            | Database["public"]["Enums"]["first_putt_band"]
            | null
          hole_number?: number
          id?: string
          mulligan?: boolean
          par?: number
          penalties?: number | null
          player_id?: string | null
          pro_shot_data?: Json | null
          putts?: number | null
          recovery?: boolean | null
          round_id?: string
          sand_save?: boolean | null
          score?: number
          tee_result?: Database["public"]["Enums"]["tee_result"] | null
          up_and_down?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "holes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "round_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_summaries"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "holes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      level_progress: {
        Row: {
          attempts: number | null
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          level_id: string
          level_number: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          level_id: string
          level_number?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          level_id?: string
          level_number?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      match_play_games: {
        Row: {
          course_id: string | null
          course_name: string
          created_at: string | null
          date_played: string
          event_id: string | null
          final_result: string | null
          group_id: string | null
          holes_played: number
          holes_remaining: number
          id: string
          is_finished: boolean
          match_status: number
          mulligans_per_player: number | null
          player_1: string
          player_1_handicap: number | null
          player_1_tee: string | null
          player_2: string
          player_2_handicap: number | null
          player_2_tee: string | null
          round_name: string | null
          tee_set: string | null
          use_handicaps: boolean
          user_id: string
          winner_player: string | null
        }
        Insert: {
          course_id?: string | null
          course_name: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          final_result?: string | null
          group_id?: string | null
          holes_played?: number
          holes_remaining?: number
          id?: string
          is_finished?: boolean
          match_status?: number
          mulligans_per_player?: number | null
          player_1: string
          player_1_handicap?: number | null
          player_1_tee?: string | null
          player_2: string
          player_2_handicap?: number | null
          player_2_tee?: string | null
          round_name?: string | null
          tee_set?: string | null
          use_handicaps?: boolean
          user_id: string
          winner_player?: string | null
        }
        Update: {
          course_id?: string | null
          course_name?: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          final_result?: string | null
          group_id?: string | null
          holes_played?: number
          holes_remaining?: number
          id?: string
          is_finished?: boolean
          match_status?: number
          mulligans_per_player?: number | null
          player_1?: string
          player_1_handicap?: number | null
          player_1_tee?: string | null
          player_2?: string
          player_2_handicap?: number | null
          player_2_tee?: string | null
          round_name?: string | null
          tee_set?: string | null
          use_handicaps?: boolean
          user_id?: string
          winner_player?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_play_games_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_play_games_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_play_games_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "game_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      match_play_holes: {
        Row: {
          created_at: string | null
          game_id: string
          hole_number: number
          hole_result: number
          holes_remaining_after: number
          id: string
          match_status_after: number
          par: number
          player_1_gross_score: number | null
          player_1_mulligan: boolean | null
          player_1_net_score: number | null
          player_2_gross_score: number | null
          player_2_mulligan: boolean | null
          player_2_net_score: number | null
          stroke_index: number | null
        }
        Insert: {
          created_at?: string | null
          game_id: string
          hole_number: number
          hole_result?: number
          holes_remaining_after?: number
          id?: string
          match_status_after?: number
          par?: number
          player_1_gross_score?: number | null
          player_1_mulligan?: boolean | null
          player_1_net_score?: number | null
          player_2_gross_score?: number | null
          player_2_mulligan?: boolean | null
          player_2_net_score?: number | null
          stroke_index?: number | null
        }
        Update: {
          created_at?: string | null
          game_id?: string
          hole_number?: number
          hole_result?: number
          holes_remaining_after?: number
          id?: string
          match_status_after?: number
          par?: number
          player_1_gross_score?: number | null
          player_1_mulligan?: boolean | null
          player_1_net_score?: number | null
          player_2_gross_score?: number | null
          player_2_mulligan?: boolean | null
          player_2_net_score?: number | null
          stroke_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_play_holes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "match_play_games"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          related_user_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_id?: string | null
          related_user_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          related_user_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_stats_holes: {
        Row: {
          created_at: string
          hole_number: number
          id: string
          par: number
          pro_round_id: string
          pro_shot_data: Json | null
          putts: number | null
          score: number
        }
        Insert: {
          created_at?: string
          hole_number: number
          id?: string
          par: number
          pro_round_id: string
          pro_shot_data?: Json | null
          putts?: number | null
          score: number
        }
        Update: {
          created_at?: string
          hole_number?: number
          id?: string
          par?: number
          pro_round_id?: string
          pro_shot_data?: Json | null
          putts?: number | null
          score?: number
        }
        Relationships: []
      }
      pro_stats_rounds: {
        Row: {
          course_name: string | null
          created_at: string
          external_round_id: string | null
          holes_played: number
          id: string
          user_id: string
        }
        Insert: {
          course_name?: string | null
          created_at?: string
          external_round_id?: string | null
          holes_played?: number
          id?: string
          user_id: string
        }
        Update: {
          course_name?: string | null
          created_at?: string
          external_round_id?: string | null
          holes_played?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          handicap: string | null
          home_club: string | null
          id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          handicap?: string | null
          home_club?: string | null
          id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          handicap?: string | null
          home_club?: string | null
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      round_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "round_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      round_comment_replies: {
        Row: {
          comment_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_comment_replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "round_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      round_comments: {
        Row: {
          content: string
          created_at: string
          game_id: string | null
          game_type: string
          hole_number: number | null
          id: string
          is_activity_item: boolean | null
          round_id: string
          scorecard_player_id: string | null
          scorecard_player_name: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          game_id?: string | null
          game_type?: string
          hole_number?: number | null
          id?: string
          is_activity_item?: boolean | null
          round_id: string
          scorecard_player_id?: string | null
          scorecard_player_name?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          game_id?: string | null
          game_type?: string
          hole_number?: number | null
          id?: string
          is_activity_item?: boolean | null
          round_id?: string
          scorecard_player_id?: string | null
          scorecard_player_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      round_players: {
        Row: {
          created_at: string
          group_id: string | null
          guest_name: string | null
          handicap: number | null
          id: string
          is_guest: boolean | null
          round_id: string
          starting_hole: number | null
          tee_color: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          guest_name?: string | null
          handicap?: number | null
          id?: string
          is_guest?: boolean | null
          round_id: string
          starting_hole?: number | null
          tee_color?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string | null
          guest_name?: string | null
          handicap?: number | null
          id?: string
          is_guest?: boolean | null
          round_id?: string
          starting_hole?: number | null
          tee_color?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_players_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "game_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_players_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_summaries"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_players_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          course_name: string
          created_at: string | null
          date_played: string
          event_id: string | null
          holes_played: number
          id: string
          origin: string | null
          round_name: string | null
          round_type: string | null
          starting_hole: number | null
          tee_set: string | null
          user_id: string
        }
        Insert: {
          course_name: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          holes_played?: number
          id?: string
          origin?: string | null
          round_name?: string | null
          round_type?: string | null
          starting_hole?: number | null
          tee_set?: string | null
          user_id: string
        }
        Update: {
          course_name?: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          holes_played?: number
          id?: string
          origin?: string | null
          round_name?: string | null
          round_type?: string | null
          starting_hole?: number | null
          tee_set?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      scramble_games: {
        Row: {
          course_id: string | null
          course_name: string
          created_at: string | null
          date_played: string
          event_id: string | null
          group_id: string | null
          holes_played: number
          id: string
          is_finished: boolean
          min_drives_per_player: number | null
          round_name: string | null
          scoring_type: string
          teams: Json
          tee_set: string | null
          use_handicaps: boolean
          user_id: string
          winning_team: string | null
        }
        Insert: {
          course_id?: string | null
          course_name: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          group_id?: string | null
          holes_played?: number
          id?: string
          is_finished?: boolean
          min_drives_per_player?: number | null
          round_name?: string | null
          scoring_type?: string
          teams?: Json
          tee_set?: string | null
          use_handicaps?: boolean
          user_id: string
          winning_team?: string | null
        }
        Update: {
          course_id?: string | null
          course_name?: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          group_id?: string | null
          holes_played?: number
          id?: string
          is_finished?: boolean
          min_drives_per_player?: number | null
          round_name?: string | null
          scoring_type?: string
          teams?: Json
          tee_set?: string | null
          use_handicaps?: boolean
          user_id?: string
          winning_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scramble_games_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scramble_games_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scramble_games_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "game_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      scramble_holes: {
        Row: {
          created_at: string | null
          game_id: string
          hole_number: number
          id: string
          par: number
          stroke_index: number | null
          team_scores: Json
        }
        Insert: {
          created_at?: string | null
          game_id: string
          hole_number: number
          id?: string
          par?: number
          stroke_index?: number | null
          team_scores?: Json
        }
        Update: {
          created_at?: string | null
          game_id?: string
          hole_number?: number
          id?: string
          par?: number
          stroke_index?: number | null
          team_scores?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scramble_holes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "scramble_games"
            referencedColumns: ["id"]
          },
        ]
      }
      skins_games: {
        Row: {
          carryover_enabled: boolean
          course_id: string | null
          course_name: string
          created_at: string | null
          date_played: string
          event_id: string | null
          group_id: string | null
          handicap_mode: string
          holes_played: number
          id: string
          is_finished: boolean
          players: Json
          round_name: string | null
          skin_value: number
          use_handicaps: boolean
          user_id: string
          winner_player: string | null
        }
        Insert: {
          carryover_enabled?: boolean
          course_id?: string | null
          course_name: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          group_id?: string | null
          handicap_mode?: string
          holes_played?: number
          id?: string
          is_finished?: boolean
          players?: Json
          round_name?: string | null
          skin_value?: number
          use_handicaps?: boolean
          user_id: string
          winner_player?: string | null
        }
        Update: {
          carryover_enabled?: boolean
          course_id?: string | null
          course_name?: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          group_id?: string | null
          handicap_mode?: string
          holes_played?: number
          id?: string
          is_finished?: boolean
          players?: Json
          round_name?: string | null
          skin_value?: number
          use_handicaps?: boolean
          user_id?: string
          winner_player?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skins_games_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skins_games_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skins_games_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "game_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      skins_holes: {
        Row: {
          created_at: string | null
          game_id: string
          hole_number: number
          id: string
          is_carryover: boolean
          par: number
          player_scores: Json
          skins_available: number
          stroke_index: number | null
          winner_player: string | null
        }
        Insert: {
          created_at?: string | null
          game_id: string
          hole_number: number
          id?: string
          is_carryover?: boolean
          par?: number
          player_scores?: Json
          skins_available?: number
          stroke_index?: number | null
          winner_player?: string | null
        }
        Update: {
          created_at?: string | null
          game_id?: string
          hole_number?: number
          id?: string
          is_carryover?: boolean
          par?: number
          player_scores?: Json
          skins_available?: number
          stroke_index?: number | null
          winner_player?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skins_holes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "skins_games"
            referencedColumns: ["id"]
          },
        ]
      }
      umbriago_games: {
        Row: {
          course_id: string | null
          course_name: string
          created_at: string | null
          date_played: string
          event_id: string | null
          final_payout: number | null
          group_id: string | null
          holes_played: number
          id: string
          is_finished: boolean
          payout_mode: string
          roll_history: Json | null
          rolls_per_team: number
          round_name: string | null
          stake_per_point: number
          team_a_name: string
          team_a_player_1: string
          team_a_player_2: string
          team_a_total_points: number
          team_b_name: string
          team_b_player_1: string
          team_b_player_2: string
          team_b_total_points: number
          tee_set: string | null
          user_id: string
          winning_team: string | null
        }
        Insert: {
          course_id?: string | null
          course_name: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          final_payout?: number | null
          group_id?: string | null
          holes_played?: number
          id?: string
          is_finished?: boolean
          payout_mode?: string
          roll_history?: Json | null
          rolls_per_team?: number
          round_name?: string | null
          stake_per_point?: number
          team_a_name?: string
          team_a_player_1: string
          team_a_player_2: string
          team_a_total_points?: number
          team_b_name?: string
          team_b_player_1: string
          team_b_player_2: string
          team_b_total_points?: number
          tee_set?: string | null
          user_id: string
          winning_team?: string | null
        }
        Update: {
          course_id?: string | null
          course_name?: string
          created_at?: string | null
          date_played?: string
          event_id?: string | null
          final_payout?: number | null
          group_id?: string | null
          holes_played?: number
          id?: string
          is_finished?: boolean
          payout_mode?: string
          roll_history?: Json | null
          rolls_per_team?: number
          round_name?: string | null
          stake_per_point?: number
          team_a_name?: string
          team_a_player_1?: string
          team_a_player_2?: string
          team_a_total_points?: number
          team_b_name?: string
          team_b_player_1?: string
          team_b_player_2?: string
          team_b_total_points?: number
          tee_set?: string | null
          user_id?: string
          winning_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umbriago_games_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umbriago_games_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umbriago_games_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "game_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      umbriago_holes: {
        Row: {
          birdie_eagle_winner: string | null
          closest_to_pin_winner: string | null
          created_at: string | null
          double_back_called: boolean | null
          double_called_by: string | null
          game_id: string
          hole_number: number
          id: string
          individual_low_winner: string | null
          is_umbriago: boolean
          multiplier: number
          par: number
          team_a_hole_points: number
          team_a_player_1_score: number | null
          team_a_player_2_score: number | null
          team_a_running_total: number
          team_b_hole_points: number
          team_b_player_1_score: number | null
          team_b_player_2_score: number | null
          team_b_running_total: number
          team_low_winner: string | null
        }
        Insert: {
          birdie_eagle_winner?: string | null
          closest_to_pin_winner?: string | null
          created_at?: string | null
          double_back_called?: boolean | null
          double_called_by?: string | null
          game_id: string
          hole_number: number
          id?: string
          individual_low_winner?: string | null
          is_umbriago?: boolean
          multiplier?: number
          par?: number
          team_a_hole_points?: number
          team_a_player_1_score?: number | null
          team_a_player_2_score?: number | null
          team_a_running_total?: number
          team_b_hole_points?: number
          team_b_player_1_score?: number | null
          team_b_player_2_score?: number | null
          team_b_running_total?: number
          team_low_winner?: string | null
        }
        Update: {
          birdie_eagle_winner?: string | null
          closest_to_pin_winner?: string | null
          created_at?: string | null
          double_back_called?: boolean | null
          double_called_by?: string | null
          game_id?: string
          hole_number?: number
          id?: string
          individual_low_winner?: string | null
          is_umbriago?: boolean
          multiplier?: number
          par?: number
          team_a_hole_points?: number
          team_a_player_1_score?: number | null
          team_a_player_2_score?: number | null
          team_a_running_total?: number
          team_b_hole_points?: number
          team_b_player_1_score?: number | null
          team_b_player_2_score?: number | null
          team_b_running_total?: number
          team_low_winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umbriago_holes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "umbriago_games"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string
          drill_category: string
          drill_id: string
          drill_title: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drill_category: string
          drill_id: string
          drill_title: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          drill_category?: string
          drill_id?: string
          drill_title?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          favourite_group_ids: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          favourite_group_ids?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          favourite_group_ids?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wolf_games: {
        Row: {
          course_id: string | null
          course_name: string
          created_at: string | null
          date_played: string
          double_enabled: boolean
          event_id: string | null
          group_id: string | null
          holes_played: number
          id: string
          is_finished: boolean
          lone_wolf_loss_points: number
          lone_wolf_win_points: number
          player_1: string
          player_1_points: number
          player_2: string
          player_2_points: number
          player_3: string
          player_3_points: number
          player_4: string | null
          player_4_points: number
          player_5: string | null
          player_5_points: number
          player_6: string | null
          player_6_points: number
          roll_history: Json | null
          rolls_per_player: number
          round_name: string | null
          team_win_points: number
          user_id: string
          winner_player: string | null
          wolf_position: string
        }
        Insert: {
          course_id?: string | null
          course_name: string
          created_at?: string | null
          date_played?: string
          double_enabled?: boolean
          event_id?: string | null
          group_id?: string | null
          holes_played?: number
          id?: string
          is_finished?: boolean
          lone_wolf_loss_points?: number
          lone_wolf_win_points?: number
          player_1: string
          player_1_points?: number
          player_2: string
          player_2_points?: number
          player_3: string
          player_3_points?: number
          player_4?: string | null
          player_4_points?: number
          player_5?: string | null
          player_5_points?: number
          player_6?: string | null
          player_6_points?: number
          roll_history?: Json | null
          rolls_per_player?: number
          round_name?: string | null
          team_win_points?: number
          user_id: string
          winner_player?: string | null
          wolf_position?: string
        }
        Update: {
          course_id?: string | null
          course_name?: string
          created_at?: string | null
          date_played?: string
          double_enabled?: boolean
          event_id?: string | null
          group_id?: string | null
          holes_played?: number
          id?: string
          is_finished?: boolean
          lone_wolf_loss_points?: number
          lone_wolf_win_points?: number
          player_1?: string
          player_1_points?: number
          player_2?: string
          player_2_points?: number
          player_3?: string
          player_3_points?: number
          player_4?: string | null
          player_4_points?: number
          player_5?: string | null
          player_5_points?: number
          player_6?: string | null
          player_6_points?: number
          roll_history?: Json | null
          rolls_per_player?: number
          round_name?: string | null
          team_win_points?: number
          user_id?: string
          winner_player?: string | null
          wolf_position?: string
        }
        Relationships: [
          {
            foreignKeyName: "wolf_games_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wolf_games_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wolf_games_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "game_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      wolf_holes: {
        Row: {
          created_at: string | null
          double_back_called: boolean | null
          double_called_by: number | null
          game_id: string
          hole_number: number
          id: string
          multiplier: number
          par: number
          partner_player: number | null
          player_1_hole_points: number
          player_1_running_total: number
          player_1_score: number | null
          player_2_hole_points: number
          player_2_running_total: number
          player_2_score: number | null
          player_3_hole_points: number
          player_3_running_total: number
          player_3_score: number | null
          player_4_hole_points: number
          player_4_running_total: number
          player_4_score: number | null
          player_5_hole_points: number
          player_5_running_total: number
          player_5_score: number | null
          player_6_hole_points: number
          player_6_running_total: number
          player_6_score: number | null
          winning_side: string | null
          wolf_choice: string | null
          wolf_player: number
        }
        Insert: {
          created_at?: string | null
          double_back_called?: boolean | null
          double_called_by?: number | null
          game_id: string
          hole_number: number
          id?: string
          multiplier?: number
          par?: number
          partner_player?: number | null
          player_1_hole_points?: number
          player_1_running_total?: number
          player_1_score?: number | null
          player_2_hole_points?: number
          player_2_running_total?: number
          player_2_score?: number | null
          player_3_hole_points?: number
          player_3_running_total?: number
          player_3_score?: number | null
          player_4_hole_points?: number
          player_4_running_total?: number
          player_4_score?: number | null
          player_5_hole_points?: number
          player_5_running_total?: number
          player_5_score?: number | null
          player_6_hole_points?: number
          player_6_running_total?: number
          player_6_score?: number | null
          winning_side?: string | null
          wolf_choice?: string | null
          wolf_player: number
        }
        Update: {
          created_at?: string | null
          double_back_called?: boolean | null
          double_called_by?: number | null
          game_id?: string
          hole_number?: number
          id?: string
          multiplier?: number
          par?: number
          partner_player?: number | null
          player_1_hole_points?: number
          player_1_running_total?: number
          player_1_score?: number | null
          player_2_hole_points?: number
          player_2_running_total?: number
          player_2_score?: number | null
          player_3_hole_points?: number
          player_3_running_total?: number
          player_3_score?: number | null
          player_4_hole_points?: number
          player_4_running_total?: number
          player_4_score?: number | null
          player_5_hole_points?: number
          player_5_running_total?: number
          player_5_score?: number | null
          player_6_hole_points?: number
          player_6_running_total?: number
          player_6_score?: number | null
          winning_side?: string | null
          wolf_choice?: string | null
          wolf_player?: number
        }
        Relationships: [
          {
            foreignKeyName: "wolf_holes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "wolf_games"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      friends_pairs: {
        Row: {
          a: string | null
          b: string | null
        }
        Relationships: []
      }
      round_summaries: {
        Row: {
          course_name: string | null
          date_played: string | null
          fairways_hit: number | null
          fir_percentage: number | null
          gir_percentage: number | null
          greens_hit: number | null
          holes_played: number | null
          missed_greens: number | null
          par4_and_5_count: number | null
          round_id: string | null
          sand_saves: number | null
          score_vs_par: number | null
          tee_set: string | null
          three_putts: number | null
          total_par: number | null
          total_penalties: number | null
          total_putts: number | null
          total_score: number | null
          up_and_downs: number | null
          updown_percentage: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_group_invite: { Args: { invite_code: string }; Returns: Json }
      conversations_overview: {
        Args: never
        Returns: {
          group_id: string
          id: string
          last_message: string
          last_message_time: string
          name: string
          other_user_id: string
          type: string
          updated_at: string
        }[]
      }
      ensure_friend_conversation: {
        Args: { friend_id: string }
        Returns: string
      }
      ensure_friendship: {
        Args: { u1: string; u2: string }
        Returns: undefined
      }
      ensure_friendship_by_pair: {
        Args: { ts?: string; u1: string; u2: string }
        Returns: undefined
      }
      ensure_group_conversation: {
        Args: { p_group_id: string }
        Returns: string
      }
      favourite_group_leaderboard_for_drill_by_title: {
        Args: { p_drill_title: string }
        Returns: {
          avatar_url: string
          best_score: number
          display_name: string
          user_id: string
          username: string
        }[]
      }
      favourite_groups_level_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          category: string
          completed_levels: number
          display_name: string
          highest_level: number
          user_id: string
          username: string
        }[]
      }
      friends_leaderboard_for_drill_by_title: {
        Args: { p_drill_title: string }
        Returns: {
          avatar_url: string
          best_score: number
          display_name: string
          user_id: string
          username: string
        }[]
      }
      friends_level_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          category: string
          completed_levels: number
          display_name: string
          highest_level: number
          user_id: string
          username: string
        }[]
      }
      get_or_create_drill_by_title: {
        Args: { p_title: string }
        Returns: string
      }
      get_public_profile: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          country: string
          display_name: string
          handicap: string
          home_club: string
          id: string
          username: string
        }[]
      }
      global_leaderboard_for_drill: {
        Args: { p_drill_title: string }
        Returns: {
          best_score: number
          display_name: string
          rank: number
          user_id: string
          username: string
        }[]
      }
      group_level_leaderboard: {
        Args: { p_group_id: string }
        Returns: {
          avatar_url: string
          category: string
          completed_levels: number
          display_name: string
          highest_level: number
          user_id: string
          username: string
        }[]
      }
      is_event_creator: { Args: { _event_id: string }; Returns: boolean }
      is_friend_of_round_participant: {
        Args: { _round_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_owner_or_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_round_participant: {
        Args: { _round_id: string; _user_id: string }
        Returns: boolean
      }
      normalized_friendship_pair: {
        Args: { a: string; b: string }
        Returns: string[]
      }
      search_profiles: {
        Args: { max_results?: number; q: string }
        Returns: {
          avatar_url: string
          country: string
          display_name: string
          id: string
          username: string
        }[]
      }
      top3_favourite_group_for_drill: {
        Args: { p_drill: string }
        Returns: {
          best_score: number
          display_name: string
          user_id: string
          username: string
        }[]
      }
      top3_favourite_group_for_drill_by_title: {
        Args: { p_drill_title: string }
        Returns: {
          best_score: number
          display_name: string
          user_id: string
          username: string
        }[]
      }
      top3_friends_for_drill: {
        Args: { p_drill: string }
        Returns: {
          best_score: number
          display_name: string
          user_id: string
          username: string
        }[]
      }
      top3_friends_for_drill_by_title: {
        Args: { p_drill_title: string }
        Returns: {
          best_score: number
          display_name: string
          user_id: string
          username: string
        }[]
      }
    }
    Enums: {
      approach_bucket:
        | "<40m"
        | "40-80m"
        | "80-120m"
        | "120-160"
        | "160-200"
        | "200+"
      approach_result: "GIR" | "MissL" | "MissR" | "Short" | "Long" | "Penalty"
      first_putt_band: "0-2" | "2-7" | "7+"
      friend_status: "pending" | "accepted" | "blocked"
      group_role: "member" | "admin" | "owner" | "coach"
      tee_result: "FIR" | "MissL" | "MissR" | "Water" | "OOB"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approach_bucket: [
        "<40m",
        "40-80m",
        "80-120m",
        "120-160",
        "160-200",
        "200+",
      ],
      approach_result: ["GIR", "MissL", "MissR", "Short", "Long", "Penalty"],
      first_putt_band: ["0-2", "2-7", "7+"],
      friend_status: ["pending", "accepted", "blocked"],
      group_role: ["member", "admin", "owner", "coach"],
      tee_result: ["FIR", "MissL", "MissR", "Water", "OOB"],
    },
  },
} as const
