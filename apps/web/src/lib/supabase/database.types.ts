// Generated shape of the Supabase schema. Regenerate after changing migrations with `pnpm db:types`.
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
          name: string;
          region_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          region_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          region_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      backblasts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          date: string | null;
          ao: string;
          address: string | null;
          time: string | null;
          q: string;
          introduction: string | null;
          warmup: string | null;
          thang: string | null;
          notes: string | null;
          workout_id: string | null;
          attendees: Json;
          announcements: string | null;
          words_of_wisdom: string | null;
          third_f: string | null;
          second_f: string | null;
          created_at: string;
          status: "draft" | "published";
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id?: string;
          title?: string;
          date?: string | null;
          ao?: string;
          address?: string | null;
          time?: string | null;
          q?: string;
          introduction?: string | null;
          warmup?: string | null;
          thang?: string | null;
          notes?: string | null;
          workout_id?: string | null;
          attendees?: Json;
          announcements?: string | null;
          words_of_wisdom?: string | null;
          third_f?: string | null;
          second_f?: string | null;
          created_at?: string;
          status?: "draft" | "published";
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["backblasts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "backblasts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      section_templates: {
        Row: {
          id: string;
          owner_id: string;
          section: string;
          name: string;
          body: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          section: string;
          name: string;
          body: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["section_templates"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "section_templates_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workouts: {
        Row: {
          id: string;
          author_id: string;
          status: "draft" | "published";
          title: string;
          date: string | null;
          ao: string;
          address: string | null;
          time: string | null;
          introduction: string | null;
          warmup: string | null;
          thang: string | null;
          thangs: Json;
          visibility: "public" | "private";
          reused_from: string | null;
          original_author_id: string | null;
          announcements: string | null;
          words_of_wisdom: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id?: string;
          status?: "draft" | "published";
          title?: string;
          date?: string | null;
          ao?: string;
          address?: string | null;
          time?: string | null;
          introduction?: string | null;
          warmup?: string | null;
          thang?: string | null;
          thangs?: Json;
          visibility?: "public" | "private";
          reused_from?: string | null;
          original_author_id?: string | null;
          announcements?: string | null;
          words_of_wisdom?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workouts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "workouts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workouts_original_author_id_fkey";
            columns: ["original_author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      exicon_entries: {
        Row: {
          id: string;
          name: string;
          description: string;
          aliases: string[];
          tags: string[];
          is_routine: boolean;
          video_url: string | null;
          url: string;
          source: "f3" | "fia" | "region";
          region_id: string | null;
          synced_at: string;
        };
        Insert: Database["public"]["Tables"]["exicon_entries"]["Row"];
        Update: Partial<Database["public"]["Tables"]["exicon_entries"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "exicon_entries_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_exercises: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string;
          tags: string[];
          is_routine: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          description?: string;
          tags?: string[];
          is_routine?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_exercises"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "user_exercises_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_likes: {
        Row: { user_id: string; workout_id: string; created_at: string };
        Insert: { user_id?: string; workout_id: string; created_at?: string };
        Update: Partial<
          Database["public"]["Tables"]["workout_likes"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "workout_likes_workout_id_fkey";
            columns: ["workout_id"];
            isOneToOne: false;
            referencedRelation: "workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_notes: {
        Row: {
          workout_id: string;
          author_id: string;
          body: string;
          updated_at: string;
        };
        Insert: {
          workout_id: string;
          author_id?: string;
          body?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["workout_notes"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "workout_notes_workout_id_fkey";
            columns: ["workout_id"];
            isOneToOne: true;
            referencedRelation: "workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_archives: {
        Row: {
          user_id: string;
          workout_id: string;
          archived_at: string;
        };
        Insert: {
          user_id?: string;
          workout_id: string;
          archived_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["workout_archives"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "workout_archives_workout_id_fkey";
            columns: ["workout_id"];
            isOneToOne: false;
            referencedRelation: "workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      backblast_archives: {
        Row: {
          user_id: string;
          backblast_id: string;
          archived_at: string;
        };
        Insert: {
          user_id?: string;
          backblast_id: string;
          archived_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["backblast_archives"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "backblast_archives_backblast_id_fkey";
            columns: ["backblast_id"];
            isOneToOne: false;
            referencedRelation: "backblasts";
            referencedColumns: ["id"];
          },
        ];
      };
      regions: {
        Row: {
          id: string;
          name: string;
          sheet_id: string;
          language: "f3" | "fia";
          config: Json;
          created_by: string | null;
          created_at: string;
          synced_at: string | null;
          sync_error: string | null;
          latest_post_on: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          sheet_id: string;
          language?: "f3" | "fia";
          config: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["regions"]["Insert"]>;
        Relationships: [];
      };
      region_sites: {
        Row: {
          region_id: string;
          name: string;
          address: string;
          day: string;
          time: string;
        };
        Insert: Database["public"]["Tables"]["region_sites"]["Row"];
        Update: Partial<Database["public"]["Tables"]["region_sites"]["Row"]>;
        Relationships: [];
      };
      region_roster: {
        Row: { region_id: string; name: string };
        Insert: Database["public"]["Tables"]["region_roster"]["Row"];
        Update: Partial<Database["public"]["Tables"]["region_roster"]["Row"]>;
        Relationships: [];
      };
      region_regulars: {
        Row: { region_id: string; ao: string; pax: string; posts: number };
        Insert: Database["public"]["Tables"]["region_regulars"]["Row"];
        Update: Partial<Database["public"]["Tables"]["region_regulars"]["Row"]>;
        Relationships: [];
      };
      region_pax_stats: {
        Row: { region_id: string; pax: string; posts: number; qs: number };
        Insert: Database["public"]["Tables"]["region_pax_stats"]["Row"];
        Update: Partial<
          Database["public"]["Tables"]["region_pax_stats"]["Row"]
        >;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      workout_stats: {
        Args: { p_ids: string[] };
        Returns: {
          workout_id: string;
          likes: number;
          reuses: number;
          liked: boolean;
        }[];
      };
      restore_workout_links: {
        Args: { p_old: string; p_new: string };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
