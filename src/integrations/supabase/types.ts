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
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
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
          approach_result: Database["public"]["Enums"]["approach_result"] | null
          created_at: string | null
          first_putt_band: Database["public"]["Enums"]["first_putt_band"] | null
          hole_number: number
          id: string
          par: number
          penalties: number | null
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
          approach_result?:
            | Database["public"]["Enums"]["approach_result"]
            | null
          created_at?: string | null
          first_putt_band?:
            | Database["public"]["Enums"]["first_putt_band"]
            | null
          hole_number: number
          id?: string
          par: number
          penalties?: number | null
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
          approach_result?:
            | Database["public"]["Enums"]["approach_result"]
            | null
          created_at?: string | null
          first_putt_band?:
            | Database["public"]["Enums"]["first_putt_band"]
            | null
          hole_number?: number
          id?: string
          par?: number
          penalties?: number | null
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
          updated_at?: string
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
      rounds: {
        Row: {
          course_name: string
          created_at: string | null
          date_played: string
          holes_played: number
          id: string
          tee_set: string | null
          user_id: string
        }
        Insert: {
          course_name: string
          created_at?: string | null
          date_played?: string
          holes_played?: number
          id?: string
          tee_set?: string | null
          user_id: string
        }
        Update: {
          course_name?: string
          created_at?: string | null
          date_played?: string
          holes_played?: number
          id?: string
          tee_set?: string | null
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
          fir_percentage: number | null
          gir_percentage: number | null
          holes_played: number | null
          round_id: string | null
          sand_saves: number | null
          score_vs_par: number | null
          tee_set: string | null
          three_putts: number | null
          total_par: number | null
          total_penalties: number | null
          total_putts: number | null
          total_score: number | null
          updown_percentage: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_group_invite: {
        Args: { invite_code: string }
        Returns: Json
      }
      ensure_friendship: {
        Args: { u1: string; u2: string }
        Returns: undefined
      }
      ensure_friendship_by_pair: {
        Args: { ts?: string; u1: string; u2: string }
        Returns: undefined
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
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          completed_levels: number
          current_difficulty: string
          current_level: string
          display_name: string
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
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          completed_levels: number
          current_difficulty: string
          current_level: string
          display_name: string
          user_id: string
          username: string
        }[]
      }
      get_or_create_drill_by_title: {
        Args: { p_title: string }
        Returns: string
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
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_owner_or_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
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
      approach_bucket: "200+" | "120-200" | "40-120" | "<40"
      approach_result: "GIR" | "MissL" | "MissR" | "Short" | "Long" | "Penalty"
      first_putt_band: "0-2" | "2-7" | "7+"
      friend_status: "pending" | "accepted" | "blocked"
      group_role: "member" | "admin" | "owner"
      tee_result: "FIR" | "MissL" | "MissR" | "Short" | "Long" | "Penalty"
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
      approach_bucket: ["200+", "120-200", "40-120", "<40"],
      approach_result: ["GIR", "MissL", "MissR", "Short", "Long", "Penalty"],
      first_putt_band: ["0-2", "2-7", "7+"],
      friend_status: ["pending", "accepted", "blocked"],
      group_role: ["member", "admin", "owner"],
      tee_result: ["FIR", "MissL", "MissR", "Short", "Long", "Penalty"],
    },
  },
} as const
