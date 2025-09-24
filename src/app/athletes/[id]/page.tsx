// src/app/athletes/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatTime } from '@/lib/timeConverter'
import { getGradeDisplay } from '@/lib/grade-utils'

interface Athlete {
  id: string
  first_name: string
  last_name: string
  graduation_year: number
  gender: string
  current_school_id: string
  schools: {
    name: string
  }
}

interface ResultWithDetails {
  id: string
  time_seconds: number
  place_overall: number
  season_year: number
  meet_id: string
  meet_name: string
  meet_date: string
  course_name: string
  distance_miles: number
  difficulty_rating: number
  school_name: string
  first_name: string
  last_name: string
}

interface PersonalBest {
  distance_miles: number
  best_time: number
  meet_name: string
  meet_date: string
  course_name: string
}

function calculatePersonalBests(results: ResultWithDetails[]): PersonalBest[] {
  const bestsByCourse = new Map<string, PersonalBest>()
  
  results.forEach(result => {
    const courseName = result.course_name
    const existing = bestsByCourse.get(courseName)
    
    if (!existing || result.time_seconds < existing.best_time) {
      bestsByCourse.set(courseName, {
        distance_miles: result.distance_miles,
        best_time: result.time_seconds,
        meet_name: result.meet_name,
        meet_date: result.meet_date,
        course_name: result.course_name
      })
    }
  })
  
  return Array.from(bestsByCourse.values())
    .sort((a, b) => a.course_name.localeCompare(b.course_name))
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}


function formatGraduationYear(year: number): string {
  // Ensure we always display full 4-digit year
  if (year < 100) {
    // Handle 2-digit years like 25 -> 2025
    return year < 50 ? `20${year.toString().padStart(2, '0')}` : `19${year}`
  }
  return year.toString()
}

export default function AthletePage({ params }: { params: { id: string } }) {
  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [results, setResults] = useState<ResultWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAthleteData()
  }, [params.id])

  const loadAthleteData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get athlete info
      const { data: athleteData, error: athleteError } = await supabase
        .from('athletes')
        .select(`
          id,
          first_name,
          last_name,
          graduation_year,
          gender,
          current_school_id,
          schools (
            name
          )
        `)
        .eq('id', params.id)
        .single()

      if (athleteError || !athleteData) {
        setError('Athlete not found')
        return
      }

      // Fix the type issue - schools comes as an array but we need single object
      const fixedAthleteData: Athlete = {
        ...athleteData,
        schools: Array.isArray(athleteData.schools) 
          ? athleteData.schools[0] 
          : athleteData.schools
      }

      setAthlete(fixedAthleteData)

      // Get results using results_with_details view (same as homepage)
      const { data: resultsData, error: resultsError } = await supabase
        .from('results_with_details')
        .select('*')
        .eq('athlete_id', params.id)
        .order('meet_date', { ascending: false })

      if (resultsError) {
        console.error('Results error:', resultsError)
        setError('Failed to load race results')
        return
      }

      setResults(resultsData || [])
      console.log('Loaded results:', resultsData) // Debug log

    } catch (err) {
      console.error('Error loading athlete data:', err)
      setError('Failed to load athlete data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>
  }

  if (error || !athlete) {
    return <div className="container mx-auto px-4 py-8">Error: {error || 'Athlete not found'}</div>
  }

  const personalBests = calculatePersonalBests(results)
  const currentSeason = 2025
  const seasonProgression = results.filter(result => result.season_year === currentSeason)
    .sort((a, b) => new Date(a.meet_date).getTime() - new Date(b.meet_date).getTime())
  
  // Calculate season stats using XC times
  const seasonXcTimes = seasonProgression.map(result => {
    return result.time_seconds * (3.1 / result.distance_miles) * (1 + (result.difficulty_rating - 3) * 0.02)
  })
  
  const seasonStats = {
    races: seasonProgression.length,
    avgTime: seasonXcTimes.length > 0 
      ? seasonXcTimes.reduce((sum, time) => sum + time, 0) / seasonXcTimes.length 
      : 0,
    bestTime: seasonXcTimes.length > 0 
      ? Math.min(...seasonXcTimes)
      : 0,
    improvement: seasonXcTimes.length >= 2 
      ? seasonXcTimes[0] - seasonXcTimes[seasonXcTimes.length - 1]
      : 0
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Athlete Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {athlete.first_name} {athlete.last_name}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-gray-600">
              <span className="font-medium">{athlete.schools.name}</span>
              <span>•</span>
              <span>{getGradeDisplay(athlete.graduation_year, new Date().toISOString())}</span>
              <span>•</span>
              <span>Class of {formatGraduationYear(athlete.graduation_year)}</span>
              <span>•</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                {athlete.gender === 'M' ? 'Boys' : 'Girls'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Bests */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Course PRs</h2>
          <div className="text-xs text-gray-500 mb-3">Personal best time on each course</div>
          {personalBests.length > 0 ? (
            <div className="space-y-3">
              {personalBests.map((pb, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-lg text-gray-900">
                        {formatTime(pb.best_time)}
                      </div>
                      <div className="font-medium text-sm text-gray-700">
                        {pb.course_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {pb.distance_miles} miles
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {pb.meet_name} • {formatDate(pb.meet_date)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No race results found.</p>
          )}
        </div>

        {/* Season Stats */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{currentSeason} Season</h2>
          <div className="text-xs text-gray-500 mb-3">XC equivalent times (normalized for course difficulty)</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-blue-600">{seasonStats.races}</div>
              <div className="text-sm text-gray-600">Races</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-green-600">
                {seasonStats.bestTime > 0 ? formatTime(seasonStats.bestTime) : '--'}
              </div>
              <div className="text-sm text-gray-600">Season Best</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-purple-600">
                {seasonStats.avgTime > 0 ? formatTime(Math.round(seasonStats.avgTime)) : '--'}
              </div>
              <div className="text-sm text-gray-600">Avg Time</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className={`text-2xl font-bold ${seasonStats.improvement > 0 ? 'text-green-600' : seasonStats.improvement < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {seasonStats.improvement !== 0 && seasonStats.races >= 2
                  ? (seasonStats.improvement > 0 ? '-' : '+') + formatTime(Math.abs(seasonStats.improvement))
                  : '--'
                }
              </div>
              <div className="text-sm text-gray-600">Improvement</div>
            </div>
          </div>
        </div>

        {/* Season Progression Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Season Progression</h2>
          <div className="text-xs text-gray-500 mb-3">Times shown as XC equivalent (normalized for course difficulty)</div>
          {seasonProgression.length > 0 ? (
            <div className="space-y-2">
              {seasonProgression.map((result, index) => {
                // Calculate XC Time equivalent for 3.1 mile standard
                const xcTime = result.time_seconds * (3.1 / result.distance_miles) * (1 + (result.difficulty_rating - 3) * 0.02)
                
                const isImprovement = index > 0 && xcTime < (seasonProgression[index - 1].time_seconds * (3.1 / seasonProgression[index - 1].distance_miles) * (1 + (seasonProgression[index - 1].difficulty_rating - 3) * 0.02))
                const isPR = personalBests.some(pb => 
                  pb.best_time === result.time_seconds && 
                  pb.distance_miles === result.distance_miles
                )
                
                return (
                  <div key={result.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {formatTime(Math.round(xcTime))}
                        <span className="ml-2 text-xs text-gray-400">({formatTime(result.time_seconds)})</span>
                        {isPR && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">PR</span>}
                        {isImprovement && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">↗</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        #{result.place_overall} • {formatDate(result.meet_date)} • {result.course_name}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 text-right">
                      {result.distance_miles}mi
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500">No races in {currentSeason} season.</p>
          )}
        </div>
      </div>

      {/* Race History */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">All Race Results</h2>
        <div className="mb-4">
          <p className="text-sm text-gray-600">Found {results.length} race results</p>
        </div>
        {results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Meet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Distance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Place
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Season
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result) => {
                  const isPR = personalBests.some(pb => 
                    pb.best_time === result.time_seconds && 
                    pb.distance_miles === result.distance_miles
                  )
                  
                  return (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(result.meet_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <a 
                          href={`/meets/${result.meet_id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {result.meet_name}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.course_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.distance_miles} miles
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatTime(result.time_seconds)}
                        {isPR && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">PR</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        #{result.place_overall}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.season_year}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No race results found.</p>
        )}
      </div>
    </div>
  )
}