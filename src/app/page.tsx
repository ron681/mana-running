'use client'

import { useEffect, useState } from 'react'
import { 
  athleteCRUD, 
  schoolCRUD, 
  meetCRUD, 
  courseCRUD, 
  resultCRUD 
} from '@/lib/crud-operations'

import { 
  formatTime 
} from '@/lib/timeConverter'





interface Stats {
  schools: number
  athletes: number
  courses: number
  results: number
}





interface RecentMeet {
  id: string
  name: string
  meet_date: string
  gender: string
  meet_type: string
  course?: {
    name: string
  }
}

interface TopPerformance {
  athlete: {
    first_name: string
    last_name: string
  }
  course_name: string
  time_seconds: number
  meet_name: string
  meet_date: string
  gender: string
}

interface BigMover {
  athlete: {
    first_name: string
    last_name: string
  }
  improvement_percentage: number
  gender: string
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({
    schools: 0,
    athletes: 0,
    courses: 0,
    results: 0
  })
  const [recentMeets, setRecentMeets] = useState<RecentMeet[]>([])
  const [topPerformances, setTopPerformances] = useState<{
    boys: TopPerformance[]
    girls: TopPerformance[]
  }>({ boys: [], girls: [] })
  const [bigMovers, setBigMovers] = useState<{
    boys: BigMover[]
    girls: BigMover[]
  }>({ boys: [], girls: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setError(null)
      
      // Load stats
      const [schools, athletes, courses, totalResultsCount] = await Promise.all([
        schoolCRUD.getAll(),
        athleteCRUD.getAll(),
        courseCRUD.getAll(),
        resultCRUD.getTotalCount()
      ])
      
      setStats({
        schools: schools?.length || 0,
        athletes: athletes?.length || 0,
        courses: courses?.length || 0,
        results: totalResultsCount || 0
      })

      // Load recent meets (last 10 days)
      const allMeets = await meetCRUD.getAll()
      if (allMeets) {
        const now = new Date()
        const tenDaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000))
        
        const recentMeetsFiltered = allMeets
          .filter(meet => {
            const meetDate = new Date(meet.meet_date)
            return !isNaN(meetDate.getTime()) && meetDate >= tenDaysAgo
          })
          .sort((a, b) => new Date(b.meet_date).getTime() - new Date(a.meet_date).getTime())
          .slice(0, 10)
        
        if (recentMeetsFiltered.length < 5) {
          const allMeetsSorted = allMeets
            .filter(meet => !isNaN(new Date(meet.meet_date).getTime()))
            .sort((a, b) => new Date(b.meet_date).getTime() - new Date(a.meet_date).getTime())
            .slice(0, 5)
          setRecentMeets(allMeetsSorted)
        } else {
          setRecentMeets(recentMeetsFiltered)
        }
      }

      // Load big movers and top performances from recent meets
      const allResults = await resultCRUD.getAllWithDetails()
      if (allResults && recentMeets.length > 0) {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
        
        // Calculate big movers (XC time improvements)
        const bigMoverResults = calculateBigMovers(allResults, thirtyDaysAgo)
        setBigMovers(bigMoverResults)

        // Filter results from the last 10 days and valid times for top performances
        const tenDaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000))
        const recentResults = allResults.filter(result => {
          const meetDate = new Date(result.meet_date)
          return !isNaN(meetDate.getTime()) && 
                 meetDate >= tenDaysAgo && 
                 result.time_seconds > 0 &&
                 result.time_seconds < 3600
        })

        const boysResults = recentResults
          .filter(result => 
            result.gender === 'M' 
          )
          .sort((a, b) => a.time_seconds - b.time_seconds)
          .slice(0, 5)

        const girlsResults = recentResults
          .filter(result => 
            result.gender === 'F' 
          )
          .sort((a, b) => a.time_seconds - b.time_seconds)
          .slice(0, 5)

        setTopPerformances({
          boys: boysResults.map(result => ({
            athlete: {
              first_name: result.first_name,
              last_name: result.last_name
            },
            course_name: result.course_name,
            time_seconds: result.time_seconds,
            meet_name: result.meet_name,
            meet_date: result.meet_date,
            gender: result.gender
          })),
          girls: girlsResults.map(result => ({
            athlete: {
              first_name: result.first_name,
              last_name: result.last_name
            },
            course_name: result.course_name,
            time_seconds: result.time_seconds,
            meet_name: result.meet_name,
            meet_date: result.meet_date,
            gender: result.gender
          }))
        })
      }
      
    } catch (err) {
      console.error('Error loading data:', err)
      setError(`Failed to load data: ${(err instanceof Error ? err.message : String(err)) || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const calculateBigMovers = (allResults: any[], cutoffDate: Date): { boys: BigMover[], girls: BigMover[] } => {
    const athleteResults = new Map<string, any[]>()
    
    allResults.forEach(result => {
      if (result.athlete_id && result.normalized_time_seconds > 0) {
        if (!athleteResults.has(result.athlete_id)) {
          athleteResults.set(result.athlete_id, [])
        }
        athleteResults.get(result.athlete_id)!.push(result)
      }
    })

    const improvements: BigMover[] = []

    athleteResults.forEach((results, athleteId) => {
      const sortedResults = results.sort((a, b) => 
        new Date(a.meet_date).getTime() - new Date(b.meet_date).getTime()
      )

      const recentResults = sortedResults.filter(result => 
        new Date(result.meet_date) >= cutoffDate
      )

      if (recentResults.length === 0) return

      const historicalResults = sortedResults.filter(result => 
        new Date(result.meet_date) < cutoffDate
      )

      if (historicalResults.length === 0) return

      const oldPR = Math.min(...historicalResults.map(r => r.normalized_time_seconds))

      const bestRecentResult = recentResults.reduce((best, current) => 
        current.normalized_time_seconds < best.normalized_time_seconds ? current : best
      )

      const newPR = bestRecentResult.normalized_time_seconds

      if (newPR < oldPR) {
        const improvementPercentage = ((oldPR - newPR) / oldPR) * 100

        improvements.push({
          athlete: {
            first_name: bestRecentResult.first_name,
            last_name: bestRecentResult.last_name
          },
          improvement_percentage: improvementPercentage,
          gender: bestRecentResult.gender
        })
      }
    })

    const boys = improvements
      .filter(mover => 
        mover.gender === 'M' 
      )
      .sort((a, b) => b.improvement_percentage - a.improvement_percentage)
      .slice(0, 5)

    const girls = improvements
      .filter(mover => 
        mover.gender === 'M' 
      )
      .sort((a, b) => b.improvement_percentage - a.improvement_percentage)
      .slice(0, 5)

    return { boys, girls }
  }


  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-slate-700 mb-2">Loading Mana Running...</div>
          <div className="text-slate-500">Connecting to database...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="text-xl font-semibold mb-2 text-red-600">Connection Error</div>
          <div className="text-slate-600 mb-6">{error}</div>
          <button 
            onClick={loadData}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M30 30c0-11.046-8.954-20-20-20s-20 8.954-20 20 8.954 20 20 20 20-8.954 20-20z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
        
        <div className="relative container mx-auto px-6 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center bg-blue-600/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-blue-400/30">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
              <span className="text-blue-200 text-sm font-medium">Celebrating the Spirit of Cross Country</span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              Welcome to Mana Running
            </h1>
            
            <p className="text-xl lg:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
              Where passion meets performance. Track every stride, celebrate every breakthrough, 
              and discover the stories that make high school cross country extraordinary.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <a href="/meets" className="group bg-white text-slate-900 px-8 py-4 rounded-xl hover:bg-blue-50 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                <span className="flex items-center justify-center">
                  Explore Meets
                  <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </a>
              <a href="/search" className="group bg-blue-600/20 backdrop-blur-sm text-white px-8 py-4 rounded-xl hover:bg-blue-600/30 transition-all duration-300 font-semibold text-lg border border-blue-400/30">
                <span className="flex items-center justify-center">
                  Advanced Search
                  <svg className="w-5 h-5 ml-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
              </a>
            </div>

            {/* Mission Statement */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <p className="text-blue-100 leading-relaxed italic">
                "Mana Running embodies the spirit of cross country - the relentless pursuit of personal bests, 
                the bonds forged through shared struggle, and the pure joy of running fast on beautiful courses. 
                Here, every athlete's journey matters, from the front runner chasing records to the determined 
                competitor seeking their breakthrough moment."
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">Performance Hub</h2>
          <p className="text-slate-600 text-lg">Real-time insights into the high school distance running community</p>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-blue-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-100 transition-colors">
                <svg className="w-6 h-6 text-slate-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-slate-800 mb-1">{stats.schools.toLocaleString()}</div>
              <div className="text-slate-600 font-medium">Schools</div>
            </div>
          </div>
          
          <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-red-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-red-100 transition-colors">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-red-600 mb-1">{stats.athletes.toLocaleString()}</div>
              <div className="text-slate-600 font-medium">Athletes</div>
            </div>
          </div>
          
          <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-green-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-green-100 transition-colors">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-1">{stats.courses.toLocaleString()}</div>
              <div className="text-slate-600 font-medium">Courses</div>
            </div>
          </div>
          
          <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-blue-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-100 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-1">{stats.results.toLocaleString()}</div>
              <div className="text-slate-600 font-medium">Results</div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Recent Meets */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Recent Meets</h2>
                  <p className="text-blue-100 text-sm">Latest competitions and results</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {recentMeets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-slate-500 font-medium mb-2">No recent meets</div>
                  <div className="text-slate-400 text-sm">Check back for new race results</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentMeets.map((meet) => (
                    <div key={meet.id} className="group border border-slate-100 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50/50 transition-all duration-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <a 
                            href={`/meets/${meet.id}`}
                            className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors line-clamp-2"
                          >
                            {meet.name}
                          </a>
                          {meet.course?.name && (
                            <div className="text-slate-500 text-sm mt-1">{meet.course.name}</div>
                          )}
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <div className="text-sm font-medium text-slate-700 mb-1">
                            {formatDate(meet.meet_date)}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            meet.gender === 'Boys' ? 'bg-blue-100 text-blue-800' :
                            meet.gender === 'Girls' ? 'bg-pink-100 text-pink-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {meet.gender}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Big Movers */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Big Movers</h2>
                  <p className="text-green-100 text-sm">Top improvements in the last 30 days</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Boys Big Movers */}
                <div>
                  <h3 className="text-lg font-bold text-blue-700 mb-4 flex items-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
                    Boys
                  </h3>
                  {bigMovers.boys.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-slate-400 text-sm">No recent improvements</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bigMovers.boys.map((mover, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-l-4 border-green-500">
                          <div className="font-semibold text-slate-800 text-sm">
                            {mover.athlete.first_name} {mover.athlete.last_name}
                          </div>
                          <div className="font-bold text-green-600">
                            -{mover.improvement_percentage.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>


{/* Girls Big Movers */}
<div>
  <h3 className="text-lg font-bold text-pink-700 mb-4 flex items-center">
    <div className="w-2 h-2 bg-pink-600 rounded-full mr-2"></div>
    Girls
  </h3>
  {bigMovers.girls.length === 0 ? (
    <div className="text-center py-8">
      <div className="text-slate-400 text-sm">No recent improvements</div>
    </div>
  ) : (
    <div className="space-y-3">
      {bigMovers.girls.map((mover, index) => (
        <div key={index} className="flex justify-between items-center p-3 bg-gradient-to-r from-pink-50 to-green-50 rounded-lg border-l-4 border-green-500">
          <div className="font-semibold text-slate-800 text-sm">
            {mover.athlete.first_name} {mover.athlete.last_name}
          </div>
          <div className="font-bold text-green-600">
            -{mover.improvement_percentage.toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  )}
</div>
  




              </div>
            </div>
          </div>
        </div>

        {/* Top Performances */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-12">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Elite Performances</h2>
                <p className="text-purple-100 text-sm">Fastest times from the past 10 days</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Boys Performances */}
              <div>
                <h3 className="text-lg font-bold text-blue-700 mb-4 flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  Boys
                </h3>
                {topPerformances.boys.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="text-slate-400 text-sm">No recent performances</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topPerformances.boys.map((performance, index) => (
                      <div key={index} className="group bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 hover:border-blue-200 transition-all duration-200">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                              {performance.athlete.first_name} {performance.athlete.last_name}
                            </div>
                            <div className="text-slate-500 text-sm truncate">
                              {performance.course_name}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-mono text-lg font-bold text-blue-600">
                              {formatTime(performance.time_seconds)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDate(performance.meet_date)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Girls Performances */}
              <div>
                <h3 className="text-lg font-bold text-pink-700 mb-4 flex items-center">
                  <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-pink-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  Girls
                </h3>
                {topPerformances.girls.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="text-slate-400 text-sm">No recent performances</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topPerformances.girls.map((performance, index) => (
                      <div key={index} className="group bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4 border border-pink-100 hover:border-pink-200 transition-all duration-200">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="font-bold text-slate-800 group-hover:text-pink-700 transition-colors">
                              {performance.athlete.first_name} {performance.athlete.last_name}
                            </div>
                            <div className="text-slate-500 text-sm truncate">
                              {performance.course_name}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-mono text-lg font-bold text-pink-600">
                              {formatTime(performance.time_seconds)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDate(performance.meet_date)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">Explore Mana Running</h2>
          <p className="text-slate-600 text-lg">Dive deeper into the world of high school cross country</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <a href="/schools" className="group bg-gradient-to-br from-red-500 to-red-600 text-white p-8 rounded-2xl hover:from-red-600 hover:to-red-700 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">Schools & Teams</h3>
              <p className="text-red-100 leading-relaxed">Discover team rosters, coaching philosophies, and the competitive spirit that drives each program forward.</p>
            </div>
          </a>
          
          <a href="/courses" className="group bg-gradient-to-br from-green-500 to-green-600 text-white p-8 rounded-2xl hover:from-green-600 hover:to-green-700 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">Courses & Venues</h3>
              <p className="text-green-100 leading-relaxed">Explore the legendary courses where champions are made and records are shattered across beautiful landscapes.</p>
            </div>
          </a>
          
          <a href="/admin" className="group bg-gradient-to-br from-yellow-500 to-orange-500 text-white p-8 rounded-2xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">Coach's Corner</h3>
              <p className="text-yellow-100 leading-relaxed">Access comprehensive tools for data management, team analysis, and performance tracking insights.</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
