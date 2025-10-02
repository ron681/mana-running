// src/lib/mass-results-import.ts
import { supabase } from './supabase';
import Papa from 'papaparse';

interface CSVRow {
  meet_date: string;
  athlete_first_name: string;
  athlete_last_name: string;
  school_name: string;
  graduation_year: number;
  grade: number;
  time: string;
  meet_name: string;
  meet_type: string;
  place: number;
  course_name: string;
  distance_meters: number;
  race_category: string;
  gender: string;
  season: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  stats: {
    totalRows: number;
    coursesCreated: number;
    schoolsCreated: number;
    athletesCreated: number;
    meetsCreated: number;
    racesCreated: number;
    resultsCreated: number;
    errors: string[];
  };
}

// Parse date handling 2-digit years correctly
function parseDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) throw new Error(`Invalid date format: ${dateStr}`);
  
  let [month, day, year] = parts.map(p => parseInt(p));
  
  // Handle 2-digit years: 60-99 = 1900s, 00-59 = 2000s
  if (year < 100) {
    year = year >= 60 ? 1900 + year : 2000 + year;
  }
  
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Convert time MM:SS.S to centiseconds
function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 2) throw new Error(`Invalid time format: ${timeStr}`);
  
  const minutes = parseInt(parts[0]);
  const seconds = parseFloat(parts[1]);
  
  return Math.round((minutes * 60 + seconds) * 100);
}

// Calculate XC time rating
function calculateXCTimeRating(distanceMeters: number, mileDifficulty: number): number {
  return (4747 / distanceMeters) * (1.17688 / mileDifficulty);
}

// Find or create course with intelligent matching
async function findOrCreateCourse(
  courseName: string,
  distanceMeters: number,
  stats: ImportResult['stats']
): Promise<string> {
  // Try exact match first
  const { data: exactMatch } = await supabase
    .from('courses')
    .select('id')
    .eq('name', courseName)
    .eq('distance_meters', distanceMeters)
    .single();
  
  if (exactMatch) return exactMatch.id;
  
  // Try fuzzy match: similar name AND distance within ±50m
  const { data: allCourses } = await supabase
    .from('courses')
    .select('id, name, distance_meters');
  
  if (allCourses) {
    for (const course of allCourses) {
      const nameMatch = course.name.toLowerCase().includes(courseName.toLowerCase()) ||
                       courseName.toLowerCase().includes(course.name.toLowerCase());
      const distanceMatch = Math.abs(course.distance_meters - distanceMeters) <= 50;
      
      if (nameMatch && distanceMatch) {
        console.log(`Fuzzy matched: ${courseName} (${distanceMeters}m) → ${course.name} (${course.distance_meters}m)`);
        return course.id;
      }
    }
  }
  
  // Create new course with calculated ratings
  const distanceMiles = distanceMeters * 0.000621371;
  const mileDifficulty = 1.0; // Default estimate
  const xcTimeRating = calculateXCTimeRating(distanceMeters, mileDifficulty);
  
  const { data: newCourse, error } = await supabase
    .from('courses')
    .insert({
      name: `${courseName} | ${distanceMeters}m (${distanceMiles.toFixed(2)} mi)`,
      distance_meters: distanceMeters,
      mile_difficulty: mileDifficulty,
      xc_time_rating: xcTimeRating,
      rating_confidence: 'estimated'
    })
    .select('id')
    .single();
  
  if (error) throw error;
  
  stats.coursesCreated++;
  return newCourse.id;
}

// Find or create school
async function findOrCreateSchool(schoolName: string, stats: ImportResult['stats']): Promise<string> {
  const { data: existing } = await supabase
    .from('schools')
    .select('id')
    .eq('name', schoolName)
    .single();
  
  if (existing) return existing.id;
  
  const { data: newSchool, error } = await supabase
    .from('schools')
    .insert({ name: schoolName })
    .select('id')
    .single();
  
  if (error) throw error;
  
  stats.schoolsCreated++;
  return newSchool.id;
}

// Find or create athlete
async function findOrCreateAthlete(
  firstName: string,
  lastName: string,
  graduationYear: number,
  gender: string,
  schoolId: string,
  stats: ImportResult['stats']
): Promise<string> {
  const { data: existing } = await supabase
    .from('athletes')
    .select('id')
    .eq('first_name', firstName)
    .eq('last_name', lastName)
    .eq('graduation_year', graduationYear)
    .single();
  
  if (existing) return existing.id;
  
  const { data: newAthlete, error } = await supabase
    .from('athletes')
    .insert({
      first_name: firstName,
      last_name: lastName,
      graduation_year: graduationYear,
      gender: gender,
      current_school_id: schoolId
    })
    .select('id')
    .single();
  
  if (error) throw error;
  
  stats.athletesCreated++;
  return newAthlete.id;
}

// Find or create meet
async function findOrCreateMeet(
  meetName: string,
  meetDate: string,
  meetType: string,
  stats: ImportResult['stats']
): Promise<string> {
  const { data: existing } = await supabase
    .from('meets')
    .select('id')
    .eq('name', meetName)
    .eq('meet_date', meetDate)
    .single();
  
  if (existing) return existing.id;
  
  const { data: newMeet, error } = await supabase
    .from('meets')
    .insert({
      name: meetName,
      meet_date: meetDate,
      meet_type: meetType
    })
    .select('id')
    .single();
  
  if (error) throw error;
  
  stats.meetsCreated++;
  return newMeet.id;
}

// Find or create race
async function findOrCreateRace(
  meetId: string,
  category: string,
  gender: string,
  courseId: string,
  stats: ImportResult['stats']
): Promise<string> {
  const { data: existing } = await supabase
    .from('races')
    .select('id')
    .eq('meet_id', meetId)
    .eq('category', category)
    .eq('gender', gender)
    .single();
  
  if (existing) return existing.id;
  
  const raceName = `${category} ${gender === 'M' ? 'Boys' : 'Girls'}`;
  
  const { data: newRace, error } = await supabase
    .from('races')
    .insert({
      meet_id: meetId,
      name: raceName,
      category: category,
      gender: gender,
      course_id: courseId
    })
    .select('id')
    .single();
  
  if (error) throw error;
  
  stats.racesCreated++;
  return newRace.id;
}

export async function importMassResults(file: File): Promise<ImportResult> {
  const stats: ImportResult['stats'] = {
    totalRows: 0,
    coursesCreated: 0,
    schoolsCreated: 0,
    athletesCreated: 0,
    meetsCreated: 0,
    racesCreated: 0,
    resultsCreated: 0,
    errors: []
  };
  
  try {
    const text = await file.text();
    const parsed = Papa.parse<CSVRow>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });
    
    stats.totalRows = parsed.data.length;
    
    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      
      try {
        // Parse data
        const meetDate = parseDate(row.meet_date);
        const timeSeconds = timeToSeconds(row.time);
        const raceCategory = row.race_category === 'UNK' ? 'Varsity' : row.race_category;
        
        // Find or create entities
        const courseId = await findOrCreateCourse(row.course_name, row.distance_meters, stats);
        const schoolId = await findOrCreateSchool(row.school_name, stats);
        const athleteId = await findOrCreateAthlete(
          row.athlete_first_name,
          row.athlete_last_name,
          row.graduation_year,
          row.gender,
          schoolId,
          stats
        );
        const meetId = await findOrCreateMeet(row.meet_name, meetDate, row.meet_type, stats);
        const raceId = await findOrCreateRace(meetId, raceCategory, row.gender, courseId, stats);
        
        // Create result
        const { error: resultError } = await supabase
          .from('results')
          .insert({
            athlete_id: athleteId,
            meet_id: meetId,
            race_id: raceId,
            time_seconds: timeSeconds,
            place_overall: row.place,
            season_year: row.season
          });
        
        if (resultError) throw resultError;
        
        stats.resultsCreated++;
        
        // Progress logging every 100 rows
        if ((i + 1) % 100 === 0) {
          console.log(`Processed ${i + 1} / ${stats.totalRows} rows`);
        }
        
      } catch (error) {
        stats.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return {
      success: stats.errors.length === 0,
      message: stats.errors.length === 0 
        ? 'Import completed successfully'
        : `Import completed with ${stats.errors.length} errors`,
      stats
    };
    
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      stats
    };
  }
}