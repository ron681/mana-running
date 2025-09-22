'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Database,
  Eye,
  TrendingUp,
  Users,
  MapPin
} from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import { 
  courseCRUD,
  schoolCRUD, 
  athleteCRUD,
  meetCRUD,
  resultCRUD
} from '@/lib/crud-operations';
// import AddCourseModal from './AddCourseModal';
// import CourseSelectionModal from './CourseSelectionModal';
import { 
  timeToSeconds, 
  extractMeetInfo, 
  validateCSVData, 
  normalizeAthleteName, 
  calculateGraduationYear,
  formatFileSize
} from '@/lib/import-utilities';

interface ParsedData {
  Place: number;
  Grade: number;
  Athlete: string;
  Duration: string;
  School: string;
  Race: string;
  Gender: string;
}

interface MeetInfo {
  name: string;
  date: string;
  location: string;
  distance: string;
  distanceMeters: number;
  distanceMiles: number;
  courseName: string;
}

interface ImportProgress {
  stage: string;
  current: number;
  total: number;
  message: string;
}

interface ImportStats {
  coursesCreated: number;
  schoolsCreated: number;
  athletesCreated: number;
  resultsImported: number;
  errors: string[];
}

export default function EnhancedDataImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({ 
    stage: '', 
    current: 0, 
    total: 0, 
    message: '' 
  });
  const [stats, setStats] = useState<ImportStats>({ 
    coursesCreated: 0, 
    schoolsCreated: 0, 
    athletesCreated: 0, 
    resultsImported: 0, 
    errors: [] 
  });
  const [parsedData, setParsedData] = useState<ParsedData[]>([]);
  const [meetInfo, setMeetInfo] = useState<MeetInfo | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showCourseSelectionModal, setShowCourseSelectionModal] = useState(false);
  const [matchingCourses, setMatchingCourses] = useState<any[]>([]);
  const [existingCourse, setExistingCourse] = useState<any>(null);
  const [importComplete, setImportComplete] = useState(false);
  const [dataPreview, setDataPreview] = useState<ParsedData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse CSV file
  const parseCSV = (file: File): Promise<ParsedData[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(), // Clean headers
        complete: (results) => {
          if (results.errors.length > 0) {
            const criticalErrors = results.errors.filter(e => e.type === 'Delimiter');
            if (criticalErrors.length > 0) {
              reject(new Error('CSV parsing failed: ' + criticalErrors.map(e => e.message).join(', ')));
              return;
            }
          }
          
          // Validate the parsed data
          const validation = validateCSVData(results.data);
          if (!validation.isValid) {
            reject(new Error('CSV validation failed: ' + validation.errors.join(', ')));
            return;
          }
          
          resolve(results.data as ParsedData[]);
        },
        error: reject
      });
    });
  };

  // Check if course exists with smart matching
  const checkCourseExists = async (meetInfo: MeetInfo) => {
    try {
      console.log('Getting all courses...');
      const courses = await courseCRUD.getAll();
      console.log('Courses retrieved:', courses.length, 'courses');
      
      // Extract the base name (e.g., "Baylands" from "Baylands Park")
      const baseName = meetInfo.courseName.replace(' Park', '').toLowerCase();
      console.log('Looking for courses matching:', baseName);
      
      // Look for courses that contain the base name
      const matchingCourses = courses.filter(course => {
        if (!course || !course.name) return false;
        const courseName = course.name.toLowerCase();
        const matches = courseName.includes(baseName) || baseName.includes(courseName);
        if (matches) {
          console.log('Found matching course:', course.name);
        }
        return matches;
      });
      
      console.log('Total matching courses found:', matchingCourses.length);
      
      return { matchingCourses, exactMatch: null };
    } catch (error: any) {
      console.error('Error checking courses:', error);
      return { matchingCourses: [], exactMatch: null };
    }
  };

  // Handle file selection and preview
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setImportComplete(false);
    setDataPreview([]);
    setMeetInfo(null);
    
    // If it's a CSV, show preview
    if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
      try {
        const data = await parseCSV(selectedFile);
        setDataPreview(data.slice(0, 5)); // Show first 5 rows
        
        // Extract meet info for preview
        const meetData = extractMeetInfo(data, selectedFile.name);
        setMeetInfo(meetData);
      } catch (error: any) {
        console.error('Error previewing file:', error);
        setStats(prev => ({ 
          ...prev, 
          errors: [`Preview error: ${error.message}`] 
        }));
      }
    }
  };

  // Main import process
  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setImportComplete(false);
    setStats({ coursesCreated: 0, schoolsCreated: 0, athletesCreated: 0, resultsImported: 0, errors: [] });
    
    try {
      // Stage 1: Parse file
      setProgress({ 
        stage: 'Parsing file...', 
        current: 5, 
        total: 100, 
        message: 'Reading and validating file data' 
      });
      
      let data: ParsedData[];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        data = await parseCSV(file);
      } else {
        throw new Error('Currently only CSV files are supported. PDF support coming soon!');
      }

      setParsedData(data);
      
      // Stage 2: Extract meet information
      setProgress({ 
        stage: 'Analyzing meet data...', 
        current: 15, 
        total: 100, 
        message: 'Extracting meet and course information' 
      });
      
      const meetData = extractMeetInfo(data, file.name);
      setMeetInfo(meetData);

      // Stage 3: Check if course exists
      setProgress({ 
        stage: 'Checking course...', 
        current: 25, 
        total: 100, 
        message: 'Looking for existing course in database' 
      });
      
      const { matchingCourses: matches, exactMatch } = await checkCourseExists(meetData);
      
      if (matches.length > 0) {
        // Store the choices and show custom selection UI
        setMatchingCourses(matches);
        setShowCourseSelectionModal(true);
        setIsImporting(false);
        return;
      } else {
        // No matches - would need to create new course, but modal is disabled
        console.log('No matching courses found - would need course creation modal');
        throw new Error('Course creation modal is currently disabled. An existing "Baylands" course was expected but not found.');
      }

    } catch (error: any) {
      console.error('Import error:', error);
      setStats(prev => ({ 
        ...prev, 
        errors: [error.message] 
      }));
      setIsImporting(false);
    }
  };

  // Continue import after course is determined
  const continueImport = async (data: ParsedData[], meetInfo: MeetInfo, courseData: any) => {
    try {
      setIsImporting(true);
      
      // Stage 4: Create meet
      setProgress({ 
        stage: 'Creating meet...', 
        current: 35, 
        total: 100, 
        message: 'Setting up meet record in database' 
      });
      
const meetData = {
  name: meetInfo.name,
  meet_date: meetInfo.date,  // Changed back to meet_date
  course_id: courseData.id,
  meet_type: 'Regular'
};
      const meet = await meetCRUD.create(meetData);

      // Stage 5: Get existing data
      setProgress({ 
        stage: 'Loading existing data...', 
        current: 45, 
        total: 100, 
        message: 'Fetching schools and athletes from database' 
      });
      
      const [allExistingSchools, existingAthletes] = await Promise.all([
        schoolCRUD.getAll(),
        athleteCRUD.getAll()
      ]);

      // Stage 6: Process schools
      setProgress({ 
        stage: 'Processing schools...', 
        current: 55, 
        total: 100, 
        message: 'Creating missing schools' 
      });
      
      const schoolMap = new Map();
      const uniqueSchools = [...new Set(data.map(row => row.School.trim()))];
      
      for (const schoolName of uniqueSchools) {
        let school = allExistingSchools.find(s => 
          s.name.toLowerCase() === schoolName.toLowerCase()
        );
        
        if (!school) {
          // Create school directly using Supabase since schoolCRUD.create doesn't exist
          const { data: newSchool, error } = await supabase
            .from('schools')
            .insert({ name: schoolName })
            .select()
            .single();
          
          if (error) {
            console.error('Error creating school:', error);
            // Use placeholder for now but log the error
            school = { id: 'placeholder', name: schoolName };
          } else {
            school = newSchool;
            setStats(prev => ({ 
              ...prev, 
              schoolsCreated: prev.schoolsCreated + 1 
            }));
          }
        }
        schoolMap.set(schoolName, school);
      }

      // Stage 7: Process athletes
      setProgress({ 
        stage: 'Processing athletes...', 
        current: 65, 
        total: 100, 
        message: 'Creating missing athletes' 
      });
      
      const athleteMap = new Map();
      
      for (const row of data) {
        const { firstName, lastName } = normalizeAthleteName(row.Athlete);
        const school = schoolMap.get(row.School.trim());
        const athleteKey = `${firstName}_${lastName}_${school.id}`;
        
        // Check if athlete already exists
        let athlete = existingAthletes.find(a => 
          a.first_name.toLowerCase() === firstName.toLowerCase() &&
          a.last_name.toLowerCase() === lastName.toLowerCase() &&
          a.current_school_id === school.id
        );

        if (!athlete) {
          const graduationYear = calculateGraduationYear(
            row.Grade || 12, 
            new Date(meetInfo.date).getFullYear()
          );
          
 athlete = await athleteCRUD.create({
    first_name: firstName,
    last_name: lastName,
    graduation_year: graduationYear,
    gender: row.Gender === 'Boys' ? 'M' : row.Gender === 'Girls' ? 'F' : undefined,
    current_school_id: school.id
  });
          
          setStats(prev => ({ 
            ...prev, 
            athletesCreated: prev.athletesCreated + 1 
          }));
        }
        
        athleteMap.set(athleteKey, athlete);
      }

      // Stage 8: Import results
      setProgress({ 
        stage: 'Importing results...', 
        current: 75, 
        total: 100, 
        message: 'Creating race results' 
      });
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const { firstName, lastName } = normalizeAthleteName(row.Athlete);
        const school = schoolMap.get(row.School.trim());
        const athleteKey = `${firstName}_${lastName}_${school.id}`;
        const athlete = athleteMap.get(athleteKey);
        
        if (athlete) {
          const timeInSeconds = timeToSeconds(row.Duration);
          
          if (timeInSeconds > 0) {
            const resultData = {
              athlete_id: athlete.id,
              meet_id: meet.id,
              time_seconds: timeInSeconds, // Store as centiseconds (e.g., 783.60 → 78360)
              place_overall: row.Place || 0,
              season_year: new Date(meetInfo.date).getFullYear()
            };
            
            console.log(`Creating result for ${row.Athlete}:`, resultData);
            
            const { data: result, error: resultError } = await supabase
              .from('results')
              .insert(resultData);
              
            if (resultError) {
              console.error('Result creation error:', resultError);
              setStats(prev => ({ 
                ...prev, 
                errors: [...prev.errors, `Failed to create result for ${row.Athlete}: ${resultError.message}`] 
              }));
              continue; // Skip this result and continue with next
            }
            
            setStats(prev => ({ 
              ...prev, 
              resultsImported: prev.resultsImported + 1 
            }));
          } else {
            setStats(prev => ({ 
              ...prev, 
              errors: [...prev.errors, `Invalid time format for ${row.Athlete}: ${row.Duration}`] 
            }));
          }
        }

        // Update progress
        const progressPercent = 75 + ((i + 1) / data.length) * 20;
        setProgress({ 
          stage: 'Importing results...', 
          current: progressPercent, 
          total: 100, 
          message: `Imported ${i + 1} of ${data.length} results` 
        });
      }

      setProgress({ 
        stage: 'Complete!', 
        current: 100, 
        total: 100, 
        message: 'Import completed successfully' 
      });
      setImportComplete(true);

    } catch (error: any) {
      console.error('Import continuation error:', error);
      setStats(prev => ({ 
        ...prev, 
        errors: [...prev.errors, error.message] 
      }));
    } finally {
      setIsImporting(false);
    }
  };

  // Handle course selection from modal
  const handleCourseSelection = async (course: any) => {
    setShowCourseSelectionModal(false);
    
    if (course) {
      // User selected existing course
      console.log('Using existing course:', course);
      if (parsedData.length > 0 && meetInfo) {
        await continueImport(parsedData, meetInfo, course);
      }
    } else {
      // User wants to create new course
      if (meetInfo && parsedData.length > 0) {
        console.log('Creating new course:', meetInfo.courseName);
        
        // Ask for difficulty rating
        const difficultyInput = prompt(
          `Creating new course: "${meetInfo.courseName}" - ${meetInfo.distance}\n\n` +
          `Please enter difficulty rating (0-100):\n` +
          `Consider: hills, terrain, weather, altitude\n` +
          `Typical range: 30-70`,
          '50'
        );
        
        const difficulty = parseFloat(difficultyInput || '50');
        if (isNaN(difficulty) || difficulty < 0 || difficulty > 100) {
          alert('Invalid difficulty rating. Using default value of 50.');
        }
        
        const finalDifficulty = (isNaN(difficulty) || difficulty < 0 || difficulty > 100) ? 50 : difficulty;
        
        const courseData = {
          name: meetInfo.courseName,
          distance_meters: meetInfo.distanceMeters,
          difficulty_rating: finalDifficulty,
          rating: (finalDifficulty * 4747) / meetInfo.distanceMeters
        };
        
        console.log('Course data being sent:', courseData);
        
        const { data: newCourse, error: courseError } = await supabase
          .from('courses')
          .insert(courseData)
          .select()
          .single();

        if (courseError) {
          console.error('Course creation error details:', courseError);
          setStats(prev => ({ 
            ...prev, 
            errors: [...prev.errors, `Failed to create course: ${courseError.message}`] 
          }));
          setIsImporting(false);
          return;
        }

        console.log('New course created:', newCourse);
        setStats(prev => ({ ...prev, coursesCreated: 1 }));
        
        console.log('Starting continueImport with new course...');
        await continueImport(parsedData, meetInfo, newCourse);
      }
    }
  };

  // Handle course creation completion
  const handleCourseCreated = async (courseData: any) => {
    setShowCourseModal(false);
    if (courseData && parsedData.length > 0 && meetInfo) {
      setStats(prev => ({ ...prev, coursesCreated: 1 }));
      await continueImport(parsedData, meetInfo, courseData);
    }
  };

  // Reset import state
  const resetImport = () => {
    setFile(null);
    setParsedData([]);
    setMeetInfo(null);
    setExistingCourse(null);
    setImportComplete(false);
    setDataPreview([]);
    setShowCourseSelectionModal(false);
    setMatchingCourses([]);
    setStats({ coursesCreated: 0, schoolsCreated: 0, athletesCreated: 0, resultsImported: 0, errors: [] });
    setProgress({ stage: '', current: 0, total: 0, message: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Enhanced Data Importer - Phase 2
          </CardTitle>
          <CardDescription>
            Import meet results from CSV files with intelligent course detection and automatic data creation. PDF support coming soon.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {!importComplete ? (
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload & Import
                </TabsTrigger>
                <TabsTrigger value="preview" disabled={!file} className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview Data
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="space-y-4">
                {/* File Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileSelect(selectedFile);
                    }}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                    <p className="text-xl font-medium text-gray-900 mb-2">
                      {file ? file.name : 'Choose CSV file to import'}
                    </p>
                    <p className="text-sm text-gray-500 mb-2">
                      Currently supports CSV files only
                    </p>
                    <p className="text-xs text-gray-400">
                      PDF support coming in future updates
                    </p>
                    {file && (
                      <Badge variant="secondary" className="mt-2">
                        {formatFileSize(file.size)}
                      </Badge>
                    )}
                  </label>
                </div>

                {/* Meet Info Preview */}
                {meetInfo && (
                  <Card className="bg-blue-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Detected Meet Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Meet:</span>
                        <span>{meetInfo.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Date:</span>
                        <span>{meetInfo.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Distance:</span>
                        <span>{meetInfo.distance} ({meetInfo.distanceMiles} miles)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Course:</span>
                        <span>{meetInfo.courseName}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Import Button */}
                <Button 
                  onClick={handleImport} 
                  disabled={!file || isImporting}
                  className="w-full"
                  size="lg"
                >
                  {isImporting ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Start Import Process
                    </>
                  )}
                </Button>

                {/* Progress */}
                {isImporting && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm font-medium">
                          <span>{progress.stage}</span>
                          <span>{Math.round(progress.current)}%</span>
                        </div>
                        <Progress value={progress.current} className="w-full h-2" />
                        <p className="text-sm text-gray-600">{progress.message}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="preview" className="space-y-4">
                {dataPreview.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Data Preview</CardTitle>
                      <CardDescription>
                        First 5 rows from your CSV file
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Place</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Athlete</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Race</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {dataPreview.map((row, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm text-gray-900">{row.Place}</td>
                                <td className="px-3 py-2 text-sm text-gray-900">{row.Athlete}</td>
                                <td className="px-3 py-2 text-sm font-mono text-gray-900">{row.Duration}</td>
                                <td className="px-3 py-2 text-sm text-gray-900">{row.School}</td>
                                <td className="px-3 py-2 text-sm text-gray-900">{row.Grade}</td>
                                <td className="px-3 py-2 text-sm text-gray-900">{row.Race}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {/* Success State */}
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="font-medium text-green-800">
                  Import completed successfully! Your data has been added to the database.
                </AlertDescription>
              </Alert>

              {/* Import Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50">
                  <CardContent className="text-center py-6">
                    <div className="text-3xl font-bold text-blue-600 mb-2">{stats.coursesCreated}</div>
                    <div className="text-sm font-medium text-blue-800">Courses Created</div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="text-center py-6">
                    <div className="text-3xl font-bold text-green-600 mb-2">{stats.schoolsCreated}</div>
                    <div className="text-sm font-medium text-green-800">Schools Created</div>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50">
                  <CardContent className="text-center py-6">
                    <div className="text-3xl font-bold text-purple-600 mb-2">{stats.athletesCreated}</div>
                    <div className="text-sm font-medium text-purple-800">Athletes Created</div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50">
                  <CardContent className="text-center py-6">
                    <div className="text-3xl font-bold text-orange-600 mb-2">{stats.resultsImported}</div>
                    <div className="text-sm font-medium text-orange-800">Results Imported</div>
                  </CardContent>
                </Card>
              </div>

              {/* Meet Summary */}
              {meetInfo && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Import Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium text-gray-700">Meet Name:</span>
                        <span className="ml-2">{meetInfo.name}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Date:</span>
                        <span className="ml-2">{meetInfo.date}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Distance:</span>
                        <span className="ml-2">{meetInfo.distance}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Total Results:</span>
                        <span className="ml-2">{stats.resultsImported}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Errors */}
              {stats.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">
                      {stats.errors.length} issue(s) occurred during import:
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {stats.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button onClick={resetImport} variant="outline" className="flex-1">
                  Import Another File
                </Button>
                <Button 
                  onClick={() => window.location.href = '/races'} 
                  className="flex-1"
                >
                  View Imported Meet
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Simple Course Selection Modal */}
      {showCourseSelectionModal && meetInfo && matchingCourses.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Course Selection</CardTitle>
              <CardDescription>
                Found existing course that might match "{meetInfo.courseName}". Choose an option:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Course Option */}
              <div className="p-3 border rounded-lg">
                <div className="font-medium">Use Existing Course:</div>
                <div className="text-sm text-gray-600">{matchingCourses[0].name}</div>
              </div>

              {/* New Course Option */}
              <div className="p-3 border rounded-lg">
                <div className="font-medium">Create New Course:</div>
                <div className="text-sm text-gray-600">
                  "{meetInfo.courseName}" - {meetInfo.distance}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => handleCourseSelection(matchingCourses[0])}
                  className="flex-1"
                >
                  Use Existing
                </Button>
                <Button 
                  onClick={() => handleCourseSelection(null)}
                  className="flex-1"
                >
                  New Course
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}