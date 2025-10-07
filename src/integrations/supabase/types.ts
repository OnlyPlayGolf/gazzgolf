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
          scoring_scheme: Json | null
          short_desc: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          long_desc?: string | null
          scoring_scheme?: Json | null
          short_desc?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          long_desc?: string | null
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
      user_settings: {
        Row: {
          favourite_group_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          favourite_group_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          favourite_group_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_favourite_group_id_fkey"
            columns: ["favourite_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
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
      friend_status: "pending" | "accepted" | "blocked"
      group_role: "member" | "admin" | "owner"
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
      friend_status: ["pending", "accepted", "blocked"],
      group_role: ["member", "admin", "owner"],
    },
  },
} as const
