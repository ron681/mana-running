// src/app/athletes/page.tsx
'use client'

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface Athlete {
  id: number;
  first_name: string;
  last_name: string;
  graduation_year: number;
  gender: string;
  school_name?: string;
  school_id?: number;
}

async function getAthletes(): Promise<Athlete[]> {
  try {
    const { data: athletes, error } = await supabase
      .from('athletes')
      .select(`
        *,
        school:schools(id, name)
      `)
      .order('last_name');

    if (error) {
      console.error('Error fetching athletes:', error);
      return [];
    }

    if (!athletes || athletes.length === 0) {
      return [];
    }

    const athletesWithSchools = athletes.map(athlete => ({
      id: athlete.id,
      first_name: athlete.first_name,
      last_name: athlete.last_name,
      graduation_year: athlete.graduation_year,
      gender: athlete.gender,
      school_name: athlete.school?.name || 'Unknown School',
      school_id: athlete.school?.id || athlete.current_school_id
    }));

    return athletesWithSchools.sort((a, b) => {
      const lastNameCompare = a.last_name.localeCompare(b.last_name);
      if (lastNameCompare !== 0) return lastNameCompare;

      const firstNameCompare = a.first_name.localeCompare(b.first_name);
      if (firstNameCompare !== 0) return firstNameCompare;

      const gradYearCompare = b.graduation_year - a.graduation_year;
      if (gradYearCompare !== 0) return gradYearCompare;

      const schoolA = a.school_name || '';
      const schoolB = b.school_name || '';
      return schoolA.localeCompare(schoolB);
    });

  } catch (err) {
    console.error('Exception in getAthletes:', err);
    return [];
  }
}

function GenderIcon({ gender }: { gender: string }) {
  if (gender === 'M') {
    return <span className="text-blue-600 ml-2">♂️</span>;
  } else {
    return <span className="text-pink-600 ml-2">♀️</span>;
  }
}

function AthletesList({ athletes }: { athletes: Athlete[] }) {
  if (athletes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-500 font-medium mb-2">No athletes found</div>
        <div className="text-slate-400 text-sm">Check back later for athlete data</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <div className="grid grid-cols-3 gap-4 font-semibold text-slate-700">
          <div>Name</div>
          <div>Grad Year</div>
          <div>School</div>
        </div>
      </div>
      
      <div className="divide-y divide-slate-100">
        {athletes.map((athlete) => (
          <div key={athlete.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="flex items-center">
                <Link
                  href={`/athletes/${athlete.id}`}
                  className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                >
                  {athlete.last_name}, {athlete.first_name}
                </Link>
                <GenderIcon gender={athlete.gender} />
              </div>
              <div className="text-slate-600 font-medium">
                {athlete.graduation_year}
              </div>
              <div className="text-slate-600">
                {athlete.school_id ? (
                  <Link
                    href={`/schools/${athlete.school_id}`}
                    className="text-slate-600 hover:text-blue-600 transition-colors"
                  >
                    {athlete.school_name || 'Unknown School'}
                  </Link>
                ) : (
                  athlete.school_name || 'Unknown School'
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AthletesListWithSearch({ athletes }: { athletes: Athlete[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAthletes = athletes.filter(athlete => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    const fullName = `${athlete.first_name} ${athlete.last_name}`.toLowerCase();
    const reverseName = `${athlete.last_name} ${athlete.first_name}`.toLowerCase();
    const schoolName = (athlete.school_name || '').toLowerCase();
    
    return fullName.includes(search) || 
           reverseName.includes(search) || 
           schoolName.includes(search);
  });

  return (
    <div>
      <div className="p-6 border-b border-slate-200 bg-slate-50">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Search Athletes
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by athlete name or school..."
              className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <svg 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchTerm && (
            <div className="mt-2 text-sm text-slate-600">
              Showing {filteredAthletes.length} of {athletes.length} athletes
            </div>
          )}
        </div>
      </div>
      <AthletesList athletes={filteredAthletes} />
    </div>
  );
}

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAthletes().then(data => {
      setAthletes(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-4">Athletes</h1>
          <p className="text-slate-600 text-lg">
            Complete directory of high school cross country athletes
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-slate-500">Loading athletes...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-4">Athletes</h1>
        <p className="text-slate-600 text-lg">
          Complete directory of high school cross country athletes
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>All Athletes ({athletes.length.toLocaleString()})</span>
            <div className="text-sm font-normal text-slate-500">
              Sorted alphabetically by name
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <AthletesListWithSearch athletes={athletes} />
        </CardContent>
      </Card>
    </div>
  );
}