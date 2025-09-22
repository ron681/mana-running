// Flexible time conversion system that handles both formats
class TimeConverter {
  
  // Convert any time format to hundredths for database storage
  static timeToHundredths(timeString: string) {
    if (!timeString || typeof timeString !== 'string') return null;
    
    const parts = timeString.split(':');
    if (parts.length !== 2) return null;
    
    const minutes = parseInt(parts[0]);
    const secondsPart = parts[1];
    
    if (isNaN(minutes)) return null;
    
    // Handle different precision levels
    if (secondsPart.includes('.')) {
      const [secs, decimal] = secondsPart.split('.');
      const seconds = parseInt(secs);
      
      if (decimal.length === 1) {
        // Historical format: "22:42.0" (tenths)
        const tenths = parseInt(decimal);
        return (minutes * 60 * 100) + (seconds * 100) + (tenths * 10);
      } else if (decimal.length === 2) {
        // Future format: "22:42.35" (hundredths)
        const hundredths = parseInt(decimal);
        return (minutes * 60 * 100) + (seconds * 100) + hundredths;
      }
    } else {
      // Whole seconds: "22:42"
      const seconds = parseInt(secondsPart);
      return (minutes * 60 * 100) + (seconds * 100);
    }
    
    return null;
  }
  
  // Convert hundredths back to display format
  static hundredthsToDisplay(hundredths: number, showHundredths = true) {
    if (!hundredths) return '';
    
    const totalSeconds = hundredths / 100;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (showHundredths) {
      return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
    } else {
      // For historical display, show tenths
      return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
    }
  }
  
  // Smart display based on precision available
  static smartDisplay(hundredths: number) {
    if (!hundredths) return '';
    
    // Check if it's a "round" hundredths value (ends in 0)
    const isHistoricalPrecision = (hundredths % 10) === 0;
    
    if (isHistoricalPrecision) {
      // Display as tenths: "22:42.0"
      return this.hundredthsToDisplay(hundredths, false);
    } else {
      // Display full hundredths: "22:42.35"
      return this.hundredthsToDisplay(hundredths, true);
    }
  }
  
  // Detect precision level of original time
  static getPrecisionLevel(hundredths: number) {
    if (!hundredths) return 'unknown';
    
    if (hundredths % 100 === 0) return 'seconds';
    if (hundredths % 10 === 0) return 'tenths';
    return 'hundredths';
  }
}

// Test with your historical data
const testCases = [
  // Historical format (tenths)
  { input: "22:42.0", expected: 136200, type: "historical" },
  { input: "18:26.0", expected: 110600, type: "historical" },
  { input: "15:37.4", expected: 93740, type: "historical" },
  
  // Future format (hundredths)  
  { input: "16:30.25", expected: 99025, type: "future" },
  { input: "17:45.67", expected: 106567, type: "future" },
  { input: "15:23.00", expected: 92300, type: "future" },
  
  // Whole seconds
  { input: "20:15", expected: 121500, type: "basic" }
];

console.log("TIME CONVERSION TESTS:");
console.log("Input      → Hundredths → Smart Display → Precision");
console.log("---------------------------------------------------");

testCases.forEach(test => {
  const hundredths = TimeConverter.timeToHundredths(test.input);
  const smartDisplay = hundredths ? TimeConverter.smartDisplay(hundredths) : "";
  const precision = hundredths ? TimeConverter.getPrecisionLevel(hundredths) : "unknown";
  
  console.log(`${test.input.padEnd(10)} → ${(hundredths !== null ? hundredths.toString() : '').padEnd(8)} → ${smartDisplay.padEnd(11)} → ${precision}`);
});

// For your database schema, add a precision indicator
const exampleResult = {
  athlete_id: "uuid",
  meet_id: "uuid", 
  time_hundredths: 136200,  // Always store as hundredths
  precision_level: "tenths", // Track original precision
  season_year: 2013
};

console.log("\nDatabase Schema Recommendation:");
console.log("- time_hundredths: INTEGER (always normalized to hundredths)");
console.log("- precision_level: VARCHAR (seconds/tenths/hundredths)");
console.log("- Use smartDisplay() for showing times in UI");

// For your CSV processing
type CSVRow = {
  Athlete: string;
  Duration: string;
  Event: string;
  Date: string;
  Course: string;
  Season: string;
  Grade: string;
};

function processResultsCSV(csvData: CSVRow[]) {
  return csvData.map(row => {
    const timeHundredths = TimeConverter.timeToHundredths(row.Duration);
    const precisionLevel = timeHundredths !== null ? TimeConverter.getPrecisionLevel(timeHundredths) : "unknown";
    
    // Parse athlete name
    const [lastName, rest] = row.Athlete.split(',');
    const [firstName, gradYear] = rest.split('|').map(s => s.trim());
    
    return {
      athlete_first_name: firstName,
      athlete_last_name: lastName,
      graduation_year: parseInt(gradYear),
      school_name: "Westmont",
      time_hundredths: timeHundredths,
      precision_level: precisionLevel,
      meet_name: row.Event,
      meet_date: row.Date,
      course_name: row.Course,
      season_year: row.Season,
      grade: row.Grade
    };
  });
}
// Simple wrapper functions for common use cases
export const formatTime = (centiseconds: number): string => {
  return TimeConverter.hundredthsToDisplay(centiseconds);
}

export const parseTime = (timeString: string): number | null => {
  return TimeConverter.timeToHundredths(timeString);
}

export const calculatePace = (centiseconds: number, distanceMiles: number): string => {
  if (!centiseconds || !distanceMiles || distanceMiles <= 0) return '--:--';
  
  const totalSeconds = centiseconds / 100;
  const paceSeconds = totalSeconds / distanceMiles;
  const paceMinutes = Math.floor(paceSeconds / 60);
  const remainingSeconds = Math.floor(paceSeconds % 60);
  
  return `${paceMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}