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
        Relationships: [];
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
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
