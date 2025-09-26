// Enhanced Import Utilities for Multi-Race Meets
import { supabase } from './supabase'

// Core interfaces
export interface ParsedRaceData {
  Place: number;
  Grade: number;
  Athlete: string;
  Duration: string;
  School: string;
  Race: string;
  Gender: string;
}

export interface ParsedAthleteName {
  firstName: string;
  lastName: string;
  fullName: string;
  needsReview?: boolean;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingAthleteId?: string;
  conflictReason?: string;
}

export interface MeetInfo {
  name: string;
  date: string;
  location: string;
  distance: string;
  distanceMeters: number;
  distanceMiles: number;
  courseName: string;
  // Optional metadata for UI handling
  _needsManualCourseName?: boolean;
}

export interface ImportStats {
  coursesCreated: number;
  schoolsCreated: number;
  athletesCreated: number;
  resultsImported: number;
  errors: string[];
}

// ENHANCED NAME PARSING
export function parseAthleteName(fullName: string): ParsedAthleteName {
  if (!fullName || typeof fullName !== 'string') {
    throw new Error('Invalid name provided');
  }

  const trimmedName = fullName.trim();
  if (!trimmedName) {
    throw new Error('Empty name provided');
  }

  const nameParts = trimmedName.split(/\s+/);
  
  if (nameParts.length === 1) {
    return {
      firstName: nameParts[0],
      lastName: '[Single Name]',
      fullName: trimmedName,
      needsReview: true
    };
  }

  // Check for suffixes (Jr, Sr, II, III, etc.)
  const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'v', '2nd', '3rd', '4th'];
  const lastPart = nameParts[nameParts.length - 1].toLowerCase().replace('.', '');
  
  let actualNameParts = [...nameParts];
  let suffix = '';
  
  if (suffixes.includes(lastPart)) {
    suffix = nameParts.pop() || '';
    actualNameParts = nameParts;
  }

  // Check for compound last name prefixes
  const compoundPrefixes = ['van', 'de', 'del', 'della', 'von', 'mc', 'mac', 'o\'', 'le', 'la', 'du'];
  
  if (actualNameParts.length >= 3) {
    const secondToLast = actualNameParts[actualNameParts.length - 2].toLowerCase().replace('\'', '');
    
    if (compoundPrefixes.some(prefix => secondToLast.startsWith(prefix.replace('\'', '')))) {
      const lastName = actualNameParts.slice(-2).join(' ');
      const firstName = actualNameParts.slice(0, -2).join(' ');
      
      return {
        firstName: firstName,
        lastName: suffix ? `${lastName} ${suffix}` : lastName,
        fullName: trimmedName,
        needsReview: false
      };
    }
  }

  // Standard case: last word is last name
  const lastName = actualNameParts[actualNameParts.length - 1];
  const firstName = actualNameParts.slice(0, -1).join(' ');

  return {
    firstName: firstName,
    lastName: suffix ? `${lastName} ${suffix}` : lastName,
    fullName: trimmedName,
    needsReview: false
  };
}

// DUPLICATE DETECTION
export async function checkForDuplicateAthlete(
  firstName: string,
  lastName: string,
  schoolName: string,
  graduationYear: number
): Promise<DuplicateCheckResult> {
  
  const normalizedSchool = normalizeSchoolName(schoolName);
  
  const { data: exactMatch, error: exactError } = await supabase
    .from('athletes')
    .select(`
      id,
      first_name,
      last_name,
      graduation_year,
      schools:current_school_id(name)
    `)
    .ilike('first_name', firstName.trim())
    .ilike('last_name', lastName.trim())
    .eq('graduation_year', graduationYear);

  if (exactError) {
    console.error('Error checking for duplicate athletes:', exactError);
    return { isDuplicate: false };
  }

  if (exactMatch && exactMatch.length > 0) {
const schoolMatch = exactMatch.find(athlete => {
  const athleteTyped = athlete as any;
  const schools = athleteTyped.schools;
  const schoolName = Array.isArray(schools) 
    ? schools[0]?.name || '' 
    : schools?.name || '';
  
  return normalizeSchoolName(schoolName) === normalizedSchool;
});

    if (schoolMatch) {
      return {
        isDuplicate: true,
        existingAthleteId: schoolMatch.id,
        conflictReason: 'Exact match found'
      };
    }

    return {
      isDuplicate: true,
      existingAthleteId: exactMatch[0].id,
conflictReason: `Same athlete found at different school: ${(exactMatch[0] as any).schools?.[0]?.name || 'Unknown School'}`
    };
  }

  return { isDuplicate: false };
}

// SCHOOL NAME NORMALIZATION
export function normalizeSchoolName(schoolName: string): string {
  if (!schoolName || typeof schoolName !== 'string') {
    return '';
  }

  return schoolName
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bHigh School\b/gi, 'HS')
    .replace(/\bMiddle School\b/gi, 'MS')
    .replace(/\bPrep\b/gi, 'Preparatory')
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// RACE CATEGORY PARSING
export function parseRaceCategory(raceString: string, gender: string): {
  category: string;
  name: string;
  distance?: string;
} {
  if (!raceString) {
    return { category: 'Varsity', name: `Varsity ${gender}` };
  }

  const lower = raceString.toLowerCase();
  
  // Extract distance if present
  const distanceMatch = raceString.match(/(\d+(?:\.\d+)?)\s*(mile|k|km|m)/i);
  const distance = distanceMatch ? distanceMatch[0] : undefined;

  // Determine category
  let category = 'Varsity';
  
  if (lower.includes('varsity')) category = 'Varsity';
  else if (lower.includes('jv') || lower.includes('junior varsity')) category = 'JV';
  else if (lower.includes('freshman') || lower.includes('frosh')) category = 'Freshman';
  else if (lower.includes('reserves') || lower.includes('reserve')) category = 'Reserves';
  else if (lower.includes('sophomore')) category = 'Sophomore';
  else if (lower.includes('novice')) category = 'Novice';

  return {
    category,
    name: `${category} ${gender}`,
    distance
  };
}

// TIME CONVERSION
export function timeToSeconds(timeString: string): number {
  if (!timeString || typeof timeString !== 'string') {
    return 0;
  }

  try {
    const cleanTime = timeString.trim();
    const timePattern = /^(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?$/;
    const match = cleanTime.match(timePattern);
    
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = match[3] ? parseInt(match[3].padEnd(2, '0'), 10) : 0;
      
      // Return centiseconds directly for database storage
      return (minutes * 60 * 100) + (seconds * 100) + centiseconds;
    }
    
    return 0;
  } catch (error) {
    console.error('Error parsing time:', timeString, error);
    return 0;
  }
}

// GRADUATION YEAR CALCULATION
export function calculateGraduationYear(grade: number, currentDate: Date = new Date()): number {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // Academic year starts in July (month 6)
  const academicYear = currentMonth >= 6 ? currentYear + 1 : currentYear;
  
  // Calculate graduation year: 12th grade graduates in current academic year
  return academicYear + (12 - grade);
}

// ENHANCED DISTANCE PARSING - NO ROUNDING for precision
function parseDistanceString(str: string): { meters: number; display: string } {
  if (!str) return { meters: 0, display: '' };
  
  const lower = str.toLowerCase();
  
  // Common XC distances - exact matches first
  if (lower.includes('5k') || lower.includes('5000') || lower.includes('3.1')) {
    return { meters: 5000, display: '5K' };
  }
  if (lower.includes('2.74') || lower.includes('4400')) {
    return { meters: 4409.5776, display: '2.74 Miles' }; // Exact conversion
  }
  if (lower.includes('4k') || lower.includes('4000')) {
    return { meters: 4000, display: '4K' };
  }
  if (lower.includes('3k') || lower.includes('3000')) {
    return { meters: 3000, display: '3K' };
  }
  
  // Pattern matching for flexible parsing - MILES FIRST for accuracy
  const patterns = [
    // Mile patterns (process first for precision) - NO ROUNDING
    { regex: /(\d+\.?\d*)\s*mile/i, multiplier: 1609.344, unit: ' Mile', precision: 'high' },
    // Kilometer patterns
    { regex: /(\d+\.?\d*)\s*k(?:m)?/i, multiplier: 1000, unit: 'K', precision: 'medium' },
    // Meter patterns (exact)
    { regex: /(\d+)\s*meter/i, multiplier: 1, unit: 'm', precision: 'exact' },
    { regex: /(\d+)m(?!\w)/i, multiplier: 1, unit: 'm', precision: 'exact' }
  ];
  
  for (const { regex, multiplier, unit, precision } of patterns) {
    const match = str.match(regex);
    if (match) {
      const num = parseFloat(match[1]);
      if (num > 0) {
        // For miles, use exact conversion factor and don't round
        const meters = num * multiplier;
        
        const displayValue = precision === 'high' && num !== 1 
          ? `${num}${unit}s` 
          : `${num}${unit}`;
          
        return { 
          meters, // Store exact value, no rounding
          display: displayValue
        };
      }
    }
  }
  
  return { meters: 0, display: str };
}

// ENHANCED MEET INFO EXTRACTION
export function extractMeetInfo(data: any[], fileName: string): MeetInfo {
  if (!data || data.length === 0) {
    throw new Error('No data provided to extract meet info');
  }

  const firstRow = data[0];
  
  // Extract meet name - CSV first, then filename fallback
  let meetName = '';
  if (firstRow.Meet) {
    meetName = firstRow.Meet.toString().trim();
  } else if (firstRow['Meet Name']) {
    meetName = firstRow['Meet Name'].toString().trim();
  } else if (firstRow.Event) {
    meetName = firstRow.Event.toString().trim();
  } else if (firstRow.Competition) {
    meetName = firstRow.Competition.toString().trim();
  } else {
    meetName = fileName
      .replace(/\.(csv|xlsx|xls)$/i, '')
      .replace(/^\d{4}\s*\d{4}\s*/, '')
      .replace(/^[\d\s-]+/, '')
      .replace(/_/g, ' ')
      .trim() || 'Imported Meet';
  }

  // Extract course name - CSV first, then mark for manual entry
  let courseName = '';
  let needsManualCourseName = false;
  
  if (firstRow.Course) {
    courseName = firstRow.Course.toString().trim();
  } else if (firstRow.Location) {
    courseName = firstRow.Location.toString().trim();
  } else if (firstRow.Site) {
    courseName = firstRow.Site.toString().trim();
  } else if (firstRow.Venue) {
    courseName = firstRow.Venue.toString().trim();
  } else {
    // Mark for manual entry instead of using fallbacks
    courseName = '';
    needsManualCourseName = true;
  }

  // Extract date - check multiple column name possibilities
let meetDate = '';
const dateFields = ['meet_date', 'Date', 'Meet Date', 'Event Date', 'date'];
for (const field of dateFields) {
  if (firstRow[field]) {
    const dateValue = firstRow[field].toString().trim();
    // Handle MM/DD/YY format specifically
    if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
      const [month, day, year] = dateValue.split('/');
      const fullYear = '20' + year; // Convert 25 to 2025
      meetDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      console.log(`Date converted: "${dateValue}" → "${meetDate}"`);
    } else {
      meetDate = dateValue;
    }
    break;
  }
}

if (!meetDate) {
  const dateMatch = fileName.match(/(\d{4})\s*(\d{2})(\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    meetDate = `${year}-${month}-${day}`;
  } else {
    meetDate = new Date().toISOString().split('T')[0];
  }
}

  // ENHANCED: Distance extraction with mile-first priority
  let distanceMeters = 5000; // Default to 5K
  let distance = '5K';
  let sourceDistance = '';
  
  // Check CSV columns first
  if (firstRow.Distance) {
    sourceDistance = firstRow.Distance.toString().trim();
  } else if (firstRow['Race Distance']) {
    sourceDistance = firstRow['Race Distance'].toString().trim();
  }
  
  if (sourceDistance) {
    const parsed = parseDistanceString(sourceDistance);
    if (parsed.meters > 0) {
      distanceMeters = parsed.meters;
      distance = parsed.display;
      
      console.log(`Distance parsed from CSV: "${sourceDistance}" → ${distanceMeters}m (${distance})`);
    }
  } else if (data.length > 0) {
    // Analyze race names for distance
    const raceTypes = [...new Set(data.map(row => row.Race))];
    for (const race of raceTypes) {
      const parsed = parseDistanceString(race);
      if (parsed.meters > 0) {
        distanceMeters = parsed.meters;
        distance = parsed.display;
        console.log(`Distance parsed from race name: "${race}" → ${distanceMeters}m (${distance})`);
        break;
      }
    }
  }

  // Calculate miles for display - preserve precision internally, round for display
  const distanceMiles = distanceMeters / 1609.344;

  console.log(`Final distance: ${Math.round(distanceMeters)}m = ${Math.round(distanceMiles * 100) / 100} miles`);

  return {
    name: meetName,
    date: meetDate,
    location: courseName,
    distance,
    distanceMeters, // Store exact value for calculations
    distanceMiles,  // Store exact value for calculations (UI will round for display)
    courseName,
    // Add metadata to indicate manual input needed
    _needsManualCourseName: needsManualCourseName
  };
}

// CSV DATA VALIDATION
export function validateCSVData(data: any[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || data.length === 0) {
    errors.push('CSV file appears to be empty');
    return { isValid: false, errors };
  }

  const requiredColumns = ['Place', 'Athlete', 'Duration', 'School', 'Gender'];
  const firstRow = data[0];
  
  for (const column of requiredColumns) {
    if (!(column in firstRow)) {
      errors.push(`Missing required column: ${column}`);
    }
  }

  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i];
    
    if (row.Place && isNaN(Number(row.Place))) {
      errors.push(`Row ${i + 1}: Place should be a number`);
    }
    
    if (row.Duration && !isValidTimeFormat(row.Duration)) {
      errors.push(`Row ${i + 1}: Invalid time format for Duration: ${row.Duration}`);
    }
    
    if (!row.Athlete || !row.School) {
      errors.push(`Row ${i + 1}: Missing athlete name or school`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

function isValidTimeFormat(timeString: string): boolean {
  if (!timeString || typeof timeString !== 'string') {
    return false;
  }
  
  const timePatterns = [
    /^\d{1,2}:\d{2}(?:\.\d{1,2})?$/,
    /^\d+(?:\.\d{1,2})?$/
  ];
  
  return timePatterns.some(pattern => pattern.test(timeString.trim()));
}

// DATA UTILITY FUNCTIONS
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

export function validateMeetDate(dateString: string): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}