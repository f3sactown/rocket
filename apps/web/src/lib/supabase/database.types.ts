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
        Row: { id: string; name: string; created_at: string };
        Insert: { id: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      backblasts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          date: string;
          ao: string;
          q: string;
          pax: string[];
          fngs: string[];
          warmup: string | null;
          thang: string | null;
          moleskin: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id?: string;
          title: string;
          date: string;
          ao: string;
          q: string;
          pax?: string[];
          fngs?: string[];
          warmup?: string | null;
          thang?: string | null;
          moleskin?: string | null;
          created_at?: string;
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
