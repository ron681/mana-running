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
  mile_difficulty: number      // NEW: How hard vs 1-mile track
  xc_time_rating: number       // NEW: For XC time conversion
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

function calculatePace(timeSeconds: number, distanceMiles: number): number {
  return timeSeconds / distanceMiles / 100 // Return pace per mile in seconds
}

function formatPace(paceSeconds: number): string {
  const minutes = Math.floor(paceSeconds / 60)
  const seconds = Math.floor(paceSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getSortValue(result: ResultWithDetails, key: string): any {
  switch (key) {
    case 'date':
      return new Date(result.meet_date).getTime()
    case 'meet':
      return result.meet_name.toLowerCase()
    case 'course':
      return result.course_name.toLowerCase()
    case 'distance':
      return result.distance_miles
    case 'time':
      return result.time_seconds
    case 'pace':
      return calculatePace(result.time_seconds, result.distance_miles)
    case 'mileEquiv':
      return calculatePace(result.time_seconds, result.distance_miles) / result.mile_difficulty
    case 'xcTime':
      return result.time_seconds * result.xc_time_rating
    case 'place':
      return result.place_overall
    case 'season':
      return result.season_year
    default:
      return 0
  }
}

export default function AthletePage({ params }: { params: { id: string } }) {
  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [results, setResults] = useState<ResultWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null)

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

      // Get results using results_with_details view (now includes mile_difficulty and xc_time_rating)
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

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const getSortedResults = () => {
    if (!sortConfig) return results

    return [...results].sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key)
      const bValue = getSortValue(b, sortConfig.key)

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }

  const SortableHeader = ({ sortKey, children }: { sortKey: string; children: React.ReactNode }) => {
    const isActive = sortConfig?.key === sortKey
    const direction = isActive ? sortConfig.direction : null

    return (
      <th 
        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => handleSort(sortKey)}
      >
        <div className="flex items-center space-x-1">
          <span>{children}</span>
          <div className="flex flex-col">
            <svg 
              className={`w-3 h-3 ${isActive && direction === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
            </svg>
            <svg 
              className={`w-3 h-3 -mt-1 ${isActive && direction === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
      </th>
    )
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
  
  // Calculate season stats using NEW XC time formula (direct xc_time_rating multiplier)
  const seasonXcTimes = seasonProgression.map(result => {
    return result.time_seconds * result.xc_time_rating
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
          <div className="text-xs text-gray-500 mb-3">XC equivalent times (Crystal Springs 2.95-mile standard)</div>
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
          <div className="text-xs text-gray-500 mb-3">Times shown as XC equivalent (Crystal Springs 2.95-mile standard)</div>
          {seasonProgression.length > 0 ? (
            <div className="space-y-2">
              {seasonProgression.map((result, index) => {
                // Calculate XC Time equivalent using NEW formula (direct xc_time_rating multiplier)
                const xcTime = result.time_seconds * result.xc_time_rating
                               
                const isImprovement = index > 0 && xcTime < (seasonProgression[index - 1].time_seconds * seasonProgression[index - 1].xc_time_rating)
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
                      <div className="text-xs text-gray-400">
                        Course difficulty: {result.mile_difficulty}x vs track mile
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
                  <SortableHeader sortKey="date">Date</SortableHeader>
                  <SortableHeader sortKey="meet">Meet</SortableHeader>
                  <SortableHeader sortKey="course">Course</SortableHeader>
                  <SortableHeader sortKey="distance">Distance</SortableHeader>
                  <SortableHeader sortKey="time">Time</SortableHeader>
                  <SortableHeader sortKey="pace">Pace</SortableHeader>
                  <SortableHeader sortKey="mileEquiv">Mile Equiv</SortableHeader>
                  <SortableHeader sortKey="xcTime">XC Time</SortableHeader>
                  <SortableHeader sortKey="place">Place</SortableHeader>
                  <SortableHeader sortKey="season">Season</SortableHeader>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getSortedResults().map((result) => {
                  const isPR = personalBests.some(pb => 
                    pb.best_time === result.time_seconds && 
                    pb.distance_miles === result.distance_miles
                  )
                  
                  // Calculate values for new columns
                  const xcTime = result.time_seconds * result.xc_time_rating
                  const pace = calculatePace(result.time_seconds, result.distance_miles)
                  const mileEquiv = pace / result.mile_difficulty
                  
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
                        <div className="text-xs text-gray-400">
                          {result.mile_difficulty}x difficulty
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.distance_miles} miles
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatTime(result.time_seconds)}
                        {isPR && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">PR</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatPace(pace)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatPace(mileEquiv)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatTime(Math.round(xcTime))}
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