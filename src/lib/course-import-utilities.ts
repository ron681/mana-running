// src/lib/course-import-utilities.ts
// Improved course import system with CORRECTED formula

import { supabase } from './supabase';

export interface CourseData {
  name: string;
  distance_meters: number;
  distance_miles: number;
  mile_difficulty: number;
  xc_time_rating: number;
  rating_confidence: number;
  location?: string;
  description?: string;
}

export interface ParsedCourseInfo {
  courseName: string;
  distanceMeters: number;
  distanceMiles: number;
  originalDistance: string;
}

// CORRECTED formula constants
const XC_TIME_BASE = 4747; // Crystal Springs reference distance
const MILE_DIFFICULTY_BASE = 1.17688; // Crystal Springs reference difficulty

/**
 * Calculate XC Time Rating using the CORRECT dual rating system formula
 * Formula: (4747 / distance_meters) * (1.17688 / mile_difficulty)
 */
export function calculateXCTimeRating(distanceMeters: number, mileDifficulty: number): number {
  return (XC_TIME_BASE / distanceMeters) * (MILE_DIFFICULTY_BASE / mileDifficulty);
}

/**
 * Parse course name and extract distance information
 */
export function parseCourseNameAndDistance(courseStr: string): ParsedCourseInfo {
  const parts = courseStr.split(/\s*[|\-–]\s*/).map(p => p.trim());
  
  let courseName = parts[0];
  let distanceStr = parts.length > 1 ? parts[1] : '';
  let distanceMeters = 0;
  let distanceMiles = 0;

  if (distanceStr) {
    const distanceMatch = distanceStr.match(/([\d.]+)\s*(miles?|mi|km|k|m|meters?)/i);
    
    if (distanceMatch) {
      const value = parseFloat(distanceMatch[1]);
      const unit = distanceMatch[2].toLowerCase();
      
      if (unit.startsWith('mile') || unit === 'mi') {
        distanceMiles = value;
        distanceMeters = Math.round(value * 1609.344);
      } else if (unit.startsWith('km') || unit === 'k') {
        distanceMeters = Math.round(value * 1000);
        distanceMiles = value / 1.609344;
      } else if (unit.startsWith('m')) {
        distanceMeters = Math.round(value);
        distanceMiles = value / 1609.344;
      }
    }
  }

  return {
    courseName,
    distanceMeters,
    distanceMiles: Math.round(distanceMiles * 100000) / 100000,
    originalDistance: distanceStr
  };
}

/**
 * Get default mile difficulty based on distance
 */
export function getDefaultMileDifficulty(distanceMeters: number): number {
  const miles = distanceMeters / 1609.344;
  
  if (miles <= 1.5) return 1.05;
  if (miles <= 2.5) return 1.10;
  if (miles <= 3.5) return 1.15;
  return 1.20;
}

/**
 * Search for existing courses in database
 */
export async function searchExistingCourses(courseName: string, distanceMeters?: number) {
  let query = supabase
    .from('courses')
    .select('*')
    .ilike('name', `%${courseName}%`);

  if (distanceMeters && distanceMeters > 0) {
    query = query
      .gte('distance_meters', distanceMeters - 50)
      .lte('distance_meters', distanceMeters + 50);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Error searching courses:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a new course with calculated ratings
 */
export async function createCourse(courseData: Partial<CourseData> & { 
  name: string; 
  distance_meters: number; 
}): Promise<any> {
  const distance_miles = courseData.distance_meters / 1609.344;
  const mile_difficulty = courseData.mile_difficulty || getDefaultMileDifficulty(courseData.distance_meters);
  const xc_time_rating = calculateXCTimeRating(courseData.distance_meters, mile_difficulty);
  const rating_confidence = courseData.rating_confidence || 0.5;

  const newCourse: CourseData = {
    name: courseData.name,
    distance_meters: courseData.distance_meters,
    distance_miles: Math.round(distance_miles * 100000) / 100000,
    mile_difficulty,
    xc_time_rating: Math.round(xc_time_rating * 100000) / 100000,
    rating_confidence,
    location: courseData.location,
    description: courseData.description
  };

  const { data, error } = await supabase
    .from('courses')
    .insert([newCourse])
    .select()
    .single();

  if (error) {
    console.error('Error creating course:', error);
    throw error;
  }

  return data;
}