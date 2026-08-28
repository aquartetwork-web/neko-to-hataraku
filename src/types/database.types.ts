export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          user_id: string;
          app_name: string;
          timezone: string;
          daily_minimum_minutes: number;
          daily_target_minutes: number;
          weekly_target_minutes: number;
          cat_name: string;
          cat_variant: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          app_name?: string;
          timezone?: string;
          daily_minimum_minutes?: number;
          daily_target_minutes?: number;
          weekly_target_minutes?: number;
          cat_name?: string;
          cat_variant?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          app_name?: string;
          timezone?: string;
          daily_minimum_minutes?: number;
          daily_target_minutes?: number;
          weekly_target_minutes?: number;
          cat_name?: string;
          cat_variant?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color_key: Database["public"]["Enums"]["category_color"];
          sort_order: number;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          color_key?: Database["public"]["Enums"]["category_color"];
          sort_order?: number;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color_key?: Database["public"]["Enums"]["category_color"];
          sort_order?: number;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      todos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          scheduled_for: string;
          category_id: string | null;
          status: Database["public"]["Enums"]["todo_status"];
          sort_order: number;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          scheduled_for: string;
          category_id?: string | null;
          status?: Database["public"]["Enums"]["todo_status"];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          scheduled_for?: string;
          category_id?: string | null;
          status?: Database["public"]["Enums"]["todo_status"];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      work_sessions: {
        Row: {
          id: string;
          user_id: string;
          work_date: string;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          work_date: string;
          started_at: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          work_date?: string;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      work_segments: {
        Row: {
          id: string;
          user_id: string;
          work_session_id: string;
          category_id: string | null;
          todo_id: string | null;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          work_session_id: string;
          category_id?: string | null;
          todo_id?: string | null;
          started_at: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          work_session_id?: string;
          category_id?: string | null;
          todo_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      break_segments: {
        Row: {
          id: string;
          user_id: string;
          work_session_id: string;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          work_session_id: string;
          started_at: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          work_session_id?: string;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_notes: {
        Row: {
          id: string;
          user_id: string;
          note_date: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          note_date: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          note_date?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      get_work_timer_state: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      pause_work: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      resume_work: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      reorder_todos: {
        Args: {
          p_todo_ids: string[];
        };
        Returns: undefined;
      };
      start_work: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      start_or_switch_work: {
        Args: {
          p_category_id?: string | null;
          p_todo_id?: string | null;
        };
        Returns: string;
      };
      stop_work: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      toggle_work_via_nfc: {
        Args: {
          p_device_token: string;
          p_event_id: string;
          p_tag_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      category_color: "main" | "cyan" | "yellow" | "pink" | "purple" | "gray";
      todo_status: "todo" | "doing" | "done";
    };
    CompositeTypes: Record<never, never>;
  };
};
