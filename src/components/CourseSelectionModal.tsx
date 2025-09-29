'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { X, MapPin, Ruler, TrendingUp, Plus } from 'lucide-react';

interface Course {
  id: string;
  name: string;
  distance_meters: number;
  distance_miles: number;
  mile_difficulty: number;
  xc_time_rating: number;  // Add this line
}

interface MeetInfo {
  name: string;
  date: string;
  distance: string;
  distanceMeters: number;
  distanceMiles: number;
  courseName: string;
}

interface CourseSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseSelected: (course: Course | null) => void;
  matchingCourses: Course[];
  meetInfo: MeetInfo;
}

export default function CourseSelectionModal({ 
  isOpen, 
  onClose, 
  onCourseSelected, 
  matchingCourses, 
  meetInfo 
}: CourseSelectionModalProps) {
  const [selectedOption, setSelectedOption] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (selectedOption === 'new') {
      onCourseSelected(null); // This will trigger the course creation modal
    } else {
      const selectedCourse = matchingCourses.find(course => course.id === selectedOption);
      onCourseSelected(selectedCourse || null);
    }
  };

  const handleClose = () => {
    setSelectedOption('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Course Selection
              </CardTitle>
              <CardDescription>
                We found existing courses that might match "{meetInfo.courseName}". Please select one or create a new course.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Meet Info */}
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-2">Importing: {meetInfo.name}</div>
              <div className="text-sm">
                Distance: {meetInfo.distance} • Date: {meetInfo.date}
              </div>
            </AlertDescription>
          </Alert>

          {/* Course Selection */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium mb-3 block">Existing Courses:</Label>
              <div className="space-y-3">
                {matchingCourses.map((course) => (
                  <div key={course.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <input
                      type="radio"
                      value={course.id}
                      id={course.id}
                      name="course-selection"
                      checked={selectedOption === course.id}
                      onChange={(e) => setSelectedOption(e.target.value)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <Label htmlFor={course.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{course.name}</div>
                          <div className="text-sm text-gray-600 flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Ruler className="h-3 w-3" />
                              {course.distance_meters}m ({course.distance_miles} miles)
                            </span>
                          <span>Difficulty: {course.mile_difficulty.toFixed(3)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">
                            XC Rating: {course.xc_time_rating.toFixed(3)}
                          </Badge>
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Create New Course Option */}
            <div className="border-t pt-4">
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <input
                  type="radio"
                  value="new"
                  id="new"
                  name="course-selection"
                  checked={selectedOption === 'new'}
                  onChange={(e) => setSelectedOption(e.target.value)}
                  className="h-4 w-4 text-blue-600"
                />
                <Label htmlFor="new" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="font-medium text-blue-600">Create New Course</div>
                      <div className="text-sm text-gray-600">
                        "{meetInfo.courseName}" - {meetInfo.distance}
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel Import
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!selectedOption}
              className="flex-1"
            >
              Continue with Selected Course
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}