// src/lib/schema-compatibility.ts
// Compatibility layer for schema changes

import { supabase } from './supabase';

/**
 * Athlete name compatibility - handle first_name/last_name vs name field
 */
export function getAthleteFullName(athlete: any): string {
  // Handle both schemas: new (first_name/last_name) and old (name)
  if (athlete.first_name || athlete.last_name) {
    return `${athlete.first_name || ''} ${athlete.last_name || ''}`.trim();
  }
  return athlete.name || athlete.athlete_name || 'Unknown Athlete';
}

/**
 * Results field compatibility - handle place field variations
 */
export function getResultPlace(result: any): number | null {
  return result.place_overall || result.place || null;
}

export function getResultTeamPlace(result: any): number | null {
  return result.place_team || result.team_place || null;
}

/**
 * Course rating compatibility - handle rating vs xc_time_rating
 */
export function getCourseXCRating(course: any): number {
  // Prefer xc_time_rating, fallback to rating, then default
return course.xc_time_rating || 1.0;
}

export function getCourseMileDifficulty(course: any): number {
  return course.mile_difficulty || 1.15; // Default medium difficulty
}

/**
 * Updated athlete queries with proper field handling
 */
export async function getAthletesWithFullNames(filters: {
  schoolId?: string;
  graduationYear?: number;
  gender?: 'M' | 'F';
  searchTerm?: string;
  limit?: number;
} = {}) {
  let query = supabase
    .from('athletes')
    .select(`
      id,
      first_name,
      last_name,
      graduation_year,
      gender,
      current_school_id,
      schools:current_school_id (
        name,
        city,
        state
      )
    `);

  if (filters.schoolId) {
    query = query.eq('current_school_id', filters.schoolId);
  }

  if (filters.graduationYear) {
    query = query.eq('graduation_year', filters.graduationYear);
  }

  if (filters.gender) {
    query = query.eq('gender', filters.gender);
  }

  if (filters.searchTerm) {
    // Search in both first and last name
    query = query.or(`first_name.ilike.%${filters.searchTerm}%,last_name.ilike.%${filters.searchTerm}%`);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query.order('last_name', { ascending: true });

  if (error) throw error;

return data?.map(athlete => ({
  ...athlete,
  full_name: getAthleteFullName(athlete),
  school_name: (athlete.schools as any)?.name || 'Unknown School'
})) || [];
}

/**
 * Updated results queries with proper field handling and XC calculations
 */
export async function getResultsWithDetails(filters: {
  athleteId?: string;
  meetId?: string;
  raceId?: string;
  limit?: number;
} = {}) {
  let query = supabase
    .from('results_with_details')
    .select('*');

  if (filters.athleteId) {
    query = query.eq('athlete_id', filters.athleteId);
  }

  if (filters.meetId) {
    query = query.eq('meet_id', filters.meetId);
  }

  if (filters.raceId) {
    query = query.eq('race_id', filters.raceId);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  return data?.map(result => ({
    ...result,
    athlete_full_name: getAthleteFullName(result),
    place: getResultPlace(result),
    team_place: getResultTeamPlace(result),
    time_display: formatTimeFromCS(result.time_seconds),
    xc_time: calculateXCTime(result.time_seconds, getCourseXCRating(result)),
    xc_time_display: formatTimeFromCS(calculateXCTime(result.time_seconds, getCourseXCRating(result)))
  })) || [];
}

/**
 * XC Time calculation with proper rating
 */
export function calculateXCTime(timeCS: number, xcRating: number): number {
  return Math.round(timeCS * xcRating);
}

/**
 * Format time from centiseconds to MM:SS.CC
 */
export function formatTimeFromCS(centiseconds: number): string {
  const totalSeconds = centiseconds / 100;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
}

/**
 * Parse time from MM:SS.CC to centiseconds
 */
export function parseTimeToCS(timeStr: string): number {
  const timeRegex = /^(\d+):(\d{2})(?:\.(\d{1,2}))?$|^(\d+)\.(\d{1,2})$/;
  const match = timeStr.trim().match(timeRegex);
  
  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  let totalCS: number;
  
  if (match[1]) {
    // MM:SS.CC format
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const centiseconds = match[3] ? parseInt(match[3].padEnd(2, '0')) : 0;
    totalCS = (minutes * 60 + seconds) * 100 + centiseconds;
  } else {
    // SSS.CC format  
    const seconds = parseInt(match[4]);
    const centiseconds = match[5] ? parseInt(match[5].padEnd(2, '0')) : 0;
    totalCS = seconds * 100 + centiseconds;
  }
  
  return totalCS;
}

/**
 * Course queries with proper rating handling
 */
export async function getCoursesWithRatings() {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('name');

  if (error) throw error;

  return data?.map(course => ({
    ...course,
    mile_difficulty: getCourseMileDifficulty(course),
    xc_time_rating: getCourseXCRating(course),
    distance_display: `${course.distance_miles?.toFixed(2)} miles (${course.distance_meters}m)`
  })) || [];
}

/**
 * Meet results with team scoring
 */
export async function getMeetResultsWithScoring(meetId: string) {
  const results = await getResultsWithDetails({ meetId });
  if (!results) return { results: [], teamScores: [] };

  // Calculate team scores (top 5 scoring system)
  const teamScores = new Map<string, {
    school: string;
    runners: any[];
    score: number;
    scoringRunners: any[];
  }>();

  // Group results by school and gender
  const schoolResults = new Map<string, any[]>();
  
  results.forEach(result => {
    const key = `${result.school_name}_${result.race_gender}`;
    if (!schoolResults.has(key)) {
      schoolResults.set(key, []);
    }
    schoolResults.get(key)!.push(result);
  });

  // Calculate scores for each school
  schoolResults.forEach((runners, schoolKey) => {
    const sortedRunners = runners.sort((a, b) => (a.place || 999) - (b.place || 999));
    const scoringRunners = sortedRunners.slice(0, 5); // Top 5 runners score
    const score = scoringRunners.reduce((sum, runner) => sum + (runner.place || 999), 0);
    
    if (scoringRunners.length >= 5) { // Need at least 5 runners to score
      teamScores.set(schoolKey, {
        school: runners[0].school_name,
        runners: sortedRunners,
        score,
        scoringRunners
      });
    }
  });

  const sortedTeamScores = Array.from(teamScores.values())
    .sort((a, b) => a.score - b.score);

  return {
    results,
    teamScores: sortedTeamScores
  };
}

/**
 * Athlete profile with course PRs and progression
 */
export async function getAthleteProfile(athleteId: string) {
  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select(`
      *,
      schools:current_school_id (
        name,
        city,
        state
      )
    `)
    .eq('id', athleteId)
    .single();

  if (athleteError) throw athleteError;

const results = await getResultsWithDetails({ 
  athleteId, 
  limit: 100 
});

  // Calculate course PRs
  const coursePRs = new Map<string, any>();
  results?.forEach(result => {
    const courseKey = result.course_name;
    if (!coursePRs.has(courseKey) || result.time_seconds < coursePRs.get(courseKey).time_seconds) {
      coursePRs.set(courseKey, result);
    }
  });

  // Calculate seasonal progression
  const seasonalStats = new Map<number, {
    year: number;
    races: number;
    bestTime: number;
    avgTime: number;
    bestXCTime: number;
  }>();

  results?.forEach(result => {
    const year = result.season_year || new Date(result.created_at).getFullYear();
    if (!seasonalStats.has(year)) {
      seasonalStats.set(year, {
        year,
        races: 0,
        bestTime: result.time_seconds,
        avgTime: 0,
        bestXCTime: result.xc_time
      });
    }

    const stats = seasonalStats.get(year)!;
    stats.races++;
    stats.bestTime = Math.min(stats.bestTime, result.time_seconds);
    stats.bestXCTime = Math.min(stats.bestXCTime, result.xc_time);
  });

  // Calculate averages
  seasonalStats.forEach((stats, year) => {
    const yearResults = results?.filter(r => 
      (r.season_year || new Date(r.created_at).getFullYear()) === year
    ) || [];
    stats.avgTime = yearResults.reduce((sum, r) => sum + r.time_seconds, 0) / yearResults.length;
  });

return {
    athlete: {
      ...athlete,
      full_name: getAthleteFullName(athlete),
      school_name: (athlete.schools as any)?.name || 'Unknown School'
    },
    results: results || [],
    coursePRs: Array.from(coursePRs.values()),
    seasonalStats: Array.from(seasonalStats.values()).sort((a, b) => b.year - a.year)
  };
}