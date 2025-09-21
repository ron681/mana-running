import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Database types for TypeScript
export interface School {
  id: string
  created_at: string
  name: string
}

export interface Athlete {
  id: string
  created_at: string
  first_name: string
  last_name: string
  graduation_year?: number
  gender?: 'M' | 'F'
  current_school_id?: string
  school?: School
}

export interface Course {
  id: string
  created_at: string
  name: string
  distance_meters: number
  distance_miles: number
  difficulty_rating?: number
  rating_confidence: 'estimated' | 'low' | 'medium' | 'high'
  rating_last_updated: string
  total_results_count: number
}

export interface Meet {
  id: string
  created_at: string
  name: string
  meet_date: string
  course_id?: string
  gender: 'M' | 'F'
  meet_type?: string
  course?: Course
}

export interface Result {
  id: string
  created_at: string
  athlete_id: string
  meet_id: string
  time_seconds: number
  place_overall: number
  place_team?: number
  season_year: number
  athlete?: Athlete
  meet?: Meet
}

export interface SchoolTransfer {
  id: string
  created_at: string
  athlete_id: string
  school_id: string
  start_date: string
  end_date?: string
}

// Helper functions for common queries
export const queries = {
  // Get all schools
  async getSchools() {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('name')
    return { data, error }
  },

  // Get courses with difficulty ratings
  async getCourses() {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('name')
    return { data, error }
  },

  // Get recent results with all details
  async getRecentResults(limit: number = 50) {
    const { data, error } = await supabase
      .from('results_with_details')
      .select('*')
      .order('meet_date', { ascending: false })
      .limit(limit)
    return { data, error }
  },

  // Get athlete results
  async getAthleteResults(athleteId: string) {
    const { data, error } = await supabase
      .from('results_with_details')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('meet_date', { ascending: false })
    return { data, error }
  },

  // Get database stats
  async getStats() {
    const [schoolsRes, athletesRes, coursesRes, resultsRes] = await Promise.all([
      supabase.from('schools').select('id', { count: 'exact', head: true }),
      supabase.from('athletes').select('id', { count: 'exact', head: true }),
      supabase.from('courses').select('id', { count: 'exact', head: true }),
      supabase.from('results').select('id', { count: 'exact', head: true })
    ])

    return {
      schools: schoolsRes.count || 0,
      athletes: athletesRes.count || 0,
      courses: coursesRes.count || 0,
      results: resultsRes.count || 0
    }
  }
}

// Utility functions
export const utils = {
  // Format time from seconds to MM:SS
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  },

  // Convert time string (MM:SS) to seconds
  parseTime(timeString: string): number {
    const [mins, secs] = timeString.split(':').map(Number)
    return mins * 60 + secs
  },

  // Calculate pace per mile
  calculatePace(timeSeconds: number, distanceMiles: number): string {
    const paceSeconds = timeSeconds / distanceMiles
    return this.formatTime(Math.round(paceSeconds))
  }
}