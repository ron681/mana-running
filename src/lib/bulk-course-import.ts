// src/lib/bulk-course-import.ts
// Import all courses from the AllCourses.csv file

import { supabase } from './supabase';
import Papa from 'papaparse';

interface CourseCSVRow {
  Venue: string;
  distance_meters: number;
  mile_difficulty: number;
  xc_rating: number;
}

export interface BulkImportResult {
  success: boolean;
  coursesCreated: number;
  coursesUpdated: number;
  errors: string[];
  duplicatesFound: number;
}

/**
 * Import courses from CSV data
 */
export async function importCoursesFromCSV(csvData: string): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    success: false,
    coursesCreated: 0,
    coursesUpdated: 0,
    errors: [],
    duplicatesFound: 0
  };

  try {
    const parsed = Papa.parse(csvData, { header: true, dynamicTyping: true });
    const courses = parsed.data.filter((row: any) => 
      row.Venue && 
      row.distance_meters > 0 && 
      row.mile_difficulty > 0 && 
      row.xc_rating > 0
    ) as CourseCSVRow[];

    if (courses.length === 0) {
      result.errors.push('No valid courses found in CSV data');
      return result;
    }

    for (const csvCourse of courses) {
      try {
        const distanceMiles = csvCourse.distance_meters / 1609.344;
        const expectedRating = (4747 / csvCourse.distance_meters) * (1.17688 / csvCourse.mile_difficulty);
        const ratingDifference = Math.abs(expectedRating - csvCourse.xc_rating);
        
        if (ratingDifference > 0.01) {
          result.errors.push(`${csvCourse.Venue}: Rating mismatch`);
          continue;
        }

        const { data: existingCourses } = await supabase
          .from('courses')
          .select('id, name, distance_meters')
          .ilike('name', csvCourse.Venue.trim())
          .gte('distance_meters', csvCourse.distance_meters - 50)
          .lte('distance_meters', csvCourse.distance_meters + 50);

        if (existingCourses && existingCourses.length > 0) {
          const { error: updateError } = await supabase
            .from('courses')
            .update({
              distance_meters: csvCourse.distance_meters,
              distance_miles: Math.round(distanceMiles * 100000) / 100000,
              mile_difficulty: csvCourse.mile_difficulty,
              xc_time_rating: csvCourse.xc_rating,
              rating_confidence: 'validated'
            })
            .eq('id', existingCourses[0].id);

          if (updateError) {
            result.errors.push(`${csvCourse.Venue}: Update failed`);
          } else {
            result.coursesUpdated++;
          }
          result.duplicatesFound++;
        } else {
          const { error: insertError } = await supabase
            .from('courses')
            .insert([{
              name: csvCourse.Venue.trim(),
              distance_meters: csvCourse.distance_meters,
              distance_miles: Math.round(distanceMiles * 100000) / 100000,
              mile_difficulty: csvCourse.mile_difficulty,
              xc_time_rating: csvCourse.xc_rating,
              rating_confidence: 'validated'
            }]);

          if (insertError) {
            result.errors.push(`${csvCourse.Venue}: Insert failed`);
          } else {
            result.coursesCreated++;
          }
        }
      } catch (error) {
        result.errors.push(`${csvCourse.Venue}: Processing error`);
      }
    }

    result.success = result.coursesCreated > 0 || result.coursesUpdated > 0;
  } catch (error) {
    result.errors.push('Fatal error during import');
  }

  return result;
}