// src/lib/import-utilities.ts
// Utility functions for data import processing

export interface ParsedRaceData {
  Place: number;
  Grade: number;
  Athlete: string;
  Duration: string;
  School: string;
  Race: string;
  Gender: string;
}

export interface MeetInfo {
  name: string;
  date: string;
  location: string;
  distance: string;
  distanceMeters: number;
  distanceMiles: number;
  courseName: string;
}

export interface ImportStats {
  coursesCreated: number;
  schoolsCreated: number;
  athletesCreated: number;
  resultsImported: number;
  errors: string[];
}

/**
 * Convert time string (MM:SS.SS) to total seconds
 */
export function timeToSeconds(timeString: string): number {
  if (!timeString || typeof timeString !== 'string') {
    return 0;
  }

  try {
    // Handle different time formats
    const cleanTime = timeString.trim();
    
    // Format: MM:SS.SS or MM:SS
    const timePattern = /^(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?$/;
    const match = cleanTime.match(timePattern);
    
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = match[3] ? parseInt(match[3].padEnd(2, '0'), 10) : 0;
      
      return minutes * 60 + seconds + (centiseconds / 100);
    }
    
    // Format: SS.SS (seconds only)
    const secondsPattern = /^(\d+)(?:\.(\d{1,2}))?$/;
    const secondsMatch = cleanTime.match(secondsPattern);
    
    if (secondsMatch) {
      const seconds = parseInt(secondsMatch[1], 10);
      const centiseconds = secondsMatch[2] ? parseInt(secondsMatch[2].padEnd(2, '0'), 10) : 0;
      
      return seconds + (centiseconds / 100);
    }
    
    return 0;
  } catch (error) {
    console.error('Error parsing time:', timeString, error);
    return 0;
  }
}

/**
 * Format seconds back to MM:SS.SS format
 */
export function secondsToTimeString(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return '0:00.00';
  }
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
}

/**
 * Extract meet information from CSV data and filename
 */
export function extractMeetInfo(data: ParsedRaceData[], filename: string): MeetInfo {
  // Parse date from filename (e.g., "2025 0913 Baylands.csv")
  let meetDate = '';
  const datePatterns = [
    /(\d{4})\s*(\d{2})(\d{2})/, // YYYY MMDD
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})(\d{2})(\d{4})/    // MMDDYYYY
  ];
  
  for (const pattern of datePatterns) {
    const match = filename.match(pattern);
    if (match) {
      if (pattern.source.includes('(\\d{4})\\s*(\\d{2})(\\d{2})')) {
        // YYYY MMDD format
        const [, year, month, day] = match;
        meetDate = `${year}-${month}-${day}`;
      } else if (pattern.source.includes('(\\d{4})-(\\d{2})-(\\d{2})')) {
        // YYYY-MM-DD format
        meetDate = match[0];
      } else if (pattern.source.includes('(\\d{2})(\\d{2})(\\d{4})')) {
        // MMDDYYYY format
        const [, month, day, year] = match;
        meetDate = `${year}-${month}-${day}`;
      }
      break;
    }
  }
  
  // If no date found in filename, use current date
  if (!meetDate) {
    meetDate = new Date().toISOString().split('T')[0];
  }

  // Extract meet name from filename
  let meetName = filename
    .replace(/\d{4}\s*\d{4}/, '') // Remove date patterns
    .replace(/\.(csv|pdf)$/i, '') // Remove file extension
    .replace(/[_-]/g, ' ') // Replace underscores and dashes with spaces
    .trim();
  
  // Add "Invitational" if the name suggests it's a meet (like "Baylands")
  if (meetName && !meetName.toLowerCase().includes('invitational') && 
      !meetName.toLowerCase().includes('meet') && 
      !meetName.toLowerCase().includes('championship')) {
    meetName = meetName + ' Invitational';
  }
  
  if (!meetName) {
    meetName = 'Imported Meet';
  }

  // Determine distance from data or assume standard distances
  let distanceMeters = 4000; // Default to 4K based on your example
  let distance = '4K';
  
  // Try to extract distance from race categories
  if (data.length > 0) {
    const raceTypes = [...new Set(data.map(row => row.Race))];
    
    for (const race of raceTypes) {
      // Look for distance indicators in race names
      const distancePatterns = [
        { pattern: /(\d+)k/i, multiplier: 1000 },
        { pattern: /(\d+)\s*km/i, multiplier: 1000 },
        { pattern: /(\d+)\s*meter/i, multiplier: 1 },
        { pattern: /(\d+)m(?!\w)/i, multiplier: 1 },
        { pattern: /(\d+)\s*mile/i, multiplier: 1609.34 }
      ];
      
      for (const { pattern, multiplier } of distancePatterns) {
        const match = race.match(pattern);
        if (match) {
          const num = parseFloat(match[1]);
          if (num > 0) {
            distanceMeters = Math.round(num * multiplier);
            distance = `${num}${multiplier === 1000 ? 'K' : multiplier === 1609.34 ? ' Mile' : 'M'}`;
            break;
          }
        }
      }
      
      if (distanceMeters !== 4000) break; // Found a distance, stop looking
    }
  }

  const distanceMiles = distanceMeters / 1609.34;

  return {
    name: meetName,
    date: meetDate,
    location: 'TBD', // Will be filled when course is created
    distance,
    distanceMeters,
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    courseName: meetName.replace(' Invitational', '') + ' Park'
  };
}

/**
 * Check if time string is in valid format
 */
function isValidTimeFormat(timeString: string): boolean {
  if (!timeString || typeof timeString !== 'string') {
    return false;
  }
  
  const timePatterns = [
    /^\d{1,2}:\d{2}(?:\.\d{1,2})?$/, // MM:SS or MM:SS.SS
    /^\d+(?:\.\d{1,2})?$/            // SS.SS (seconds only)
  ];
  
  return timePatterns.some(pattern => pattern.test(timeString.trim()));
}

/**
 * Validate CSV data structure
 */
export function validateCSVData(data: any[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || data.length === 0) {
    errors.push('CSV file appears to be empty');
    return { isValid: false, errors };
  }

  // Check required columns
  const requiredColumns = ['Place', 'Athlete', 'Duration', 'School', 'Gender'];
  const firstRow = data[0];
  
  for (const column of requiredColumns) {
    if (!(column in firstRow)) {
      errors.push(`Missing required column: ${column}`);
    }
  }

  // Validate data types and formats
  for (let i = 0; i < Math.min(data.length, 10); i++) { // Check first 10 rows
    const row = data[i];
    
    // Check Place is a number
    if (row.Place && isNaN(Number(row.Place))) {
      errors.push(`Row ${i + 1}: Place should be a number`);
    }
    
    // Check Duration format
    if (row.Duration && !isValidTimeFormat(row.Duration)) {
      errors.push(`Row ${i + 1}: Invalid time format for Duration: ${row.Duration}`);
    }
    
    // Check required fields are not empty
    if (!row.Athlete || !row.School) {
      errors.push(`Row ${i + 1}: Missing athlete name or school`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Clean and normalize athlete name
 */
export function normalizeAthleteName(name: string): { firstName: string; lastName: string } {
  if (!name || typeof name !== 'string') {
    return { firstName: 'Unknown', lastName: 'Athlete' };
  }
  
  const cleaned = name.trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ');
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  } else if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  } else {
    // More than 2 parts - first name is first part, last name is everything else
    return { 
      firstName: parts[0], 
      lastName: parts.slice(1).join(' ') 
    };
  }
}

/**
 * Calculate graduation year from grade
 */
export function calculateGraduationYear(grade: number, currentYear?: number): number {
  const year = currentYear || new Date().getFullYear();
  
  // Assuming grades 9-12 for high school
  if (grade >= 9 && grade <= 12) {
    return year + (12 - grade);
  }
  
  // Default for invalid grades
  return year + 1;
}

/**
 * Deduplicate athletes by name and school
 */
export function deduplicateAthletes(data: ParsedRaceData[]): ParsedRaceData[] {
  const seen = new Set<string>();
  const deduplicated: ParsedRaceData[] = [];
  
  for (const row of data) {
    const key = `${row.Athlete.toLowerCase()}_${row.School.toLowerCase()}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(row);
    }
  }
  
  return deduplicated;
}

/**
 * Group data by race categories
 */
export function groupByRace(data: ParsedRaceData[]): Map<string, ParsedRaceData[]> {
  const groups = new Map<string, ParsedRaceData[]>();
  
  for (const row of data) {
    const raceKey = `${row.Race}_${row.Gender}`;
    
    if (!groups.has(raceKey)) {
      groups.set(raceKey, []);
    }
    
    groups.get(raceKey)!.push(row);
  }
  
  return groups;
}

/**
 * Validate meet date format
 */
export function validateMeetDate(dateString: string): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}