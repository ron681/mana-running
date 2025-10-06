'use client'

import { useEffect, useState } from 'react'
import { courseCRUD, meetCRUD } from '@/lib/crud-operations'
import { supabase } from '@/lib/supabase'

interface Course {
  id: string
  name: string
  distance_meters: number
  distance_miles: number
  mile_difficulty: number
  xc_time_rating: number
  rating_confidence: string
  total_results_count: number
}

interface Meet {
  id: string
  name: string
  meet_date: string
  meet_type: string
  participants_count?: number
}

interface CourseRecord {
  athlete_id: string
  athlete_name: string
  school_id: string
  school_name: string
  time_seconds: number
  race_date: string
  grade: number | 'Overall'
}

interface TeamPerformance {
  school_id: string
  school_name: string
  meet_id: string
  meet_name: string
  meet_date: string
  total_time: number
  runner_count: number
  top_five: Array<{
    athlete_id: string
    athlete_name: string
    time_seconds: number
  }>
}

interface Props {
  params: {
    id: string
  }
}

export default function IndividualCoursePage({ params }: Props) {
  const [course, setCourse] = useState<Course | null>(null)
  const [meets, setMeets] = useState<Meet[]>([])
 const [boysRecords, setBoysRecords] = useState<CourseRecord[]>([])
const [girlsRecords, setGirlsRecords] = useState<CourseRecord[]>([])
const [boysTeams, setBoysTeams] = useState<TeamPerformance[]>([])
const [girlsTeams, setGirlsTeams] = useState<TeamPerformance[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  const loadCourseData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load course details
      const allCourses = await courseCRUD.getAll()
      const currentCourse = allCourses?.find(c => c.id === params.id)
      
      if (!currentCourse) {
        throw new Error('Course not found')
      }
      
      setCourse(currentCourse)

      // Load meets for this course
      const allMeets = await meetCRUD.getAll()
      const courseMeets = allMeets?.filter(meet => 
        meet.course_id === params.id
      ) || []
      
      setMeets(courseMeets)

      // Load course records
      await loadCourseRecords(params.id)

      // Load top team performances
await loadTopTeamPerformances(params.id)

    } catch (err) {
      console.error('Error loading course data:', err)
      setError('Failed to load course data')
    } finally {
      setLoading(false)
    }
  }

  const loadCourseRecords = async (courseId: string) => {
  try {
    // Fetch ALL results for races on this course (no limit on ordering)
    const { data: raceResults, error } = await supabase
      .from('results')
      .select(`
        id,
        time_seconds,
        race:races!inner(
          id,
          gender,
          course_id,
          meet:meets!inner(
            id,
            meet_date
          )
        ),
        athlete:athletes!inner(
          id,
          first_name,
          last_name,
          graduation_year,
          gender,
          school:schools!inner(
            id,
            name
          )
        )
      `)
      .eq('race.course_id', courseId)

    if (error) throw error

    // Process results with proper type handling
    const processedResults = raceResults?.map(r => ({
      ...r,
      race: Array.isArray(r.race) ? r.race[0] : r.race,
      athlete: Array.isArray(r.athlete) ? r.athlete[0] : r.athlete
    })).map(r => ({
      ...r,
      race: {
        ...r.race,
        meet: Array.isArray(r.race.meet) ? r.race.meet[0] : r.race.meet
      },
      athlete: {
        ...r.athlete,
        school: Array.isArray(r.athlete.school) ? r.athlete.school[0] : r.athlete.school
      }
    })) || []

    // Process records for boys
    const boysResults = processedResults.filter(r => 
      r.race?.gender === 'Boys' || r.athlete?.gender === 'M'
    )
    
    const boysRecordsMap = new Map<string, CourseRecord>()
    
    // Overall boys record (fastest time)
    if (boysResults.length > 0) {
      const fastest = boysResults.reduce((prev, curr) => 
        curr.time_seconds < prev.time_seconds ? curr : prev
      )
      boysRecordsMap.set('Overall', {
        athlete_id: fastest.athlete.id,
        athlete_name: `${fastest.athlete.first_name} ${fastest.athlete.last_name}`,
        school_id: fastest.athlete.school.id,
        school_name: fastest.athlete.school.name,
        time_seconds: fastest.time_seconds,
        race_date: fastest.race.meet.meet_date,
        grade: 'Overall'
      })
    }

    // Boys records by grade (9-12) - find fastest for EACH grade
    for (let targetGrade = 9; targetGrade <= 12; targetGrade++) {
      const gradeResults = boysResults.filter(result => {
        const raceDate = new Date(result.race.meet.meet_date)
        const raceYear = raceDate.getFullYear()
        const raceMonth = raceDate.getMonth()
        
        // Athletic year is 7/1 to 6/30 (month 6 = July, month 5 = June)
        const schoolYearEnding = raceMonth >= 6 ? raceYear + 1 : raceYear
        const grade = 12 - (result.athlete.graduation_year - schoolYearEnding)
        
        return grade === targetGrade
      })

      if (gradeResults.length > 0) {
        const fastest = gradeResults.reduce((prev, curr) => 
          curr.time_seconds < prev.time_seconds ? curr : prev
        )
        boysRecordsMap.set(`grade${targetGrade}`, {
          athlete_id: fastest.athlete.id,
          athlete_name: `${fastest.athlete.first_name} ${fastest.athlete.last_name}`,
          school_id: fastest.athlete.school.id,
          school_name: fastest.athlete.school.name,
          time_seconds: fastest.time_seconds,
          race_date: fastest.race.meet.meet_date,
          grade: targetGrade
        })
      }
    }

    // Process records for girls
    const girlsResults = processedResults.filter(r => 
      r.race?.gender === 'Girls' || r.athlete?.gender === 'F'
    )
    
    const girlsRecordsMap = new Map<string, CourseRecord>()
    
    // Overall girls record (fastest time)
    if (girlsResults.length > 0) {
      const fastest = girlsResults.reduce((prev, curr) => 
        curr.time_seconds < prev.time_seconds ? curr : prev
      )
      girlsRecordsMap.set('Overall', {
        athlete_id: fastest.athlete.id,
        athlete_name: `${fastest.athlete.first_name} ${fastest.athlete.last_name}`,
        school_id: fastest.athlete.school.id,
        school_name: fastest.athlete.school.name,
        time_seconds: fastest.time_seconds,
        race_date: fastest.race.meet.meet_date,
        grade: 'Overall'
      })
    }

    // Girls records by grade (9-12) - find fastest for EACH grade
    for (let targetGrade = 9; targetGrade <= 12; targetGrade++) {
      const gradeResults = girlsResults.filter(result => {
        const raceDate = new Date(result.race.meet.meet_date)
        const raceYear = raceDate.getFullYear()
        const raceMonth = raceDate.getMonth()
        
        // Athletic year is 7/1 to 6/30 (month 6 = July, month 5 = June)
        const schoolYearEnding = raceMonth >= 6 ? raceYear + 1 : raceYear
        const grade = 12 - (result.athlete.graduation_year - schoolYearEnding)
        
        return grade === targetGrade
      })

      if (gradeResults.length > 0) {
        const fastest = gradeResults.reduce((prev, curr) => 
          curr.time_seconds < prev.time_seconds ? curr : prev
        )
        girlsRecordsMap.set(`grade${targetGrade}`, {
          athlete_id: fastest.athlete.id,
          athlete_name: `${fastest.athlete.first_name} ${fastest.athlete.last_name}`,
          school_id: fastest.athlete.school.id,
          school_name: fastest.athlete.school.name,
          time_seconds: fastest.time_seconds,
          race_date: fastest.race.meet.meet_date,
          grade: targetGrade
        })
      }
    }

    // Convert to arrays in proper order (Overall, then 9-12)
    const orderedBoysRecords: CourseRecord[] = []
    const orderedGirlsRecords: CourseRecord[] = []

    if (boysRecordsMap.has('Overall')) orderedBoysRecords.push(boysRecordsMap.get('Overall')!)
    for (let grade = 9; grade <= 12; grade++) {
      const key = `grade${grade}`
      if (boysRecordsMap.has(key)) orderedBoysRecords.push(boysRecordsMap.get(key)!)
    }

    if (girlsRecordsMap.has('Overall')) orderedGirlsRecords.push(girlsRecordsMap.get('Overall')!)
    for (let grade = 9; grade <= 12; grade++) {
      const key = `grade${grade}`
      if (girlsRecordsMap.has(key)) orderedGirlsRecords.push(girlsRecordsMap.get(key)!)
    }

    setBoysRecords(orderedBoysRecords)
    setGirlsRecords(orderedGirlsRecords)

  } catch (err) {
    console.error('Error loading course records:', err)
  }
}

const loadTopTeamPerformances = async (courseId: string) => {
  try {
    // Fetch ALL results for races on this course
    const { data: raceResults, error } = await supabase
      .from('results')
      .select(`
        id,
        time_seconds,
        race:races!inner(
          id,
          gender,
          course_id,
          meet:meets!inner(
            id,
            name,
            meet_date
          )
        ),
        athlete:athletes!inner(
          id,
          first_name,
          last_name,
          graduation_year,
          school:schools!inner(
            id,
            name
          )
        )
      `)
      .eq('race.course_id', courseId)

    if (error) throw error

    // Process results with proper type handling
    const processedResults = raceResults?.map(r => ({
      ...r,
      race: Array.isArray(r.race) ? r.race[0] : r.race,
      athlete: Array.isArray(r.athlete) ? r.athlete[0] : r.athlete
    })).map(r => ({
      ...r,
      race: {
        ...r.race,
        meet: Array.isArray(r.race.meet) ? r.race.meet[0] : r.race.meet
      },
      athlete: {
        ...r.athlete,
        school: Array.isArray(r.athlete.school) ? r.athlete.school[0] : r.athlete.school
      }
    })) || []

    // Process boys teams
    const boysResults = processedResults.filter(r => 
      r.race?.gender === 'Boys' || r.athlete?.gender === 'M'
    )
    
    const boysTeamMap = new Map<string, typeof processedResults>()
    
    // Group by RACE + school (not meet + school)
    for (const result of boysResults) {
      const key = `${result.race.id}_${result.athlete.school.id}`
      if (!boysTeamMap.has(key)) {
        boysTeamMap.set(key, [])
      }
      boysTeamMap.get(key)!.push(result)
    }

    // Calculate team scores
    const boysTeamPerformances: TeamPerformance[] = []
    
    for (const [key, teamResults] of boysTeamMap.entries()) {
      // Need at least 5 runners
      if (teamResults.length >= 5) {
        // Sort by time and take top 5
        const sorted = teamResults.sort((a, b) => a.time_seconds - b.time_seconds)
        const topFive = sorted.slice(0, 5)
        const totalTime = topFive.reduce((sum, r) => sum + r.time_seconds, 0)
        
        boysTeamPerformances.push({
          school_id: topFive[0].athlete.school.id,
          school_name: topFive[0].athlete.school.name,
          meet_id: topFive[0].race.meet.id,
          meet_name: topFive[0].race.meet.name,
          meet_date: topFive[0].race.meet.meet_date,
          total_time: totalTime,
          runner_count: teamResults.length,
          top_five: topFive.map(r => ({
            athlete_id: r.athlete.id,
            athlete_name: `${r.athlete.first_name} ${r.athlete.last_name}`,
            time_seconds: r.time_seconds
          }))
        })
      }
    }

    // Sort and take top 5 performances
    boysTeamPerformances.sort((a, b) => a.total_time - b.total_time)
    setBoysTeams(boysTeamPerformances.slice(0, 5))

    // Process girls teams
    const girlsResults = processedResults.filter(r => 
      r.race?.gender === 'Girls' || r.athlete?.gender === 'F'
    )
    
    const girlsTeamMap = new Map<string, typeof processedResults>()
    
    // Group by RACE + school (not meet + school)
    for (const result of girlsResults) {
      const key = `${result.race.id}_${result.athlete.school.id}`
      if (!girlsTeamMap.has(key)) {
        girlsTeamMap.set(key, [])
      }
      girlsTeamMap.get(key)!.push(result)
    }

    // Calculate team scores
    const girlsTeamPerformances: TeamPerformance[] = []
    
    for (const [key, teamResults] of girlsTeamMap.entries()) {
      // Need at least 5 runners
      if (teamResults.length >= 5) {
        // Sort by time and take top 5
        const sorted = teamResults.sort((a, b) => a.time_seconds - b.time_seconds)
        const topFive = sorted.slice(0, 5)
        const totalTime = topFive.reduce((sum, r) => sum + r.time_seconds, 0)
        
        girlsTeamPerformances.push({
          school_id: topFive[0].athlete.school.id,
          school_name: topFive[0].athlete.school.name,
          meet_id: topFive[0].race.meet.id,
          meet_name: topFive[0].race.meet.name,
          meet_date: topFive[0].race.meet.meet_date,
          total_time: totalTime,
          runner_count: teamResults.length,
          top_five: topFive.map(r => ({
            athlete_id: r.athlete.id,
            athlete_name: `${r.athlete.first_name} ${r.athlete.last_name}`,
            time_seconds: r.time_seconds
          }))
        })
      }
    }

    // Sort and take top 5 performances
    girlsTeamPerformances.sort((a, b) => a.total_time - b.total_time)
    setGirlsTeams(girlsTeamPerformances.slice(0, 5))

  } catch (err) {
    console.error('Error loading team performances:', err)
  }
}

  useEffect(() => {
    loadCourseData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

const formatTime = (centiseconds: number): string => {
  const totalSeconds = centiseconds / 100
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  
  // Format seconds with 2 decimal places, pad to 5 chars (00.00)
  const secsStr = secs.toFixed(2).padStart(5, '0')
  
  return `${mins}:${secsStr}`
}

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getDifficultyColor = (mileDifficulty: number) => {
    if (mileDifficulty >= 1.20) return 'bg-red-100 text-red-800'
    if (mileDifficulty >= 1.15) return 'bg-orange-100 text-orange-800'
    if (mileDifficulty >= 1.05) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getDifficultyLabel = (mileDifficulty: number) => {
    if (mileDifficulty >= 1.20) return 'Very Hard'
    if (mileDifficulty >= 1.15) return 'Hard'  
    if (mileDifficulty >= 1.05) return 'Moderate'
    return 'Fast'
  }

  // Pagination for meets
  const totalPages = Math.ceil(meets.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = meets.slice(startIndex, endIndex)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Course Details...</div>
          <div className="text-gray-600">Getting course information...</div>
        </div>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-xl font-semibold mb-2 text-red-600">Error</div>
          <div className="text-gray-600 mb-4">{error || 'Course not found'}</div>
          <a 
            href="/courses"
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Back to Courses
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
            <a href="/" className="hover:text-green-600">Home</a>
            <span className="mx-2">/</span>
            <a href="/courses" className="hover:text-green-600">Courses</a>
            <span className="mx-2">/</span>
            <span className="text-black font-medium">{course.name}</span>
          </nav>
        </div>

        {/* Course Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-black mb-4">{course.name}</h1>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Distance:</span>
                  <div className="font-bold text-black">
                    {course.distance_miles?.toFixed(2)} miles
                  </div>
                  <div className="text-gray-500">
                    {course.distance_meters}m
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Difficulty vs Track Mile:</span>
                  <div className="mt-1">
                    {course.mile_difficulty !== null ? (
                      <div className="flex flex-col space-y-1">
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${getDifficultyColor(course.mile_difficulty)} inline-block w-fit`}>
                          {getDifficultyLabel(course.mile_difficulty)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {course.mile_difficulty.toFixed(3)} multiplier
                        </span>
                      </div>
                    ) : (
                      <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                        No Rating
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">XC Time Rating:</span>
                  <div className="mt-1">
                    {course.xc_time_rating !== null ? (
                      <div className="flex flex-col space-y-1">
                        <span className="px-2 py-1 rounded text-sm font-semibold bg-blue-100 text-blue-800 inline-block w-fit">
                          {course.xc_time_rating.toFixed(3)}
                        </span>
                        <span className="text-xs text-gray-500">
                          Crystal Springs conversion
                        </span>
                      </div>
                    ) : (
                      <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                        No Rating
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Statistics:</span>
                  <div className="font-bold text-black">
                    {meets.length} meets held
                  </div>
                  <div className="text-gray-500">
                    {course.total_results_count || 0} total results
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rating Explanation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm text-blue-800">
              <strong>Rating System:</strong> The difficulty rating shows how much harder this course is compared to a 1-mile track race. 
              For example, 1.125 means 12.5% harder than track mile. The XC Time Rating converts times to Crystal Springs 2.95-mile equivalents for fair comparison across courses.
            </div>
          </div>
        </div>

{/* Course Records Section */}
{(boysRecords.length > 0 || girlsRecords.length > 0) && (
  <div className="bg-white rounded-lg shadow mb-6 p-6">
    <h2 className="text-2xl font-bold text-black mb-4">Course Records</h2>
    
    {/* Disclaimer */}
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
      <div className="flex items-start space-x-2">
        <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> These are the fastest times currently in our database, not official course records. Not all historical races have been imported yet.
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Boys Records */}
      <div>
                <h3 className="text-xl font-bold text-blue-600 mb-4">Boys</h3>
                <div className="space-y-3">
                  {boysRecords.map((record, index) => (
                    <div key={index} className="border-b pb-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-gray-700">
                          {record.grade === 'Overall' ? 'Course Record' : `${record.grade}th Grade`}
                        </span>
                        <span className="font-bold text-black">
                          {formatTime(record.time_seconds)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <a 
                          href={`/athletes/${record.athlete_id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {record.athlete_name}
                        </a>
                        {' - '}
                        <a 
                          href={`/schools/${record.school_id}`}
                          className="text-green-600 hover:text-green-800"
                        >
                          {record.school_name}
                        </a>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(record.race_date)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Girls Records */}
              <div>
                <h3 className="text-xl font-bold text-pink-600 mb-4">Girls</h3>
                <div className="space-y-3">
                  {girlsRecords.map((record, index) => (
                    <div key={index} className="border-b pb-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-gray-700">
                          {record.grade === 'Overall' ? 'Course Record' : `${record.grade}th Grade`}
                        </span>
                        <span className="font-bold text-black">
                          {formatTime(record.time_seconds)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <a 
                          href={`/athletes/${record.athlete_id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {record.athlete_name}
                        </a>
                        {' - '}
                        <a 
                          href={`/schools/${record.school_id}`}
                          className="text-green-600 hover:text-green-800"
                        >
                          {record.school_name}
                        </a>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(record.race_date)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

{/* Top 5 Team Performances */}
{(boysTeams.length > 0 || girlsTeams.length > 0) && (
  <div className="bg-white rounded-lg shadow mb-6 p-6">
    <h2 className="text-2xl font-bold text-black mb-4">Top 5 Team Performances</h2>
    
    {/* Disclaimer */}
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
      <div className="flex items-start space-x-2">
        <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Team times are the sum of the top 5 runners from a school at a single meet on this course.
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Boys Teams */}
      <div>
        <h3 className="text-xl font-bold text-blue-600 mb-4">Boys</h3>
        {boysTeams.length === 0 ? (
          <div className="text-gray-500 text-sm">No complete team performances (5+ runners) found</div>
        ) : (
          <div className="space-y-4">
            {boysTeams.map((team, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-lg text-gray-900">#{index + 1}</div>
                    <a 
                      href={`/schools/${team.school_id}`}
                      className="text-green-600 hover:text-green-800 font-semibold"
                    >
                      {team.school_name}
                    </a>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xl text-black">
                      {formatTime(team.total_time)}
                    </div>
                    <div className="text-xs text-gray-500">Total Time</div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {team.meet_name} • {formatDate(team.meet_date)}
                </div>
                <div className="text-xs space-y-1 mt-2 pt-2 border-t">
                  {team.top_five.map((runner, idx) => (
                    <div key={idx} className="flex justify-between">
                      <a 
                        href={`/athletes/${runner.athlete_id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {idx + 1}. {runner.athlete_name}
                      </a>
                      <span className="text-gray-700 font-mono">
                        {formatTime(runner.time_seconds)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Girls Teams */}
      <div>
        <h3 className="text-xl font-bold text-pink-600 mb-4">Girls</h3>
        {girlsTeams.length === 0 ? (
          <div className="text-gray-500 text-sm">No complete team performances (5+ runners) found</div>
        ) : (
          <div className="space-y-4">
            {girlsTeams.map((team, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-lg text-gray-900">#{index + 1}</div>
                    <a 
                      href={`/schools/${team.school_id}`}
                      className="text-green-600 hover:text-green-800 font-semibold"
                    >
                      {team.school_name}
                    </a>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xl text-black">
                      {formatTime(team.total_time)}
                    </div>
                    <div className="text-xs text-gray-500">Total Time</div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {team.meet_name} • {formatDate(team.meet_date)}
                </div>
                <div className="text-xs space-y-1 mt-2 pt-2 border-t">
                  {team.top_five.map((runner, idx) => (
                    <div key={idx} className="flex justify-between">
                      <a 
                        href={`/athletes/${runner.athlete_id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {idx + 1}. {runner.athlete_name}
                      </a>
                      <span className="text-gray-700 font-mono">
                        {formatTime(runner.time_seconds)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}


        {/* Meets Tab */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b px-6 py-4">
            <h2 className="text-xl font-bold text-black">Meets on Course ({meets.length})</h2>
          </div>

          <div className="p-6">
            {meets.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">No meets found for this course.</div>
                <div className="text-sm text-gray-400">
                  Meets may not have been imported yet.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b text-left bg-gray-50">
                      <th className="py-3 px-4 font-bold text-black">Meet Name</th>
                      <th className="py-3 px-4 font-bold text-black">Date</th>
                      <th className="py-3 px-4 font-bold text-black">Type</th>
                      <th className="py-3 px-4 font-bold text-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((meet) => (
                      <tr key={meet.id} className="border-b hover:bg-gray-50">

<td className="py-3 px-4">
  <a 
    href={`/meets/${meet.id}`}  // CHANGED from /races/ to /meets/
    className="font-bold text-green-600 hover:text-green-800 transition-colors"
  >
    {meet.name || "Unknown Meet"}
  </a>
</td>

                        <td className="py-3 px-4 text-black">
                          {formatDate(meet.meet_date)}
                        </td>
                        <td className="py-3 px-4">
                        </td>
                        <td className="py-3 px-4 text-black">
                          {meet.meet_type || 'N/A'}
                        </td>
<td className="py-3 px-4">
  <a 
    href={`/meets/${meet.id}`}  // CHANGED from /races/ to /meets/
    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
  >
    View Results
  </a>
</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, meets.length)} of {meets.length} meets
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border rounded text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border rounded text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6">
          <a 
            href="/courses"
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
          >
            ← Back to All Courses
          </a>
        </div>
      </div>
    </div>
  )
}