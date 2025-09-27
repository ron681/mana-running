// src/app/athletes/page.tsx
import { Suspense } from 'react';
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
    // Use the exact same query pattern as your working CRUD operation
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
      console.log('No athletes found in database');
      return [];
    }

    console.log(`Found ${athletes.length} athletes`);
    console.log('First athlete sample:', athletes[0]);

    // Transform the data using the actual schema
    const athletesWithSchools = athletes.map(athlete => ({
      id: athlete.id,
      first_name: athlete.first_name,
      last_name: athlete.last_name,
      graduation_year: athlete.graduation_year,
      gender: athlete.gender,
      school_name: athlete.school?.name || 'Unknown School',
      school_id: athlete.school?.id || athlete.current_school_id
    }));

    // Sort athletes
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
    return (
      <span className="text-blue-600 ml-2">♂️</span>
    );
  } else {
    return (
      <span className="text-pink-600 ml-2">♀️</span>
    );
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
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <div className="grid grid-cols-3 gap-4 font-semibold text-slate-700">
          <div>Name</div>
          <div>Grad Year</div>
          <div>School</div>
        </div>
      </div>
      
      {/* Athletes List */}
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

export default async function AthletesPage() {
  const athletes = await getAthletes();

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
          <Suspense fallback={
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-slate-500">Loading athletes...</div>
            </div>
          }>
            <AthletesList athletes={athletes} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}