// src/components/SimpleCourseImporter.tsx
// Simple interface to import the AllCourses.csv file

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { importCoursesFromCSV, type BulkImportResult } from '@/lib/bulk-course-import';

interface ImportState {
  step: 'upload' | 'importing' | 'complete';
  progress: number;
  result?: BulkImportResult;
  error?: string;
}

export default function SimpleCourseImporter() {
  const [state, setState] = useState<ImportState>({
    step: 'upload',
    progress: 0
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setState({ step: 'importing', progress: 10 });

    try {
      // Read file content
      const csvContent = await file.text();
      setState(prev => ({ ...prev, progress: 30 }));

      // Import courses
      const result = await importCoursesFromCSV(csvContent);
      setState(prev => ({ ...prev, progress: 100 }));

      // Show results
      setTimeout(() => {
        setState({
          step: 'complete',
          progress: 100,
          result
        });
      }, 500);

    } catch (error) {
      setState({
        step: 'upload',
        progress: 0,
        error: error instanceof Error ? error.message : 'Import failed'
      });
    }
  };

  const resetImporter = () => {
    setState({
      step: 'upload',
      progress: 0
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Course Import</CardTitle>
          <p className="text-sm text-gray-600">
            Import your 115 courses from AllCourses.csv
          </p>
        </CardHeader>
        <CardContent>
          {state.error && (
            <Alert className="mb-4">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {state.step === 'upload' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="csv-file">Upload AllCourses.csv</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="mt-2"
                />
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">What This Will Do:</h4>
                <div className="text-sm space-y-1">
                  <p>✅ Import ~115 courses with correct XC ratings</p>
                  <p>✅ Create names like: "Alum Rock Park | 3701m (2.30 mi)"</p>
                  <p>✅ Update any existing courses with new data</p>
                  <p>✅ Validate all formula calculations</p>
                </div>
              </div>
            </div>
          )}

          {state.step === 'importing' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Importing Courses...</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Processing your course data and validating formulas
                </p>
              </div>

              <Progress value={state.progress} className="w-full" />
              
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            </div>
          )}

          {state.step === 'complete' && state.result && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className={`text-lg font-semibold ${state.result.success ? 'text-green-600' : 'text-red-600'}`}>
                  {state.result.success ? 'Import Successful!' : 'Import Failed'}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-green-600">Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Courses Created:</span>
                      <Badge variant="outline">{state.result.coursesCreated}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Courses Updated:</span>
                      <Badge variant="outline">{state.result.coursesUpdated}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Duplicates Found:</span>
                      <Badge variant="outline">{state.result.duplicatesFound}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-red-600">Issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {state.result.errors.length > 0 ? (
                      <div className="max-h-32 overflow-y-auto">
                        <ul className="text-sm space-y-1">
                          {state.result.errors.slice(0, 5).map((error, index) => (
                            <li key={index} className="text-red-600">{error}</li>
                          ))}
                          {state.result.errors.length > 5 && (
                            <li className="text-gray-500">...and {state.result.errors.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No errors!</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {state.result.success && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Next Steps:</h4>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>✅ Your courses are now imported with correct XC ratings</p>
                    <p>✅ Visit the Courses page to see all your venues</p>
                    <p>✅ Ready to import race results using these courses</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <Button onClick={resetImporter}>Import More</Button>
                <Button variant="outline" asChild>
                  <a href="/courses">View Courses</a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}