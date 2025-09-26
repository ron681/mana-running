// src/app/schools/[id]/team-selection/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { schoolCRUD } from '@/lib/crud-operations'
import { formatTime } from '@/lib/utils'
import TeamSelectionTable from '@/components/TeamSelectionTable'

// Helper function to get current academic year
const getCurrentAcademicYear = () => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // JavaScript months are 0-indexed
  
  // Academic year runs July 1 - June 30
  // If we're in July-December, we're in the first part of the academic year
  // If we're in January-June, we're in the second part of the academic year
  return currentMonth >= 7 ? currentYear : currentYear - 1
}

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
  }
}

export default function TeamSelectionPage({ params }: Props) {
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<number>(getCurrentAcademicYear())
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([])
  const [boysRankings, setBoysRankings] = useState<AthleteRanking[]>([])
  const [girlsRankings, setGirlsRankings] = useState<AthleteRanking[]>([])

  const supabase = createClientComponentClient()

  useEffect(() => {
    loadSchoolData()
  }, [params.id])

  useEffect(() => {
    if (school && availableSeasons.length > 0) {
      loadTeamRankings()
    }
  }, [school, selectedSeason, availableSeasons])

  const loadSchoolData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load school details
      const schoolData = await schoolCRUD.getAll()
      const currentSchool = schoolData?.find(s => s.id === params.id)
      
      if (!currentSchool) {
        throw new Error('School not found')
      }
      
      setSchool(currentSchool)
      await loadAvailableSeasons(params.id)
    } catch (err) {
      console.error('Error loading school data:', err)
      setError('Failed to load school data')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableSeasons = async (schoolId: string) => {
    try {
      console.log('Loading seasons for school ID:', schoolId)
      
      // The season_year is stored directly in the results table!
      const { data, error } = await supabase
        .from('results')
        .select(`
          season_year,
          athletes!inner (
            current_school_id
          )
        `)
        .eq('athletes.current_school_id', schoolId)
      
      console.log('Season query results:', data, 'Error:', error)
      
      if (error) {
        console.error('Error loading seasons:', error)
        return
      }
      
      if (!data || data.length === 0) {
        console.log('No data returned from season query')
        return
      }
      
      // Extract unique season years
      const seasons = new Set<number>()
      data.forEach(result => {
        if (result.season_year) {
          seasons.add(result.season_year)
        }
      })
      
      console.log('Found seasons:', Array.from(seasons))
      
      const seasonArray = Array.from(seasons).sort((a, b) => b - a)
      setAvailableSeasons(seasonArray)
      
      // Set default season
      const currentAcademicYear = getCurrentAcademicYear()
      if (seasonArray.includes(currentAcademicYear)) {
        setSelectedSeason(currentAcademicYear)
      } else if (seasonArray.length > 0) {
        setSelectedSeason(seasonArray[0])
      }
      
      console.log('Final available seasons:', seasonArray)
      console.log('Selected season:', seasonArray.length > 0 ? (seasonArray.includes(currentAcademicYear) ? currentAcademicYear : seasonArray[0]) : null)
    } catch (err) {
      console.error('Error loading seasons:', err)
    }
  }

  const loadTeamRankings = async () => {
    if (!school) return
    
    try {
      console.log('Loading team rankings for school:', school.id, 'season:', selectedSeason)
      
      // Get all results for the school in the specified season with course data for XC Time calculation
      // Results → Meets → Courses relationship path
      const { data: results, error } = await supabase
        .from('results')
        .select(`
          athlete_id,
          time_seconds,
          meet_id,
          season_year,
          athletes!inner (
            id,
            first_name,
            last_name,
            gender,
            graduation_year,
            current_school_id
          ),
          meets!inner (
            name,
            meet_date,
            course_id,
            courses (
              distance_meters,
              mile_difficulty,
              xc_time_rating
            )
          )
        `)
        .eq('athletes.current_school_id', school.id)
        .eq('season_year', selectedSeason)
        .order('time_seconds', { ascending: true })
      
      console.log('Team rankings query results:', results, 'Error:', error)
      
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
        const meet = Array.isArray(result.meets) ? result.meets[0] : result.meets
        const course = meet?.courses ? (Array.isArray(meet.courses) ? meet.courses[0] : meet.courses) : null
        
        console.log('Processing result - athlete:', athlete, 'meet:', meet, 'course:', course)
        
        if (!athlete || !meet || !course) return
        
        // Calculate XC Time using NEW rating system (direct xc_time_rating multiplier)
        const xcTime = result.time_seconds * course.xc_time_rating
        
        // Debug log
        console.log('XC Time Debug:', {
          rawTime: result.time_seconds,
          distanceMeters: course.distance_meters,
          mileDifficulty: course.mile_difficulty,
          xcTimeRating: course.xc_time_rating,
          xcTime: xcTime,
          meetName: meet.name
        })
        
        if (!athleteResults.has(result.athlete_id)) {
          athleteResults.set(result.athlete_id, {
            athlete,
            times: []
          })
        }
        
        athleteResults.get(result.athlete_id)!.times.push({
          time: result.time_seconds,
          xcTime: Math.round(xcTime), // Round XC Time to whole centiseconds
          date: meet.meet_date,
          meet_name: meet.name
        })
      })
      
      console.log('Athlete results map:', athleteResults)
      
      // Calculate statistics for each athlete using XC Times
      const rankings: AthleteRanking[] = []
      
      athleteResults.forEach(({ athlete, times }) => {
        if (times.length === 0) return
        
        // Sort times by XC Time performance (fastest first)
        times.sort((a, b) => a.xcTime - b.xcTime)
        
        // Season PR (fastest XC Time)
        const season_pr = times[0].xcTime
        
        // Top 3 average using XC Times
        const top3Times = times.slice(0, Math.min(3, times.length))
        const top_3_average = top3Times.length > 0 
          ? Math.round(top3Times.reduce((sum, t) => sum + t.xcTime, 0) / top3Times.length)
          : null
        
        // Last 3 average (most recent races) using XC Times
        const sortedByDate = [...times].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        const last3Times = sortedByDate.slice(0, Math.min(3, sortedByDate.length))
        const last_3_average = last3Times.length > 0
          ? Math.round(last3Times.reduce((sum, t) => sum + t.xcTime, 0) / last3Times.length)
          : null
        
        // Get recent races for detailed view (keep original time and XC time)
        const recent_races = sortedByDate.slice(0, 5).map(race => ({
          time: race.xcTime, // Use XC Time for display consistency
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
      
      console.log('Final rankings using XC Time:', rankings)
      
      // Separate by gender and sort by season PR (XC Time)
      const boys = rankings
        .filter(r => r.gender === 'M' || r.gender === 'Boys')
        .sort((a, b) => (a.season_pr || Infinity) - (b.season_pr || Infinity))
      
      const girls = rankings
        .filter(r => r.gender === 'F' || r.gender === 'Girls')
        .sort((a, b) => (a.season_pr || Infinity) - (b.season_pr || Infinity))
      
      console.log('Boys rankings (XC Time):', boys)
      console.log('Girls rankings (XC Time):', girls)
      
      setBoysRankings(boys)
      setGirlsRankings(girls)
    } catch (err) {
      console.error('Error loading team rankings:', err)
    }
  }

  const handleSeasonChange = (season: string) => {
    setSelectedSeason(parseInt(season))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Team Selection...</div>
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
            <span className="text-black font-medium">Team Selection</span>
          </nav>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {school.name} Team Selection
          </h1>
          <p className="text-lg text-gray-600">
            Varsity roster analysis and team selection tools
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
                href={`/schools/${school.id}/results`}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300"
              >
                Season Results
              </a>
              <div className="px-6 py-4 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                Team Selection
              </div>
            </nav>
          </div>
        </div>

        {/* Season Selector */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-center gap-4">
            <label htmlFor="season-select" className="text-sm font-medium text-gray-700">
              Season:
            </label>
            <select
              id="season-select"
              value={selectedSeason.toString()}
              onChange={(e) => handleSeasonChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {availableSeasons.map((season) => (
                <option key={season} value={season.toString()}>
                  {season}-{season + 1} Season
                </option>
              ))}
            </select>
            <div className="text-sm text-gray-500 ml-4">
              {availableSeasons.length === 0 && "No season data available"}
              {boysRankings.length + girlsRankings.length > 0 && 
                `${boysRankings.length + girlsRankings.length} athletes with race data`
              }
            </div>
          </div>
        </div>

        {availableSeasons.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-500 mb-4">No season data available for team selection.</div>
            <div className="text-sm text-gray-400">
              Race results are needed to calculate performance metrics.
            </div>
          </div>
        ) : (
          <>
            {/* Boys Team Selection */}
            <div className="mb-8">
              <TeamSelectionTable 
                title="Boys Varsity Team Selection"
                athletes={boysRankings}
                gender="Boys"
              />
            </div>

            {/* Girls Team Selection */}
            <div className="mb-8">
              <TeamSelectionTable 
                title="Girls Varsity Team Selection"
                athletes={girlsRankings}
                gender="Girls"
              />
            </div>

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
            href={`/schools/${school.id}`}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
          >
            ← Back to {school.name}
          </a>
        </div>
      </div>
    </div>
  )
}