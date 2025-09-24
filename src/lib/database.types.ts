export interface Database {
  public: {
    Tables: {
      athletes: {
        Row: {
          id: string
          created_at: string
          first_name: string
          last_name: string
          graduation_year: number
          gender: string
          current_school_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          first_name: string
          last_name: string
          graduation_year: number
          gender: string
          current_school_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          first_name?: string
          last_name?: string
          graduation_year?: number
          gender?: string
          current_school_id?: string | null
        }
      }
      courses: {
        Row: {
          id: string
          created_at: string
          name: string
          distance_meters: number
          distance_miles: number
          difficulty_rating: number | null
          rating: number | null
          rating_confidence: string | null
          rating_last_updated: string | null
          total_results_count: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          distance_meters: number
          distance_miles: number
          difficulty_rating?: number | null
          rating?: number | null
          rating_confidence?: string | null
          rating_last_updated?: string | null
          total_results_count?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          distance_meters?: number
          distance_miles?: number
          difficulty_rating?: number | null
          rating?: number | null
          rating_confidence?: string | null
          rating_last_updated?: string | null
          total_results_count?: number | null
        }
      }
      meets: {
        Row: {
          id: string
          created_at: string
          name: string
          meet_date: string
          meet_type: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          meet_date: string
          meet_type?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          meet_date?: string
          meet_type?: string | null
        }
      }
      races: {
        Row: {
          id: string
          created_at: string
          meet_id: string
          name: string
          category: string
          gender: string
          course_id: string | null
          start_time: string | null
          results_finalized: boolean | null
          total_participants: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          meet_id: string
          name: string
          category: string
          gender: string
          course_id?: string | null
          start_time?: string | null
          results_finalized?: boolean | null
          total_participants?: number | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          meet_id?: string
          name?: string
          category?: string
          gender?: string
          course_id?: string | null
          start_time?: string | null
          results_finalized?: boolean | null
          total_participants?: number | null
          notes?: string | null
        }
      }
      results: {
        Row: {
          id: string
          created_at: string
          athlete_id: string
          meet_id: string
          race_id: string | null
          time_seconds: number
          place_overall: number | null
          place_team: number | null
          season_year: number
        }
        Insert: {
          id?: string
          created_at?: string
          athlete_id: string
          meet_id: string
          race_id?: string | null
          time_seconds: number
          place_overall?: number | null
          place_team?: number | null
          season_year: number
        }
        Update: {
          id?: string
          created_at?: string
          athlete_id?: string
          meet_id?: string
          race_id?: string | null
          time_seconds?: number
          place_overall?: number | null
          place_team?: number | null
          season_year?: number
        }
      }
      schools: {
        Row: {
          id: string
          created_at: string
          name: string
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
        }
      }
    }
    Views: {
      results_with_details: {
        Row: {
          id: string
          athlete_id: string
          meet_id: string
          race_id: string | null
          time_seconds: number
          time_in_seconds: number
          place_overall: number | null
          place_team: number | null
          season_year: number
          created_at: string
          athlete_name: string
          first_name: string
          last_name: string
          graduation_year: number
          athlete_gender: string
          school_name: string | null
          school_id: string | null
          meet_name: string
          meet_date: string
          meet_type: string | null
          race_name: string | null
          race_category: string | null
          race_gender: string | null
          total_participants: number | null
          course_name: string | null
          distance_meters: number | null
          distance_miles: number | null
          difficulty_rating: number | null
          rating: number | null
          rating_confidence: string | null
          rating_last_updated: string | null
          total_results_count: number | null
        }
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type Athlete = Tables<'athletes'>
export type Course = Tables<'courses'>
export type Meet = Tables<'meets'>
export type Race = Tables<'races'>
export type Result = Tables<'results'>
export type School = Tables<'schools'>
export type ResultWithDetails = Database['public']['Views']['results_with_details']['Row']