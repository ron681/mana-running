// src/app/courses/import-courses/page.tsx
// CSV file upload interface for importing courses

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';

interface CourseCSVRow {
  Venue: string;
  distance_meters: number;
  mile_difficulty: number;
  xc_rating?: number; // Optional since we calculate this
}

interface ImportState {
  step: 'upload' | 'preview' | 'importing' | 'complete';
  csvData: CourseCSVRow[];
  previewData: CourseCSVRow[];
  importResult?: {
    created: number;
    updated: number;
    errors: string[];
  };
  error?: string;
}

export default function ImportCoursesPage() {
  const [state, setState] = useState<ImportState>({
    step: 'upload',
    csvData: [],
    previewData: []
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setState(prev => ({ ...prev, error: undefined }));

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        try {
          const csvData = results.data.filter((row: any) => 
            row.Venue && 
            row.distance_meters > 0 && 
            row.mile_difficulty > 0
          ) as CourseCSVRow[];

          if (csvData.length === 0) {
            setState(prev => ({ 
              ...prev, 
              error: 'No valid courses found in CSV. Check column names and data format.' 
            }));
            return;
          }

          const previewData = csvData.slice(0, 10);
          
          setState(prev => ({
            ...prev,
            step: 'preview',
            csvData,
            previewData
          }));
        } catch (err) {
          setState(prev => ({
            ...prev,
            error: err instanceof Error ? err.message : 'Failed to process CSV'
          }));
        }
      },
      error: (error) => {
        setState(prev => ({
          ...prev,
          error: `CSV parsing error: ${error.message}`
        }));
      }
    });
  };

  const startImport = async () => {
    setState(prev => ({ ...prev, step: 'importing' }));

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < state.csvData.length; i++) {
      const course = state.csvData[i];
      
      try {
        const distanceMiles = course.distance_meters / 1609.344;
        const milesDisplay = distanceMiles >= 1 ? 
          `${distanceMiles.toFixed(2)} mi` : 
          `${(distanceMiles * 5280).toFixed(0)} ft`;
        
        const courseName = `${course.Venue.trim()} | ${course.distance_meters}m (${milesDisplay})`;

        // Calculate XC time rating using the correct formula
        const calculatedXCRating = (4747 / course.distance_meters) * (1.17688 / course.mile_difficulty);
        const roundedXCRating = Math.round(calculatedXCRating * 1000) / 1000;

        // Check if course exists
        const { data: existing } = await supabase
          .from('courses')
          .select('id, name')
          .ilike('name', `${course.Venue.trim()}%`)
          .gte('distance_meters', course.distance_meters - 50)
          .lte('distance_meters', course.distance_meters + 50);

        if (existing && existing.length > 0) {
          // Update existing course
          const { error } = await supabase
            .from('courses')
            .update({
              name: courseName,
              distance_meters: course.distance_meters,
              mile_difficulty: course.mile_difficulty,
              xc_time_rating: roundedXCRating,
              rating_confidence: 'estimated'
            })
            .eq('id', existing[0].id);

          if (error) {
            errors.push(`${course.Venue}: Update failed - ${error.message}`);
          } else {
            updated++;
          }
        } else {
          // Create new course
          const { error } = await supabase
            .from('courses')
            .insert({
              name: courseName,
              distance_meters: course.distance_meters,
              mile_difficulty: course.mile_difficulty,
              xc_time_rating: roundedXCRating,
              rating_confidence: 'estimated'
            });

          if (error) {
            errors.push(`${course.Venue}: Create failed - ${error.message}`);
          } else {
            created++;
          }
        }

        // Small delay to avoid rate limits
        if (i % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        errors.push(`${course.Venue}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    setState(prev => ({
      ...prev,
      step: 'complete',
      importResult: { created, updated, errors }
    }));
  };

  const resetImporter = () => {
    setState({
      step: 'upload',
      csvData: [],
      previewData: []
    });
  };

  const validateCSVFormat = (): { isValid: boolean; issues: string[] } => {
    const issues: string[] = [];
    
    if (state.csvData.length === 0) {
      issues.push('No data found in CSV file');
      return { isValid: false, issues };
    }

    // Check required columns
    const sampleRow = state.csvData[0];
    if (!sampleRow.Venue) issues.push('Missing "Venue" column');
    if (!sampleRow.distance_meters) issues.push('Missing "distance_meters" column');  
    if (!sampleRow.mile_difficulty) issues.push('Missing "mile_difficulty" column');

    // Check for reasonable data ranges
    const invalidDistances = state.previewData.filter(row => 
      row.distance_meters < 800 || row.distance_meters > 10000
    );
    if (invalidDistances.length > 0) {
      issues.push(`${invalidDistances.length} courses have unusual distances (outside 800-10000m)`);
    }

    const invalidDifficulties = state.previewData.filter(row => 
      row.mile_difficulty < 0.8 || row.mile_difficulty > 3.0
    );
    if (invalidDifficulties.length > 0) {
      issues.push(`${invalidDifficulties.length} courses have unusual difficulty ratings (outside 0.8-3.0)`);
    }

    return { isValid: issues.length === 0, issues };
  };

  const { isValid, issues } = state.step === 'preview' ? validateCSVFormat() : { isValid: true, issues: [] };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Import Courses from CSV</h1>
          <p className="text-gray-600">
            Upload your AllCourses.csv file to import all venues with correct XC ratings
          </p>
        </div>

        {state.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {state.error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          {state.step === 'upload' && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700 mb-2">
                    Select CSV File
                  </label>
                  <input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  />
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-3">Expected CSV Format:</h3>
                  <div className="text-sm text-blue-800 space-y-2">
                    <p><strong>Required columns:</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li><code>Venue</code> - Course venue name</li>
                      <li><code>distance_meters</code> - Distance in meters</li>
                      <li><code>mile_difficulty</code> - Difficulty vs 1-mile track</li>
                    </ul>
                    <p className="mt-3"><strong>Example:</strong></p>
                    <code className="block bg-white p-2 rounded text-xs">
                      Venue,distance_meters,mile_difficulty<br/>
                      Crystal Springs,4747,1.17688<br/>
                      Alum Rock Park,3701,1.13235
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {state.step === 'preview' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Preview Import Data</h2>
                  <p className="text-sm text-gray-600">
                    Found {state.csvData.length} courses. Showing first 10 rows.
                  </p>
                </div>
                <div className={`px-3 py-1 rounded text-sm font-medium ${
                  isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {isValid ? 'Valid' : 'Issues Found'}
                </div>
              </div>

              {!isValid && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  <p className="font-medium mb-2">Data validation issues:</p>
                  <ul className="list-disc list-inside text-sm">
                    {issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto mb-6">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3">Venue</th>
                      <th className="text-left p-3">Distance (m)</th>
                      <th className="text-left p-3">Distance (mi)</th>
                      <th className="text-left p-3">Difficulty</th>
                      <th className="text-left p-3">Calculated XC Rating</th>
                      <th className="text-left p-3">Generated Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.previewData.map((course, index) => {
                      const distanceMiles = course.distance_meters / 1609.344;
                      const milesDisplay = distanceMiles >= 1 ? 
                        `${distanceMiles.toFixed(2)} mi` : 
                        `${(distanceMiles * 5280).toFixed(0)} ft`;
                      const courseName = `${course.Venue.trim()} | ${course.distance_meters}m (${milesDisplay})`;
                      const xcRating = (4747 / course.distance_meters) * (1.17688 / course.mile_difficulty);
                      
                      return (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-3">{course.Venue}</td>
                          <td className="p-3">{course.distance_meters}</td>
                          <td className="p-3">{distanceMiles.toFixed(2)}</td>
                          <td className="p-3">{course.mile_difficulty}</td>
                          <td className="p-3">{xcRating.toFixed(3)}</td>
                          <td className="p-3 text-xs">{courseName}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={startImport}
                  disabled={!isValid}
                  className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {state.csvData.length} Courses
                </button>
                <button
                  onClick={resetImporter}
                  className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
                >
                  Choose Different File
                </button>
              </div>
            </div>
          )}

          {state.step === 'importing' && (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold mb-2">Importing Courses...</h2>
              <p className="text-gray-600">
                Processing {state.csvData.length} courses. This may take a few minutes.
              </p>
            </div>
          )}

          {state.step === 'complete' && state.importResult && (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">✓</div>
                <h2 className="text-2xl font-semibold text-green-600">Import Complete!</h2>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center bg-green-50 p-4 rounded">
                  <div className="text-2xl font-bold text-green-600">{state.importResult.created}</div>
                  <div className="text-sm text-green-800">Created</div>
                </div>
                <div className="text-center bg-blue-50 p-4 rounded">
                  <div className="text-2xl font-bold text-blue-600">{state.importResult.updated}</div>
                  <div className="text-sm text-blue-800">Updated</div>
                </div>
                <div className="text-center bg-red-50 p-4 rounded">
                  <div className="text-2xl font-bold text-red-600">{state.importResult.errors.length}</div>
                  <div className="text-sm text-red-800">Errors</div>
                </div>
              </div>

              {state.importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded mb-6">
                  <h3 className="font-medium text-red-800 mb-2">Import Errors:</h3>
                  <div className="max-h-32 overflow-y-auto">
                    <ul className="text-sm text-red-700 space-y-1">
                      {state.importResult.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="text-center space-x-3">
                <a
                  href="/courses"
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                >
                  View All Courses
                </a>
                <button
                  onClick={resetImporter}
                  className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
                >
                  Import Another File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}