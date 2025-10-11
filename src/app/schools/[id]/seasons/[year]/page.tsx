// src/app/schools/[id]/seasons/[year]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@/lib/supabase/client'
import { schoolCRUD } from '@/lib/crud-operations'
import TeamSelectionTable from '@/components/TeamSelectionTable'

interface School {
  id: string
  name: string
  state?: string
}

interface AthleteRanking {
  athlete_id: string
  athlete_name: string
  gender: string
  graduation_year: number
  season_pr: number | null
  top_3_average: number | null
  last_3_average: number | null
  race_count: number
  recent_races: { time: number; date: string; meet_name: string }[]
}

interface Props {
  params: {
    id: string
    year: string
  }
}

export default function SeasonDetailPage({ params }: Props) {
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [boysRankings, setBoysRankings] = useState<AthleteRanking[]>([])
  const [girlsRankings, setGirlsRankings] = useState<AthleteRanking[]>([])

  const supabase = createClientComponentClient()
  const seasonYear = parseInt(params.year)

  useEffect(() => {
    loadSchoolData()
  }, [params.id, params.year])

  useEffect(() => {
    if (school) {
      loadTeamRankings()
    }
  }, [school])

  const loadSchoolData = async () => {
    try {
      setLoading(true)
      setError(null)

      const schoolData = await schoolCRUD.getAll()
      const currentSchool = schoolData?.find(s => s.id === params.id)
      
      if (!currentSchool) {
        throw new Error('School not found')
      }
      
      setSchool(currentSchool)
    } catch (err) {
      console.error('Error loading school data:', err)
      setError('Failed to load school data')
    } finally {
      setLoading(false)
    }
  }

  const loadTeamRankings = async () => {
    if (!school) return
    
    try {
      const { data: results, error } = await supabase
        .from('results')
        .select(`
          athlete_id,
          time_seconds,
          race_id,
          season_year,
          athletes!inner (
            id,
            first_name,
            last_name,
            gender,
            graduation_year,
            current_school_id
          ),
          races!inner (
            id,
            meet_id,
            course_id,
            meets (
              name,
              meet_date
            ),
            courses (
              distance_meters,
              mile_difficulty,
              xc_time_rating
            )
          )
        `)
        .eq('athletes.current_school_id', school.id)
        .eq('season_year', seasonYear)
        .order('time_seconds', { ascending: true })
      
      if (error || !results) {
        console.error('Error in team rankings query:', error)
        setBoysRankings([])
        setGirlsRankings([])
        return
      }
      
      // Group results by athlete and calculate XC Times
      const athleteResults = new Map<string, {
        athlete: any
        times: { time: number; xcTime: number; date: string; meet_name: string }[]
      }>()
      
      results.forEach(result => {
        const athlete = Array.isArray(result.athletes) ? result.athletes[0] : result.athletes
        const race = Array.isArray(result.races) ? result.races[0] : result.races
        
        if (!race) return
        
        const meet = race.meets ? (Array.isArray(race.meets) ? race.meets[0] : race.meets) : null
        const course = race.courses ? (Array.isArray(race.courses) ? race.courses[0] : race.courses) : null
        
        if (!athlete || !meet || !course) return
        
        const xcTime = result.time_seconds * course.xc_time_rating
        
        if (!athleteResults.has(result.athlete_id)) {
          athleteResults.set(result.athlete_id, {
            athlete,
            times: []
          })
        }
        
        athleteResults.get(result.athlete_id)!.times.push({
          time: result.time_seconds,
          xcTime: Math.round(xcTime),
          date: meet.meet_date,
          meet_name: meet.name
        })
      })
      
      // Calculate statistics for each athlete using XC Times
      const rankings: AthleteRanking[] = []
      
      athleteResults.forEach(({ athlete, times }) => {
        if (times.length === 0) return
        
        times.sort((a, b) => a.xcTime - b.xcTime)
        
        const season_pr = times[0].xcTime
        
        const top3Times = times.slice(0, Math.min(3, times.length))
        const top_3_average = top3Times.length > 0 
          ? Math.round(top3Times.reduce((sum, t) => sum + t.xcTime, 0) / top3Times.length)
          : null
        
        const sortedByDate = [...times].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        const last3Times = sortedByDate.slice(0, Math.min(3, sortedByDate.length))
        const last_3_average = last3Times.length > 0
          ? Math.round(last3Times.reduce((sum, t) => sum + t.xcTime, 0) / last3Times.length)
          : null
        
        const recent_races = sortedByDate.slice(0, 5).map(race => ({
          time: race.xcTime,
          date: race.date,
          meet_name: race.meet_name
        }))
        
        rankings.push({
          athlete_id: athlete.id,
          athlete_name: `${athlete.last_name}, ${athlete.first_name}`,
          gender: athlete.gender,
          graduation_year: athlete.graduation_year,
          season_pr,
          top_3_average,
          last_3_average,
          race_count: times.length,
          recent_races
        })
      })
      
      const boys = rankings
        .filter(r => r.gender === 'M' || r.gender === 'Boys')
        .sort((a, b) => (a.season_pr || Infinity) - (b.season_pr || Infinity))
      
      const girls = rankings
        .filter(r => r.gender === 'F' || r.gender === 'Girls')
        .sort((a, b) => (a.season_pr || Infinity) - (b.season_pr || Infinity))
      
      setBoysRankings(boys)
      setGirlsRankings(girls)
    } catch (err) {
      console.error('Error loading team rankings:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Season...</div>
          <div className="text-gray-600">Analyzing athlete performance data...</div>
        </div>
      </div>
    )
  }

  if (error || !school) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-xl font-semibold mb-2 text-red-600">Error</div>
          <div className="text-gray-600 mb-4">{error || 'School not found'}</div>
          <a 
            href="/schools"
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Back to Schools
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <nav className="text-sm text-gray-600">
            <a href="/" className="hover:text-red-600">Home</a>
            <span className="mx-2">/</span>
            <a href="/schools" className="hover:text-red-600">Schools</a>
            <span className="mx-2">/</span>
            <a href={`/schools/${school.id}`} className="hover:text-red-600">{school.name}</a>
            <span className="mx-2">/</span>
            <a href={`/schools/${school.id}/seasons`} className="hover:text-red-600">Seasons</a>
            <span className="mx-2">/</span>
            <span className="text-black font-medium">{seasonYear}-{seasonYear + 1}</span>
          </nav>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {school.name} - {seasonYear}-{seasonYear + 1} Season
          </h1>
          <p className="text-lg text-gray-600">
            Team selection, performance analysis, and season results
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <a 
                href={`/schools/${school.id}`}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300"
              >
                Athletes
              </a>
              <a 
                href={`/schools/${school.id}/records`}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300"
              >
                Records & PRs
              </a>
              <a 
                href={`/schools/${school.id}/seasons`}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300"
              >
                Seasons
              </a>
              <a 
                href={`/schools/${school.id}/results`}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300"
              >
                All Results
              </a>
            </nav>
          </div>
        </div>

        {boysRankings.length === 0 && girlsRankings.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-500 mb-4">No race data available for this season.</div>
            <div className="text-sm text-gray-400">
              Results will appear here once races are added for the {seasonYear}-{seasonYear + 1} season.
            </div>
          </div>
        ) : (
          <>
            {/* Boys Team Selection */}
            {boysRankings.length > 0 && (
              <div className="mb-8">
                <TeamSelectionTable 
                  title="Boys Varsity Team Selection"
                  athletes={boysRankings}
                  gender="Boys"
                />
              </div>
            )}

            {/* Girls Team Selection */}
            {girlsRankings.length > 0 && (
              <div className="mb-8">
                <TeamSelectionTable 
                  title="Girls Varsity Team Selection"
                  athletes={girlsRankings}
                  gender="Girls"
                />
              </div>
            )}

            {/* Team Selection Guide */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-blue-900 mb-3">Team Selection Guide</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                <div>
                  <h4 className="font-medium mb-2">XC Time Performance Metrics:</h4>
                  <ul className="space-y-1">
                    <li>• <strong>Season PR:</strong> Fastest XC Time equivalent this season</li>
                    <li>• <strong>Top 3 Average:</strong> Average of athlete's 3 fastest XC Times</li>
                    <li>• <strong>Last 3 Average:</strong> Average of 3 most recent XC Times</li>
                    <li>• <strong>XC Time:</strong> Equivalent time on Crystal Springs 2.95-mile championship course</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Team Selection:</h4>
                  <ul className="space-y-1">
                    <li>• <strong>Varsity Team:</strong> Top 7 runners (5 score, 2 alternates)</li>
                    <li>• <strong>Top 7 highlighted:</strong> Potential varsity lineup in blue</li>
                    <li>• <strong>Fair comparison:</strong> XC Times account for different course difficulties</li>
                    <li>• <strong>Race experience:</strong> Athletes with more races may be more reliable</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-100 rounded text-sm text-blue-800">
                <strong>Note:</strong> XC Times represent equivalent performance on the Crystal Springs 2.95-mile championship course. Course difficulty ratings show how much harder each course is compared to a 1-mile track (e.g., 1.125 = 12.5% harder than track mile).
              </div>
            </div>
          </>
        )}

        {/* Back Button */}
        <div className="mt-6">
          <a 
            href={`/schools/${school.id}/seasons`}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
          >
            ← Back to All Seasons
          </a>
        </div>
      </div>
    </div>
  )
}
