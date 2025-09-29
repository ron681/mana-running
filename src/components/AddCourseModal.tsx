'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, Plus, Calculator } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AddCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseCreated: (course: any) => void;
  initialData?: {
    name?: string;
    distance_meters?: number;
    distance_miles?: number;
  };
}

export default function AddCourseModal({ isOpen, onClose, onCourseCreated, initialData }: AddCourseModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    distance_meters: 4000, // Default to 4K for your Baylands example
    distance_miles: 2.49,   // 4000 meters = ~2.49 miles
    mile__difficulty: 1.0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initialize form with provided data
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        name: initialData.name || '',
        distance_meters: initialData.distance_meters || 4000,
        distance_miles: initialData.distance_miles || 2.49
      }));
    }
  }, [initialData]);

  // Auto-calculate rating when difficulty or distance changes
  useEffect(() => {
    const calculatedRating = (formData.difficulty_rating * 4747) / formData.distance_meters;
    setFormData(prev => ({
      ...prev,
      rating: Math.round(calculatedRating * 10000000) / 10000000 // Round to 7 decimal places
    }));
  }, [formData.difficulty_rating, formData.distance_meters]);

  // Convert meters to miles
  const handleMetersChange = (meters: number) => {
    const miles = meters / 1609.34;
    setFormData(prev => ({
      ...prev,
      distance_meters: meters,
      distance_miles: Math.round(miles * 100) / 100
    }));
  };

  // Convert miles to meters
  const handleMilesChange = (miles: number) => {
    const meters = Math.round(miles * 1609.34);
    setFormData(prev => ({
      ...prev,
      distance_miles: miles,
      distance_meters: meters
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!formData.name.trim()) {
        throw new Error('Course name is required');
      }
      
      if (formData.distance_meters <= 0) {
        throw new Error('Distance must be greater than 0');
      }

      if (formData.difficulty_rating < 0 || formData.difficulty_rating > 100) {
        throw new Error('Difficulty rating must be between 0 and 100');
      }

      // Create the course data with only confirmed existing columns
      const courseData = {
        name: formData.name.trim(), // Required field
        distance_meters: formData.distance_meters,
        distance_miles: formData.distance_miles,
        difficulty_rating: formData.difficulty_rating,
        rating: formData.rating
      };

      console.log('Attempting to create course with data:', courseData);

      // Create the course directly using Supabase to avoid CRUD type issues
      const { data: newCourse, error } = await supabase
        .from('courses')
        .insert(courseData)
        .select()
        .single();

      if (error) throw error;
      onCourseCreated(newCourse);

    } catch (err) {
      console.error('Course creation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create course';
      console.error('Full error details:', {
        error: err,
        message: errorMessage
      });
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      distance_meters: 4000,
      distance_miles: 2.49,
      difficulty_rating: 50.0,
      rating: 0
    });
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Course
              </CardTitle>
              <CardDescription>
                Add a new course with the rating system (difficulty × 4747 ÷ distance)
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Course Name */}
            <div className="space-y-2">
              <Label htmlFor="courseName">Course Name *</Label>
              <Input
                id="courseName"
                type="text"
                placeholder="e.g., Baylands Park"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
              <p className="text-xs text-gray-500">
                This will be used to identify the course in the database
              </p>
            </div>

            {/* Distance Section */}
            <div className="space-y-3">
              <Label>Distance *</Label>
              
              {/* Distance in Meters */}
              <div className="space-y-1">
                <Label htmlFor="distanceMeters" className="text-sm text-gray-600">
                  Meters (primary measurement)
                </Label>
                <Input
                  id="distanceMeters"
                  type="number"
                  min="100"
                  step="1"
                  value={formData.distance_meters}
                  onChange={(e) => handleMetersChange(parseInt(e.target.value) || 0)}
                  required
                />
              </div>

              {/* Distance in Miles */}
              <div className="space-y-1">
                <Label htmlFor="distanceMiles" className="text-sm text-gray-600">
                  Miles (auto-calculated)
                </Label>
                <Input
                  id="distanceMiles"
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={formData.distance_miles}
                  onChange={(e) => handleMilesChange(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              
              <p className="text-xs text-gray-500">
                Common distances: 4000m (4K), 5000m (5K), 3200m (2 mile)
              </p>
            </div>

            {/* Difficulty Rating */}
            <div className="space-y-2">
              <Label htmlFor="difficultyRating">
                Difficulty Rating * (0-100, up to 7 decimal places)
              </Label>
              <Input
                id="difficultyRating"
                type="number"
                min="0"
                max="100"
                step="0.0000001"
                placeholder="50.0"
                value={formData.difficulty_rating}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  difficulty_rating: parseFloat(e.target.value) || 0 
                }))}
                required
              />
              <div className="text-xs text-gray-500 space-y-1">
                <p>• Higher numbers = more difficult courses</p>
                <p>• Consider: hills, terrain, weather, altitude</p>
                <p>• Typical range: 30-70 for most courses</p>
              </div>
            </div>

            {/* Calculated Rating Display */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-medium text-blue-900">
                  Calculated Course Rating
                </Label>
              </div>
              <div className="text-xl font-mono font-bold text-blue-700 mb-2">
                {formData.rating.toFixed(7)}
              </div>
              <div className="text-xs text-blue-600 space-y-1">
                <p>Formula: {formData.difficulty_rating} × (4747 ÷ {formData.distance_meters})</p>
                <p>This rating allows fair comparison across different distances</p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Form Actions */}
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'Creating Course...' : 'Create Course'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}