// src/app/schools/[id]/records/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@/lib/supabase/client'
import { schoolCRUD } from '@/lib/crud-operations'
import { formatTime } from '@/lib/utils'

interface School {
  id: string
  name: string
  state?: string
}

interface Course {
  id: string
  name: string
  distance_miles: number
  xc_time_rating?: number
  mile_difficulty?: number
}

interface CourseStats {
  race_count: number
  result_count: number
}

interface CourseRecord {
  athlete_id: string
  athlete_name: string
  time_seconds: number
  xc_time: number
  course_id: string
  course_name: string
  race_date: string
  meet_name: string
  race_name: string
  grade: number | 'Overall'
}

interface Top10Performance {
  athlete_id: string
  first_name: string
  last_name: string
  time_seconds: number
  xc_time: number
  course_name: string
  meet_name: string
  race_date: string
  graduation_year: number
}

interface TeamRecord {
  school_id: string
  school_name: string
  race_id: string
  course_name: string
  meet_name: string
  race_date: string
  team_time: number
  average_time: number
  runners: {
    name: string
    time_seconds: number
    place_overall?: number
  }[]
}

interface Props {
  params: {
    id: string
  }
}

export default function RecordsPage({ params }: Props) {
  const [school, setSchool] = useState<School | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [courseStats, setCourseStats] = useState<CourseStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [boysRecords, setBoysRecords] = useState<CourseRecord[]>([])
  const [girlsRecords, setGirlsRecords] = useState<CourseRecord[]>([])
  const [boysXCRecords, setBoysXCRecords] = useState<CourseRecord[]>([])
  const [girlsXCRecords, setGirlsXCRecords] = useState<CourseRecord[]>([])
  
  // New state for Top 10 and Team Records
  const [boysTop10, setBoysTop10] = useState<Top10Performance[]>([])
  const [girlsTop10, setGirlsTop10] = useState<Top10Performance[]>([])
  const [boysTeamRecords, setBoysTeamRecords] = useState<TeamRecord[]>([])
  const [girlsTeamRecords, setGirlsTeamRecords] = useState<TeamRecord[]>([])

  const supabase = createClientComponentClient()

  useEffect(() => {
    loadData()
  }, [params.id])

  useEffect(() => {
    if (selectedCourse) {
      loadCourseRecords(selectedCourse)
      loadCourseStats(selectedCourse)
    }
  }, [selectedCourse])

  const loadData = async () => {
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

      // Load all courses this school has competed on with full details
      const { data: schoolResults, error: resultsError } = await supabase
        .from('results')
        .select(`
          race:races!inner(
            course:courses!inner(
              id,
              name,
              distance_miles,
              xc_time_rating,
              mile_difficulty
            )
          ),
          athlete:athletes!inner(
            current_school_id
          )
        `)
        .eq('athlete.current_school_id', params.id)

      if (resultsError) {
        console.error('Error loading courses:', resultsError)
        throw resultsError
      }

      // Extract unique courses
      const courseMap = new Map<string, Course>()
      
      schoolResults?.forEach((result) => {
        const race = Array.isArray(result.race) ? result.race[0] : result.race
        if (!race) return
        
        const course = Array.isArray(race.course) ? race.course[0] : race.course
        if (!course) return

        if (!courseMap.has(course.id)) {
          courseMap.set(course.id, {
            id: course.id,
            name: course.name,
            distance_miles: course.distance_miles,
            xc_time_rating: course.xc_time_rating,
            mile_difficulty: course.mile_difficulty
          })
        }
      })

      const uniqueCourses = Array.from(courseMap.values())
        .sort((a, b) => a.name.localeCompare(b.name))

      setCourses(uniqueCourses)

      // Auto-select first course
      if (uniqueCourses.length > 0) {
        setSelectedCourse(uniqueCourses[0].id)
      }

      // Load overall XC Time records
      await loadOverallXCRecords()
      
      // Load Top 10 performances
      await loadTop10Performances()
      
      // Load team records
      await loadTeamRecords()

    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load records')
    } finally {
      setLoading(false)
    }
  }

  const loadCourseStats = async (courseId: string) => {
    try {
      // Count races on this course
      const { count: raceCount, error: raceError } = await supabase
        .from('races')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', courseId)

      if (raceError) throw raceError

      // Get race IDs for this course, then count results
      const { data: raceIds, error: raceIdsError } = await supabase
        .from('races')
        .select('id')
        .eq('course_id', courseId)

      if (raceIdsError) throw raceIdsError

      const raceIdList = raceIds?.map(r => r.id) || []

      // Count results for these races
      const { count: resultCount, error: resultError } = await supabase
        .from('results')
        .select('id', { count: 'exact', head: true })
        .in('race_id', raceIdList)

      if (resultError) throw resultError

      setCourseStats({
        race_count: raceCount || 0,
        result_count: resultCount || 0
      })

    } catch (err) {
      console.error('Error loading course stats:', err)
      setCourseStats({
        race_count: 0,
        result_count: 0
      })
    }
  }

  const loadOverallXCRecords = async () => {
    try {
      console.log('=== LOADING XC RECORDS FOR SCHOOL:', params.id)
      
      // Fetch ALL results for this school across all courses with XC Time rating
      const { data: raceResults, error } = await supabase
        .from('results')
        .select(`
          id,
          time_seconds,
          race:races!inner(
            id,
            name,
            gender,
            course:courses!inner(
              id,
              name,
              xc_time_rating
            ),
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
            gender,
            current_school_id
          )
        `)
        .eq('athlete.current_school_id', params.id)
        .not('race.course.xc_time_rating', 'is', null)

      console.log('Raw results count:', raceResults?.length)
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
          meet: Array.isArray(r.race.meet) ? r.race.meet[0] : r.race.meet,
          course: Array.isArray(r.race.course) ? r.race.course[0] : r.race.course
        }
      })).map(r => ({
        ...r,
        xc_time: Math.round(r.time_seconds * r.race.course.xc_time_rating)
      })) || []

      // Process boys XC records
      const boysResults = processedResults.filter(r => 
        r.race?.gender === 'Boys' || r.athlete?.gender === 'M'
      )
      
      console.log('Total processed results:', processedResults.length)
      console.log('Boys results after filter:', boysResults.length)
      
      const boysXCMap = new Map<string, any>()
      
      // Overall boys XC record
      if (boysResults.length > 0) {
        const fastest = boysResults.reduce((prev, curr) => 
          curr.xc_time < prev.xc_time ? curr : prev
        )
        boysXCMap.set('Overall', {
          athlete_id: fastest.athlete.id,
          athlete_name: `${fastest.athlete.first_name} ${fastest.athlete.last_name}`,
          time_seconds: fastest.time_seconds,
          xc_time: fastest.xc_time,
          course_id: fastest.race.course.id,
          course_name: fastest.race.course.name,
          race_date: fastest.race.meet.meet_date,
          meet_name: fastest.race.meet.name,
          race_name: fastest.race.name,
          grade: 'Overall'
        })
      }

      // Boys XC records by grade
      for (let targetGrade = 9; targetGrade <= 12; targetGrade++) {
        const gradeResults = boysResults.filter(result => {
          const raceDate = new Date(result.race.meet.meet_date)
          const raceYear = raceDate.getFullYear()
          const raceMonth = raceDate.getMonth()
          
          const schoolYearEnding = raceMonth >= 6 ? raceYear + 1 : raceYear
          const grade = 12 - (result.athlete.graduation_year - schoolYearEnding)
          
          return grade === targetGrade
        })

        if (gradeResults.length > 0) {
          const fastest = gradeResults.reduce((prev, curr) => 
            curr.xc_time < prev.xc_time ? curr : prev
          )
          boysXCMap.set(`grade${targetGrade}`, {
            athlete_id: fastest.athlete.id,
            athlete_name: `${fastest.athlete.first_name} ${fastest.athlete.last_name}`,
            time_seconds: fastest.time_seconds,
            xc_time: fastest.xc_time,
            course_id: fastest.race.course.id,
            course_name: fastest.race.course.name,
            race_date: fastest.race.meet.meet_date,
            meet_name: fastest.race.meet.name,
            race_name: fastest.race.name,
            grade: targetGrade
          })
        }
      }

      // Process girls XC records
      const girlsResults = processedResults.filter(r => 
        r.race?.gender === 'Girls' || r.athlete?.gender === 'F'
      )
      
      const girlsXCMap = new Map<string, any>()
      
      // Overall girls XC record
      if (girlsResults.length > 0) {
        const fastest = girlsResults.reduce((prev, curr) => 
          curr.xc_time < prev.xc_time ? curr : prev
        )
        girlsXCMap.set('Overall', {
          athlete_id: fastest.athlete.id,
          athlete_name: `${fastest.athlete.first_name} ${fastest.athlete.last_name}`,
          time_seconds: fastest.time_seconds,
          xc_time: fastest.xc_time,
          course_id: fastest.race.course.id,
          course_name: fastest.race.course.name,
          race_date: fastest.race.meet.meet_date,
          meet_name: fastest.race.meet.name,
          race_name: fastest.race.name,
          grade: 'Overall'
        })
      }

      // Girls XC records by grade
      for (let targetGrade = 9; targetGrade <= 12; targetGrade++) {
        const gradeResults = girlsResults.filter(result => {
          const raceDate = new Date(result.race.meet.meet_date)
          const raceYear = raceDate.getFullYear()
          const raceMonth = raceDate.getMonth()
          
          const schoolYearEnding = raceMonth >= 6 ? raceYear + 1 : raceYear
          const grade = 12 - (result.athlete.graduation_year - schoolYearEnding)
          
          return grade === targetGrade
        })

        if (gradeResults.length > 0) {
          const fastest = gradeResults.reduce((prev, curr) => 
            curr.xc_time < prev.xc_time ? curr : prev
          )
          girlsXCMap.set(`grade${targetGrade}`, {
            athlete_id: fastest.athlete.id,
            athlete_name: `${fastest.athlete.first_name} ${fastest.athlete.last_name}`,
            time_seconds: fastest.time_seconds,
            xc_time: fastest.xc_time,
            course_id: fastest.race.course.id,
            course_name: fastest.race.course.name,
            race_date: fastest.race.meet.meet_date,
            meet_name: fastest.race.meet.name,
            race_name: fastest.race.name,
            grade: targetGrade
          })
        }
      }

      // Convert to arrays in proper order
      const orderedBoysXC: CourseRecord[] = []
      const orderedGirlsXC: CourseRecord[] = []

      if (boysXCMap.has('Overall')) orderedBoysXC.push(boysXCMap.get('Overall')!)
      for (let grade = 9; grade <= 12; grade++) {
        const key = `grade${grade}`
        if (boysXCMap.has(key)) orderedBoysXC.push(boysXCMap.get(key)!)
      }

      if (girlsXCMap.has('Overall')) orderedGirlsXC.push(girlsXCMap.get('Overall')!)
      for (let grade = 9; grade <= 12; grade++) {
        const key = `grade${grade}`
        if (girlsXCMap.has(key)) orderedGirlsXC.push(girlsXCMap.get(key)!)
      }

      setBoysXCRecords(orderedBoysXC)
      setGirlsXCRecords(orderedGirlsXC)
      
      console.log('Boys XC Records:', orderedBoysXC.length)
      console.log('Girls XC Records:', orderedGirlsXC.length)

    } catch (err) {
      console.error('Error loading overall XC records:', err)
    }
  }

  const loadTop10Performances = async () => {
    if (!school) return

    try {
      // Query for boys top 10
      const { data: boysData, error: boysError } = await supabase
        .from('results')
        .select(`
          athlete_id,
          time_seconds,
          athletes!inner(
            first_name,
            last_name,
            graduation_year,
            gender,
            current_school_id
          ),
          races!inner(
            course_id,
            meet_id,
            courses(
              name,
              xc_time_rating
            ),
            meets(
              name,
              meet_date
            )
          )
        `)
        .eq('athletes.current_school_id', school.id)
        .eq('athletes.gender', 'M')
        .not('races.courses.xc_time_rating', 'is', null)
        .order('time_seconds', { ascending: true })
        .limit(100)

      if (!boysError && boysData) {
        const boysPerformances = boysData
          .map(r => {
            const athlete = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
            const race = Array.isArray(r.races) ? r.races[0] : r.races
            const course = race?.courses as any
            const meet = race?.meets as any
            
            if (!course?.xc_time_rating) return null

            return {
              athlete_id: r.athlete_id,
              first_name: athlete.first_name,
              last_name: athlete.last_name,
              time_seconds: r.time_seconds,
              xc_time: Math.round(r.time_seconds * course.xc_time_rating),
              course_name: course.name,
              meet_name: meet?.name || '',
              race_date: meet?.meet_date || '',
              graduation_year: athlete.graduation_year
            }
          })
          .filter((p): p is Top10Performance => p !== null)
          .sort((a, b) => a.xc_time - b.xc_time)
          .slice(0, 10)

        setBoysTop10(boysPerformances)
      }

      // Query for girls top 10
      const { data: girlsData, error: girlsError } = await supabase
        .from('results')
        .select(`
          athlete_id,
          time_seconds,
          athletes!inner(
            first_name,
            last_name,
            graduation_year,
            gender,
            current_school_id
          ),
          races!inner(
            course_id,
            meet_id,
            courses(
              name,
              xc_time_rating
            ),
            meets(
              name,
              meet_date
            )
          )
        `)
        .eq('athletes.current_school_id', school.id)
        .eq('athletes.gender', 'F')
        .not('races.courses.xc_time_rating', 'is', null)
        .order('time_seconds', { ascending: true })
        .limit(100)

      if (!girlsError && girlsData) {
        const girlsPerformances = girlsData
          .map(r => {
            const athlete = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
            const race = Array.isArray(r.races) ? r.races[0] : r.races
            const course = race?.courses as any
            const meet = race?.meets as any
            
            if (!course?.xc_time_rating) return null

            return {
              athlete_id: r.athlete_id,
              first_name: athlete.first_name,
              last_name: athlete.last_name,
              time_seconds: r.time_seconds,
              xc_time: Math.round(r.time_seconds * course.xc_time_rating),
              course_name: course.name,
              meet_name: meet?.name || '',
              race_date: meet?.meet_date || '',
              graduation_year: athlete.graduation_year
            }
          })
          .filter((p): p is Top10Performance => p !== null)
          .sort((a, b) => a.xc_time - b.xc_time)
          .slice(0, 10)

        setGirlsTop10(girlsPerformances)
      }

    } catch (err) {
      console.error('Error loading top 10:', err)
    }
  }

  const loadTeamRecords = async () => {
    if (!school) return

    try {
      // Get all results for this school
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select(`
          athlete_id,
          time_seconds,
          place_overall,
          race_id,
          athletes!inner(
            first_name,
            last_name,
            gender,
            current_school_id
          ),
          races!inner(
            id,
            course_id,
            meet_id,
            courses(
              name
            ),
            meets(
              name,
              meet_date
            )
          )
        `)
        .eq('athletes.current_school_id', school.id)
        .order('time_seconds', { ascending: true })

      if (resultsError || !resultsData) return

      // Group by race and gender
      const raceGroupsMap = new Map<string, any[]>()

      resultsData.forEach(result => {
        const athlete = Array.isArray(result.athletes) ? result.athletes[0] : result.athletes
        const race = Array.isArray(result.races) ? result.races[0] : result.races
        
        const key = `${result.race_id}_${athlete.gender}`
        if (!raceGroupsMap.has(key)) {
          raceGroupsMap.set(key, [])
        }
        
        raceGroupsMap.get(key)?.push({
          ...result,
          athlete,
          race
        })
      })

      // Calculate team times for races with 5+ runners
      const boysTeams: TeamRecord[] = []
      const girlsTeams: TeamRecord[] = []

      raceGroupsMap.forEach((results, key) => {
        if (results.length < 5) return

        const gender = key.split('_')[1]
        const sortedResults = results.sort((a, b) => a.time_seconds - b.time_seconds)
        const top5 = sortedResults.slice(0, 5)

        const teamTime = top5.reduce((sum, r) => sum + r.time_seconds, 0)
        const avgTime = teamTime / 5

        const race = top5[0].race
        const course = race?.courses as any
        const meet = race?.meets as any

        const teamRecord: TeamRecord = {
          school_id: school.id,
          school_name: school.name,
          race_id: race.id,
          course_name: course?.name || '',
          meet_name: meet?.name || '',
          race_date: meet?.meet_date || '',
          team_time: teamTime,
          average_time: avgTime,
          runners: top5.map(r => ({
            name: `${r.athlete.first_name} ${r.athlete.last_name}`,
            time_seconds: r.time_seconds,
            place_overall: r.place_overall
          }))
        }

        if (gender === 'M') {
          boysTeams.push(teamRecord)
        } else if (gender === 'F') {
          girlsTeams.push(teamRecord)
        }
      })

      // Sort by team time and keep top 10
      setBoysTeamRecords(boysTeams.sort((a, b) => a.team_time - b.team_time).slice(0, 10))
      setGirlsTeamRecords(girlsTeams.sort((a, b) => a.team_time - b.team_time).slice(0, 10))

    } catch (err) {
      console.error('Error loading team records:', err)
    }
  }

  const loadCourseRecords = async (courseId: string) => {
    try {
      // Fetch results for this school on this course
      const { data: raceResults, error } = await supabase
        .from('results')
        .select(`
          id,
          time_seconds,
          race:races!inner(
            id,
            name,
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
            gender,
            current_school_id
          )
        `)
        .eq('race.course_id', courseId)
        .eq('athlete.current_school_id', params.id)

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
        }
      })) || []

      // Process boys records
      const boysResults = processedResults.filter(r => 
        r.race?.gender === 'Boys' || r.athlete?.gender === 'M'
      )
      
      const boysRecordsMap = new Map<string, CourseRecord>()
      
      // Overall boys record
      if (boysResults.length > 0) {
        const fastest = boysResults.reduce((prev, curr) => 
          curr.time_seconds < prev.time_seconds ? curr : prev
        )
        boysRecordsMap.set('Overall', {
          athlete_id: fastest.athlete.id,
          athlete_name: `${fastest.athlete.first_name} ${fastest.athlete.last_name}`,
          time_seconds: fastest.time_seconds,
          xc_time: 0,
          course_id: courseId,
          course_name: '',
          race_date: fastest.race.meet.meet_date,
          meet_name: fastest.race.meet.name,
          race_name: fastest.race.name,
          grade: 'Overall'
        })
      }

      // Boys records by grade
      for (let targetGrade = 9; targetGrade <= 12; targetGrade++) {
        const gradeResults = boysResults.filter(result => {
          const raceDate = new Date(result.race.meet.meet_date)
          const raceYear = raceDate.getFullYear()
          const raceMonth = raceDate.getMonth()
          
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
            time_seconds: fastest.time_seconds,
            xc_time: 0,
            course_id: courseId,
            course_name: '',
            race_date: fastest.race.meet.meet_date,
            meet_name: fastest.race.meet.name,
            race_name: fastest.race.name,
            grade: targetGrade
          })
        }
      }

      // Process girls records
      const girlsResults = processedResults.filter(r => 
        r.race?.gender === 'Girls' || r.athlete?.gender === 'F'
      )
      
      const girlsRecordsMap = new Map<string, CourseRecord>()
      
      // Overall girls record
      if (girlsResults.length > 0) {
        const fastest = girlsResults.reduce((prev, curr) => 
          curr.time_seconds < prev.time_seconds ? curr : prev
        )
        girlsRecordsMap.set('Overall', {
          athlete_id: fastest.athlete.id,
          athlete_name: `${fastest.athlete.first_name} ${fastest.athlete.last_name}`,
          time_seconds: fastest.time_seconds,
          xc_time: 0,
          course_id: courseId,
          course_name: '',
          race_date: fastest.race.meet.meet_date,
          meet_name: fastest.race.meet.name,
          race_name: fastest.race.name,
          grade: 'Overall'
        })
      }

      // Girls records by grade
      for (let targetGrade = 9; targetGrade <= 12; targetGrade++) {
        const gradeResults = girlsResults.filter(result => {
          const raceDate = new Date(result.race.meet.meet_date)
          const raceYear = raceDate.getFullYear()
          const raceMonth = raceDate.getMonth()
          
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
            time_seconds: fastest.time_seconds,
            xc_time: 0,
            course_id: courseId,
            course_name: '',
            race_date: fastest.race.meet.meet_date,
            meet_name: fastest.race.meet.name,
            race_name: fastest.race.name,
            grade: targetGrade
          })
        }
      }

      // Convert to arrays in proper order
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const selectedCourseData = courses.find(c => c.id === selectedCourse)

  const getDifficultyLabel = (rating?: number) => {
    if (!rating) return 'Unknown'
    if (rating < 1.05) return 'Easy'
    if (rating < 1.12) return 'Moderate'
    if (rating < 1.18) return 'Hard'
    return 'Very Hard'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Records...</div>
          <div className="text-gray-600">Getting school records...</div>
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
            <span className="text-black font-medium">Records</span>
          </nav>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h1 className="text-3xl font-bold text-black mb-2">{school.name}</h1>
          <p className="text-lg text-gray-600">Course Records</p>
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
              <div className="px-6 py-4 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                Records
              </div>
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

        {/* Overall School Records - XC Time Based */}
        {(boysXCRecords.length > 0 || girlsXCRecords.length > 0) && (
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h2 className="text-2xl font-bold text-black mb-4">Overall School Records (XC Time)</h2>
            
            {/* Explanation */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <div className="flex items-start space-x-2">
                <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-blue-800">
                  <strong>XC Time Records:</strong> These records use normalized XC Times (equivalent performance on Crystal Springs 2.95-mile course) to fairly compare performances across different courses. The actual time and course are shown for each record.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Boys XC Records */}
              <div>
                <h3 className="text-xl font-bold text-blue-600 mb-4">Boys</h3>
                {boysXCRecords.length === 0 ? (
                  <div className="text-gray-500 text-sm">No XC Time records available</div>
                ) : (
                  <div className="space-y-3">
                    {boysXCRecords.map((record, index) => (
                      <div key={index} className="border-b pb-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-gray-700">
                            {record.grade === 'Overall' ? 'School Record' : `${record.grade}th Grade`}
                          </span>
                          <div className="text-right">
                            <div className="font-bold text-blue-600">
                              {formatTime(record.xc_time)} <span className="text-xs text-gray-500">XC</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {formatTime(record.time_seconds)} <span className="text-xs text-gray-500">actual</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-1">
                          <div className="text-gray-600">
                            <a 
                              href={`/athletes/${record.athlete_id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {record.athlete_name}
                            </a>
                          </div>
                          <div className="text-xs text-gray-500">
                            {record.meet_name}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                          <div>
                            <a 
                              href={`/courses/${record.course_id}`}
                              className="text-green-600 hover:text-green-800"
                            >
                              {record.course_name}
                            </a>
                          </div>
                          <div>{record.race_name}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(record.race_date)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Girls XC Records */}
              <div>
                <h3 className="text-xl font-bold text-pink-600 mb-4">Girls</h3>
                {girlsXCRecords.length === 0 ? (
                  <div className="text-gray-500 text-sm">No XC Time records available</div>
                ) : (
                  <div className="space-y-3">
                    {girlsXCRecords.map((record, index) => (
                      <div key={index} className="border-b pb-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-gray-700">
                            {record.grade === 'Overall' ? 'School Record' : `${record.grade}th Grade`}
                          </span>
                          <div className="text-right">
                            <div className="font-bold text-blue-600">
                              {formatTime(record.xc_time)} <span className="text-xs text-gray-500">XC</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {formatTime(record.time_seconds)} <span className="text-xs text-gray-500">actual</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-1">
                          <div className="text-gray-600">
                            <a 
                              href={`/athletes/${record.athlete_id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {record.athlete_name}
                            </a>
                          </div>
                          <div className="text-xs text-gray-500">
                            {record.meet_name}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                          <div>
                            <a 
                              href={`/courses/${record.course_id}`}
                              className="text-green-600 hover:text-green-800"
                            >
                              {record.course_name}
                            </a>
                          </div>
                          <div>{record.race_name}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(record.race_date)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* NEW: Top 10 Performances */}
        {(boysTop10.length > 0 || girlsTop10.length > 0) && (
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h2 className="text-2xl font-bold text-black mb-4">Top 10 Performances (XC Time)</h2>
            <p className="text-sm text-gray-600 mb-6">
              Best individual performances across all courses, normalized by XC Time Rating for fair comparison
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Boys Top 10 */}
              <div>
                <h3 className="text-lg font-semibold text-blue-600 mb-3">Boys</h3>
                {boysTop10.length > 0 ? (
                  <div className="space-y-2">
                    {boysTop10.map((perf, idx) => (
                      <div key={`${perf.athlete_id}-${idx}`} className="border-b border-gray-100 pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-black">
                              {idx + 1}. {perf.first_name} {perf.last_name} '{perf.graduation_year.toString().slice(-2)}
                            </div>
                            <div className="text-sm text-gray-600">
                              {perf.course_name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-blue-600">
                              {formatTime(perf.xc_time)}
                            </div>
                            <div className="text-sm text-gray-500">
                              ({formatTime(perf.time_seconds)})
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">No performances found</div>
                )}
              </div>

              {/* Girls Top 10 */}
              <div>
                <h3 className="text-lg font-semibold text-pink-600 mb-3">Girls</h3>
                {girlsTop10.length > 0 ? (
                  <div className="space-y-2">
                    {girlsTop10.map((perf, idx) => (
                      <div key={`${perf.athlete_id}-${idx}`} className="border-b border-gray-100 pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-black">
                              {idx + 1}. {perf.first_name} {perf.last_name} '{perf.graduation_year.toString().slice(-2)}
                            </div>
                            <div className="text-sm text-gray-600">
                              {perf.course_name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-pink-600">
                              {formatTime(perf.xc_time)}
                            </div>
                            <div className="text-sm text-gray-500">
                              ({formatTime(perf.time_seconds)})
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">No performances found</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* NEW: Team Records */}
        {(boysTeamRecords.length > 0 || girlsTeamRecords.length > 0) && (
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h2 className="text-2xl font-bold text-black mb-4">Top Team Performances</h2>
            <p className="text-sm text-gray-600 mb-6">
              Best 5-person team times on each course (actual times, not XC Time)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Boys Teams */}
              <div>
                <h3 className="text-lg font-semibold text-blue-600 mb-3">Boys</h3>
                {boysTeamRecords.length > 0 ? (
                  <div className="space-y-4">
                    {boysTeamRecords.map((team, idx) => (
                      <div key={`${team.race_id}-${idx}`} className="border border-gray-200 rounded-lg p-3">
                        <div className="font-semibold text-blue-600 mb-1">
                          {formatTime(team.team_time)} (Avg: {formatTime(team.average_time)})
                        </div>
                        <div className="text-sm text-gray-700 mb-2">
                          <div className="font-medium">{team.course_name}</div>
                          <div>{team.meet_name}</div>
                          <div className="text-gray-500">{formatDate(team.race_date)}</div>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {team.runners.map((runner, runnerIdx) => (
                            <div key={runnerIdx}>
                              {runnerIdx + 1}. {runner.name} - {formatTime(runner.time_seconds)}
                              {runner.place_overall && ` (${runner.place_overall})`}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">No team records found</div>
                )}
              </div>

              {/* Girls Teams */}
              <div>
                <h3 className="text-lg font-semibold text-pink-600 mb-3">Girls</h3>
                {girlsTeamRecords.length > 0 ? (
                  <div className="space-y-4">
                    {girlsTeamRecords.map((team, idx) => (
                      <div key={`${team.race_id}-${idx}`} className="border border-gray-200 rounded-lg p-3">
                        <div className="font-semibold text-pink-600 mb-1">
                          {formatTime(team.team_time)} (Avg: {formatTime(team.average_time)})
                        </div>
                        <div className="text-sm text-gray-700 mb-2">
                          <div className="font-medium">{team.course_name}</div>
                          <div>{team.meet_name}</div>
                          <div className="text-gray-500">{formatDate(team.race_date)}</div>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {team.runners.map((runner, runnerIdx) => (
                            <div key={runnerIdx}>
                              {runnerIdx + 1}. {runner.name} - {formatTime(runner.time_seconds)}
                              {runner.place_overall && ` (${runner.place_overall})`}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">No team records found</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Course Selector */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Course
          </label>
          {courses.length === 0 ? (
            <div className="text-gray-500">No courses found. This school hasn't competed yet.</div>
          ) : (
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
            >
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.distance_miles.toFixed(2)} miles)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Course Details Section */}
        {selectedCourseData && (
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-2xl font-bold text-black mb-2">
                {selectedCourseData.name}
              </h2>
              <div className="text-sm text-gray-600">
                {Math.round(selectedCourseData.distance_miles * 1609.34)}m ({selectedCourseData.distance_miles.toFixed(2)} mi)
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              {/* Distance */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Distance</div>
                <div className="text-lg font-semibold text-black">
                  {selectedCourseData.distance_miles.toFixed(2)} miles
                </div>
                <div className="text-sm text-gray-600">
                  {Math.round(selectedCourseData.distance_miles * 1609.34)}m
                </div>
              </div>

              {/* Difficulty Rating */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">
                  Difficulty vs Track Mile
                </div>
                {selectedCourseData.mile_difficulty ? (
                  <>
                    <div className="text-lg font-semibold text-black">
                      {getDifficultyLabel(selectedCourseData.mile_difficulty)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedCourseData.mile_difficulty.toFixed(3)} multiplier
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">Not rated</div>
                )}
              </div>

              {/* XC Time Rating */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">
                  XC Time Rating
                </div>
                {selectedCourseData.xc_time_rating ? (
                  <>
                    <div className="text-lg font-semibold text-black">
                      {selectedCourseData.xc_time_rating.toFixed(3)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Crystal Springs conversion
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">Not rated</div>
                )}
              </div>
            </div>

            {/* Statistics */}
            {courseStats && (
              <div className="border-t border-gray-200 pt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Statistics</div>
                <div className="text-sm text-gray-600">
                  {courseStats.race_count} {courseStats.race_count === 1 ? 'race' : 'races'} held • {' '}
                  {courseStats.result_count} total {courseStats.result_count === 1 ? 'result' : 'results'}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <svg className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-xs text-gray-600">
                  <p className="mb-2">
                    <strong>Note:</strong> Not all races are included in our database. Statistics represent only the races we have data for.
                  </p>
                  {selectedCourseData.xc_time_rating && (
                    <p>
                      <strong>XC Time Rating:</strong> This rating normalizes performances to Crystal Springs (2.95 miles) to allow fair comparisons across different courses. A rating of {selectedCourseData.xc_time_rating.toFixed(3)} means a time on this course is multiplied by this factor to get the equivalent Crystal Springs time.
                    </p>
                  )}
                  {selectedCourseData.mile_difficulty && (
                    <p className="mt-2">
                      <strong>Difficulty Rating:</strong> Compares this course's difficulty to a flat track mile. A {selectedCourseData.mile_difficulty.toFixed(3)} multiplier means running this course is approximately {selectedCourseData.mile_difficulty.toFixed(3)}x harder than a flat track mile per unit distance.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Records Display */}
        {selectedCourse && (boysRecords.length > 0 || girlsRecords.length > 0) ? (
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h2 className="text-2xl font-bold text-black mb-4">School Course Records</h2>
            
            {/* Disclaimer */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
              <div className="flex items-start space-x-2">
                <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> These are the fastest times by {school.name} athletes on this specific course.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Boys Records */}
              <div>
                <h3 className="text-xl font-bold text-blue-600 mb-4">Boys</h3>
                {boysRecords.length === 0 ? (
                  <div className="text-gray-500 text-sm">No boys records on this course</div>
                ) : (
                  <div className="space-y-3">
                    {boysRecords.map((record, index) => (
                      <div key={index} className="border-b pb-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-gray-700">
                            {record.grade === 'Overall' ? 'School Record' : `${record.grade}th Grade`}
                          </span>
                          <div className="font-bold text-black">
                            {formatTime(record.time_seconds)}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-1">
                          <div className="text-gray-600">
                            <a 
                              href={`/athletes/${record.athlete_id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {record.athlete_name}
                            </a>
                          </div>
                          <div className="text-xs text-gray-500">
                            {record.meet_name}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                          <div>{formatDate(record.race_date)}</div>
                          <div>{record.race_name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Girls Records */}
              <div>
                <h3 className="text-xl font-bold text-pink-600 mb-4">Girls</h3>
                {girlsRecords.length === 0 ? (
                  <div className="text-gray-500 text-sm">No girls records on this course</div>
                ) : (
                  <div className="space-y-3">
                    {girlsRecords.map((record, index) => (
                      <div key={index} className="border-b pb-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-gray-700">
                            {record.grade === 'Overall' ? 'School Record' : `${record.grade}th Grade`}
                          </span>
                          <div className="font-bold text-black">
                            {formatTime(record.time_seconds)}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-1">
                          <div className="text-gray-600">
                            <a 
                              href={`/athletes/${record.athlete_id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {record.athlete_name}
                            </a>
                          </div>
                          <div className="text-xs text-gray-500">
                            {record.meet_name}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                          <div>{formatDate(record.race_date)}</div>
                          <div>{record.race_name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : selectedCourse ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-500 mb-4">No records found on this course.</div>
            <div className="text-sm text-gray-400">
              {school.name} athletes haven't competed on this course yet.
            </div>
          </div>
        ) : null}

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
