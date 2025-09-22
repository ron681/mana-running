// Add these utility functions to src/lib/grade-utils.ts or include in existing utility file

/**
 * Convert race date to academic year
 * Academic year runs July 1 - June 30
 * Example: Sept 25, 2025 = 2025-26 academic year
 */
export function getAcademicYear(raceDate: string | Date): number {
  const date = new Date(raceDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  
  // If race is July-December, academic year starts that year
  // If race is January-June, academic year started previous year
  return month >= 7 ? year : year - 1;
}

/**
 * Convert graduation year to grade level for a specific race date
 * Uses academic year calendar (July 1 - June 30)
 */
export function graduationYearToGrade(graduationYear: number, raceDate: string | Date): number {
  const academicYear = getAcademicYear(raceDate);
  
  // Grade = 12 - (graduation year - academic year)
  // For 2026 grad in 2025-26 academic year: 12 - (2026 - 2025) = 11th grade
  // Wait, that's wrong. Let me recalculate...
  
  // If someone graduates in 2026, they are:
  // - 12th grade during 2025-26 academic year  
  // - 11th grade during 2024-25 academic year
  // So: grade = 12 - (graduationYear - (academicYear + 1))
  
  const grade = 12 - (graduationYear - (academicYear + 1));
  
  // Ensure grade is within expected range
  if (grade >= 9 && grade <= 12) {
    return grade;
  }
  
  // Handle edge cases
  if (grade < 9) return Math.max(grade, 6); // Allow middle school grades
  if (grade > 12) return 13; // Post-graduation
  
  return grade;
}

/**
 * Get grade display string for race results
 */
export function getGradeDisplay(graduationYear: number, raceDate: string | Date): string {
  const grade = graduationYearToGrade(graduationYear, raceDate);
  
  // Only show grades 9-12 for high school
  if (grade >= 9 && grade <= 12) {
    return grade.toString();
  }
  
  // Handle other cases
  if (grade < 9) return 'MS'; // Middle school
  if (grade > 12) return 'PG'; // Post-graduate
  
  return grade.toString();
}

/**
 * Get grade with suffix for display (9th, 10th, 11th, 12th)
 */
export function getGradeWithSuffix(graduationYear: number, raceDate: string | Date): string {
  const grade = graduationYearToGrade(graduationYear, raceDate);
  
  if (grade >= 9 && grade <= 12) {
    const suffixes = { 9: '9th', 10: '10th', 11: '11th', 12: '12th' };
    return suffixes[grade as keyof typeof suffixes] || `${grade}th`;
  }
  
  if (grade < 9) return 'Middle School';
  if (grade > 12) return 'Post-Grad';
  
  return `${grade}th`;
}

// Test the conversion with academic year logic
console.log('Testing academic year conversion:');
console.log('Race on 2025-09-25 academic year:', getAcademicYear('2025-09-25')); // Should be 2025

console.log('Testing grade conversion for 2026 graduate:');
console.log('In Sept 2025 race =', getGradeDisplay(2026, '2025-09-25'), 'grade'); // Should be 12
console.log('In Sept 2024 race =', getGradeDisplay(2026, '2024-09-25'), 'grade'); // Should be 11  
console.log('In Sept 2023 race =', getGradeDisplay(2026, '2023-09-25'), 'grade'); // Should be 10
console.log('In Sept 2022 race =', getGradeDisplay(2026, '2022-09-25'), 'grade'); // Should be 9

console.log('Testing grade conversion for 2029 graduate:');
console.log('In Sept 2025 race =', getGradeDisplay(2029, '2025-09-25'), 'grade'); // Should be 9
console.log('In Sept 2026 race =', getGradeDisplay(2029, '2026-09-25'), 'grade'); // Should be 10