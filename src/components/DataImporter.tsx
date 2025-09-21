'use client'

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Upload, CheckCircle, AlertCircle, Database, Users, MapPin, Trophy, FileText } from 'lucide-react';

interface ImportStats {
  schools: number;
  athletes: number;
  courses: number;
  meets: number;
  results: number;
}

interface FileData {
  athletes: File | null;
  courses: File | null;
  results: File | null;
}

const DataImporter = () => {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [stats, setStats] = useState<ImportStats>({
    schools: 0,
    athletes: 0,
    courses: 0,
    meets: 0,
    results: 0
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [files, setFiles] = useState<FileData>({
    athletes: null,
    courses: null,
    results: null
  });

  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // File upload handlers
  const handleFileUpload = (type: keyof FileData, file: File) => {
    setFiles(prev => ({ ...prev, [type]: file }));
  };

  // Utility functions
  const parseTime = (timeString: string): number => {
    const parts = timeString.split(':');
    if (parts.length !== 2) return 0;
    
    const minutes = parseInt(parts[0]);
    const seconds = parseFloat(parts[1]);
    return Math.round(minutes * 60 + seconds);
  };

  const parseDate = (dateString: string): string => {
    // Convert "11/4/24" to "2024-11-04"
    const parts = dateString.split('/');
    if (parts.length !== 3) return new Date().toISOString().split('T')[0];
    
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000; // Convert 24 to 2024
    
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  const extractAthleteInfo = (athleteString: string) => {
    // "Ketterer, Adrian | 2026" -> {lastName: "Ketterer", firstName: "Adrian", gradYear: 2026}
    const parts = athleteString.split(' | ');
    if (parts.length !== 2) return null;
    
    const namePart = parts[0].trim();
    const gradYear = parseInt(parts[1]);
    
    const nameParts = namePart.split(', ');
    if (nameParts.length !== 2) return null;
    
    return {
      lastName: nameParts[0].trim(),
      firstName: nameParts[1].trim(),
      gradYear: gradYear
    };
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const startImport = async () => {
    // Check if all files are uploaded
    if (!files.courses || !files.athletes || !files.results) {
      setErrors(['Please upload all three CSV files before starting import.']);
      return;
    }

    setImporting(true);
    setErrors([]);
    setCompleted(false);
    setStats({ schools: 0, athletes: 0, courses: 0, meets: 0, results: 0 });

    try {
      // Step 1: Import Courses
      setProgress('Importing courses...');
      await importCourses();

      // Step 2: Import Athletes & Extract Schools
      setProgress('Importing athletes and schools...');
      await importAthletesAndSchools();

      // Step 3: Import Results (creates meets automatically)
      setProgress('Importing results and meets...');
      await importResults();

      setProgress('Import completed successfully!');
      setCompleted(true);

    } catch (error: any) {
      console.error('Import error:', error);
      setErrors(prev => [...prev, `Import failed: ${error.message}`]);
    } finally {
      setImporting(false);
    }
  };

  const importCourses = async () => {
    if (!files.courses) throw new Error('Courses file not found');
    
    const response = await readFileAsText(files.courses);
    const lines = response.split('\n').slice(1); // Skip header
    
    const courses = lines
      .filter(line => line.trim())
      .map(line => {
        // More robust CSV parsing to handle quoted values with commas
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < 3) return null;
        
        const name = matches[0].replace(/"/g, '').trim();
        const distanceInMeters = parseFloat(matches[1]);
        const difficulty = parseFloat(matches[2]);
        
        // Validate data ranges
        if (isNaN(distanceInMeters) || distanceInMeters <= 0 || distanceInMeters > 100000) {
          console.warn(`Invalid distance for course ${name}: ${distanceInMeters}`);
          return null;
        }
        
        if (isNaN(difficulty) || difficulty < 0 || difficulty > 100) {
          console.warn(`Invalid difficulty for course ${name}: ${difficulty}`);
          return null;
        }
        
        return {
          name: name.substring(0, 255), // Ensure name doesn't exceed VARCHAR limit
          distance_meters: Math.round(distanceInMeters),
          difficulty_rating: Math.round(difficulty * 100000) / 100000, // Round to 5 decimal places
          rating_confidence: 'estimated' as const
        };
      })
      .filter(Boolean);

    if (courses.length === 0) {
      throw new Error('No valid courses found in CSV file');
    }

    // Insert courses in smaller batches to avoid timeout
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < courses.length; i += batchSize) {
      const batch = courses.slice(i, i + batchSize);
      const { error } = await supabase
        .from('courses')
        .insert(batch);
      
      if (error) {
        console.error('Course batch error:', error);
        throw new Error(`Error inserting courses batch ${i}: ${error.message}`);
      }
      totalInserted += batch.length;
    }

    setStats(prev => ({ ...prev, courses: totalInserted }));
  };

  const importAthletesAndSchools = async () => {
    if (!files.athletes) throw new Error('Athletes file not found');
    
    const response = await readFileAsText(files.athletes);
    const lines = response.split('\n').slice(1); // Skip header
    
    const athletes = [];
    const schoolsSet = new Set<string>();

    lines
      .filter(line => line.trim())
      .forEach(line => {
        // More robust CSV parsing
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < 6) return;

        const firstName = matches[2].replace(/"/g, '').trim();
        const lastName = matches[3].replace(/"/g, '').trim();
        const gradYear = parseInt(matches[4]);
        const division = matches[5].replace(/"/g, '').trim();
        
        // Validate data
        if (!firstName || !lastName || isNaN(gradYear) || gradYear < 1950 || gradYear > 2050) {
          console.warn(`Invalid athlete data: ${firstName} ${lastName}, grad year: ${gradYear}`);
          return;
        }
        
        if (!['Boys', 'Girls'].includes(division)) {
          console.warn(`Invalid division for ${firstName} ${lastName}: ${division}`);
          return;
        }
        
        const schoolName = `Westmont High School`;
        schoolsSet.add(schoolName);

        athletes.push({
          first_name: firstName.substring(0, 100), // Ensure within VARCHAR limit
          last_name: lastName.substring(0, 100),
          graduation_year: gradYear,
          gender: division === 'Boys' ? 'M' : 'F'
        });
      });

    if (athletes.length === 0) {
      throw new Error('No valid athletes found in CSV file');
    }

    // First insert schools
    const schools = Array.from(schoolsSet).map(name => ({ name: name.substring(0, 255) }));
    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .insert(schools)
      .select();

    if (schoolError) throw schoolError;
    setStats(prev => ({ ...prev, schools: schools.length }));

    // Then insert athletes in batches
    const batchSize = 100;
    let totalInserted = 0;
    
    for (let i = 0; i < athletes.length; i += batchSize) {
      const batch = athletes.slice(i, i + batchSize);
      const { error: athleteError } = await supabase
        .from('athletes')
        .insert(batch);
      
      if (athleteError) {
        console.error('Athlete batch error:', athleteError);
        throw new Error(`Error inserting athletes batch ${i}: ${athleteError.message}`);
      }
      totalInserted += batch.length;
    }

    setStats(prev => ({ ...prev, athletes: totalInserted }));
  };

  const importResults = async () => {
    if (!files.results) throw new Error('Results file not found');
    
    const response = await readFileAsText(files.results);
    const lines = response.split('\n').slice(1); // Skip header
    
    // Get existing courses and athletes for matching
    const { data: courses } = await supabase.from('courses').select('*');
    const { data: athletes } = await supabase.from('athletes').select('*');
    
    const courseMap = new Map();
    courses?.forEach(course => {
      // Try multiple matching strategies
      const baseName = course.name.split('|')[0].trim();
      courseMap.set(course.name, course.id);
      courseMap.set(baseName, course.id);
    });

    const athleteMap = new Map();
    athletes?.forEach(athlete => {
      const key = `${athlete.first_name} ${athlete.last_name}`;
      athleteMap.set(key, athlete);
    });

    const meets = new Map();
    const results = [];
    let processedLines = 0;

    lines
      .filter(line => line.trim())
      .forEach(line => {
        processedLines++;
        
        // More robust CSV parsing for quoted fields
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < 8) return;

        const date = parseDate(matches[0].replace(/"/g, '').trim());
        const athleteString = matches[1].replace(/"/g, '').trim();
        const duration = matches[3].replace(/"/g, '').trim();
        const event = matches[4].replace(/"/g, '').trim();
        const courseString = matches[5].replace(/"/g, '').trim();
        const season = parseInt(matches[7]);

        // Validate season year
        if (isNaN(season) || season < 1950 || season > 2030) {
          console.warn(`Invalid season year: ${season} for line ${processedLines}`);
          return;
        }

        // Extract athlete info
        const athleteInfo = extractAthleteInfo(athleteString);
        if (!athleteInfo) return;

        const athleteKey = `${athleteInfo.firstName} ${athleteInfo.lastName}`;
        const athlete = athleteMap.get(athleteKey);
        if (!athlete) {
          // Skip silently - athlete might not be in our dataset
          return;
        }

        // Find matching course with improved matching
        let courseId = null;
        const courseSearchTerms = [
          courseString,
          courseString.split('|')[0].trim(),
          courseString.split(',')[0].trim()
        ];
        
        for (const searchTerm of courseSearchTerms) {
          for (const [courseName, id] of courseMap) {
            if (courseName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                searchTerm.toLowerCase().includes(courseName.toLowerCase())) {
              courseId = id;
              break;
            }
          }
          if (courseId) break;
        }
        
        if (!courseId) {
          // Skip silently - course might not be in our dataset
          return;
        }

        // Create meet if not exists
        const meetKey = `${event.substring(0, 50)}-${date}-${courseId}-${athlete.gender}`;
        if (!meets.has(meetKey)) {
          meets.set(meetKey, {
            name: event.substring(0, 255), // Ensure within VARCHAR limit
            meet_date: date,
            course_id: courseId,
            gender: athlete.gender
          });
        }

        const timeSeconds = parseTime(duration);

        // Validate time (should be reasonable for cross country)
        if (timeSeconds > 0 && timeSeconds < 7200) { // Between 0 and 2 hours
          results.push({
            athlete_id: athlete.id,
            meet_id: null, // Will be set after meet insertion
            meet_key: meetKey, // Temporary reference
            time_seconds: timeSeconds,
            place_overall: 1, // Default, will be updated later
            season_year: season // Keep original for reference, calculated_season will auto-populate
          });
        }
      });

    console.log(`Processed ${processedLines} lines, found ${results.length} valid results`);

    // Insert meets first
    const meetsArray = Array.from(meets.values());
    const meetIdMap = new Map(); // Map meetKey to actual meet ID
    
    if (meetsArray.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < meetsArray.length; i += batchSize) {
        const batch = meetsArray.slice(i, i + batchSize);
        const { data: insertedMeets, error: meetError } = await supabase
          .from('meets')
          .insert(batch)
          .select('id, name, meet_date, course_id, gender');
        
        if (meetError) {
          console.error('Meet batch error:', meetError);
          throw new Error(`Error inserting meets batch ${i}: ${meetError.message}`);
        }
        
        // Map the meetKey to actual meet ID for results
        if (insertedMeets) {
          insertedMeets.forEach((meet, index) => {
            const originalIndex = i + index;
            const meetKey = Array.from(meets.keys())[originalIndex];
            meetIdMap.set(meetKey, meet.id);
          });
        }
      }
      setStats(prev => ({ ...prev, meets: meetsArray.length }));
    }

    // Then insert results with proper meet IDs
    if (results.length > 0) {
      // Update results with actual meet IDs
      const updatedResults = results.map(result => ({
        athlete_id: result.athlete_id,
        meet_id: meetIdMap.get(result.meet_key),
        time_seconds: result.time_seconds,
        place_overall: result.place_overall,
        season_year: result.season_year
      })).filter(result => result.meet_id); // Only include results with valid meet IDs
      
      const batchSize = 50; // Smaller batches for results
      let totalInserted = 0;
      
      for (let i = 0; i < updatedResults.length; i += batchSize) {
        const batch = updatedResults.slice(i, i + batchSize);
        const { error } = await supabase
          .from('results')
          .insert(batch);
        if (error) {
          console.error('Results batch error:', error);
          setErrors(prev => [...prev, `Error inserting results batch ${i}: ${error.message}`]);
        } else {
          totalInserted += batch.length;
        }
        
        // Update progress
        if (i % 200 === 0) {
          setProgress(`Importing results... ${i + batch.length}/${updatedResults.length}`);
        }
      }
      
      setStats(prev => ({ ...prev, results: totalInserted }));
    }
  };

  const allFilesUploaded = files.athletes && files.courses && files.results;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <Database className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Import System</h1>
          <p className="text-gray-600">Upload and import your Athletes, Courses, and Results CSV files</p>
        </div>

        {/* File Upload Section */}
        <div className="mb-8 space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Step 1: Upload CSV Files</h2>
          
          {/* Courses File */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Courses CSV (414 courses with difficulty ratings)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleFileUpload('courses', e.target.files[0])}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
            />
            {files.courses && (
              <div className="mt-2 flex items-center text-green-600">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">{files.courses.name} uploaded</span>
              </div>
            )}
          </div>

          {/* Athletes File */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Athletes CSV (1,039 athletes)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleFileUpload('athletes', e.target.files[0])}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
            />
            {files.athletes && (
              <div className="mt-2 flex items-center text-green-600">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">{files.athletes.name} uploaded</span>
              </div>
            )}
          </div>

          {/* Results File */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Results CSV (6,711 race results)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleFileUpload('results', e.target.files[0])}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
            />
            {files.results && (
              <div className="mt-2 flex items-center text-green-600">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">{files.results.name} uploaded</span>
              </div>
            )}
          </div>
        </div>

        {/* Import Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg shadow">
            <Users className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-black">{stats.schools}</div>
            <div className="text-sm text-gray-600">Schools</div>
          </div>
          <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg shadow">
            <Users className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-600">{stats.athletes}</div>
            <div className="text-sm text-gray-600">Athletes</div>
          </div>
          <div className="text-center p-4 bg-gray-900 rounded-lg shadow">
            <MapPin className="w-8 h-8 text-white mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{stats.courses}</div>
            <div className="text-sm text-gray-300">Courses</div>
          </div>
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg shadow">
            <Trophy className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-black">{stats.meets}</div>
            <div className="text-sm text-gray-600">Meets</div>
          </div>
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg shadow">
            <Trophy className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-black">{stats.results}</div>
            <div className="text-sm text-gray-600">Results</div>
          </div>
        </div>

        {/* Progress */}
        {progress && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              {importing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-3" />
              ) : completed ? (
                <CheckCircle className="w-4 h-4 text-green-600 mr-3" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 mr-3" />
              )}
              <span className="text-red-800">{progress}</span>
            </div>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-semibold text-red-800 mb-2">Import Errors:</h3>
            <ul className="text-red-700 text-sm space-y-1">
              {errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Import Button */}
        <div className="text-center">
          <button
            onClick={startImport}
            disabled={importing || !allFilesUploaded}
            className={`inline-flex items-center px-6 py-3 rounded-lg font-semibold text-white ${
              importing || !allFilesUploaded
                ? 'bg-gray-400 cursor-not-allowed' 
                : completed 
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {importing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Importing...
              </>
            ) : completed ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Import Completed
              </>
            ) : !allFilesUploaded ? (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Upload All Files First
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Start Import
              </>
            )}
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">Import Process:</h3>
          <ol className="text-gray-600 text-sm space-y-1">
            <li>1. <strong>Upload Files:</strong> Select your Athletes.csv, courses.csv, and Results.csv files</li>
            <li>2. <strong>Courses:</strong> Imports 414 courses with difficulty ratings</li>
            <li>3. <strong>Athletes & Schools:</strong> Imports 1,039 athletes and creates school records</li>
            <li>4. <strong>Results & Meets:</strong> Imports 6,711 results and creates meets automatically</li>
            <li>5. <strong>Data Linking:</strong> Matches athletes and courses by name</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DataImporter;