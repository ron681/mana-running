'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Filter, ChevronLeft, ChevronRight, Trophy, MapPin, Calendar } from 'lucide-react'

interface SearchResult {
  id: string
  athlete_id: string
  meet_id: string
  time_seconds: number
  place_overall: number
  place_team: number | null
  season_year: number
  created_at: string
  athletes: {
    first_name: string
    last_name: string
    graduation_year: number
    schools: {
      name: string
    }
  }
  meets: {
    name: string
    meet_date: string
    courses: {
      name: string
      distance_meters: number
    }
  }
}

interface SearchFilters {
  searchTerm: string
  season: string
  meet: string
  course: string
  performanceLevel: string
  minTimeSeconds: number | null
  maxTimeSeconds: number | null
}

const RESULTS_PER_PAGE = 25

export default function SearchFilters() {
  const [viewMode, setViewMode] = useState('results')
  const [results, setResults] = useState<SearchResult[]>([])
  const [totalResults, setTotalResults] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [seasons, setSeasons] = useState<string[]>([])
  const [meets, setMeets] = useState<{name: string, id: string}[]>([])
  const [courses, setCourses] = useState<{name: string, id: string}[]>([])
  
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    season: '',
    meet: '',
    course: '',
    performanceLevel: '',
    minTimeSeconds: null,
    maxTimeSeconds: null
  })

  // Load filter options on component mount
  useEffect(() => {
    loadFilterOptions()
    performSearch(1)
  }, [])

  // Perform search when filters change
  useEffect(() => {
    setCurrentPage(1)
    performSearch(1)
  }, [filters])

  const loadFilterOptions = async () => {
    try {
      // Get unique seasons
      const { data: seasonData } = await supabase
        .from('results')
        .select('season_year')
        .order('season_year', { ascending: false })
      const uniqueSeasons = [...new Set(seasonData?.map(r => r.season_year.toString()) || [])]
      setSeasons(uniqueSeasons)

      // Get unique meets
      const { data: meetData } = await supabase
        .from('meets')
        .select('id, name')
        .order('name')
      setMeets(meetData || [])

      // Get unique courses
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, name')
        .order('name')
      setCourses(courseData || [])
    } catch (error) {
      console.error('Error loading filter options:', error)
    }
  }

  const performSearch = async (page: number) => {
    setLoading(true)
    
    try {
   
let query = supabase
  .from('results_with_details')
  .select('*', { count: 'exact' })

// Add search at database level if there's a search term
if (filters.searchTerm) {
  const searchTerm = filters.searchTerm.toLowerCase()
  query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,athlete_name.ilike.%${searchTerm}%,school_name.ilike.%${searchTerm}%,meet_name.ilike.%${searchTerm}%,course_name.ilike.%${searchTerm}%`)
}


      // Apply filters
      if (filters.season) {
        query = query.eq('season_year', parseInt(filters.season))
      }

      if (filters.meet) {
        query = query.eq('meet_id', filters.meet)
      }

      if (filters.minTimeSeconds !== null) {
        query = query.gte('time_seconds', filters.minTimeSeconds)
      }

      if (filters.maxTimeSeconds !== null) {
        query = query.lte('time_seconds', filters.maxTimeSeconds)
      }

     // IMPORTANT: Increase the limit to search more records
const SEARCH_LIMIT = 50000;
console.log('Current filters.searchTerm:', filters.searchTerm, 'Length:', filters.searchTerm?.length)

if (filters.searchTerm) {
  console.log('Applying search with range for larger dataset')
  // Use range instead of limit to get more records
  query = query
    .range(0, 9999)  // Get first 10,000 records (0-based indexing)
    .order('time_seconds', { ascending: true });
} else {
  console.log('No search term, using pagination')
  const offset = (page - 1) * RESULTS_PER_PAGE
  query = query
    .range(offset, offset + RESULTS_PER_PAGE - 1)
    .order('time_seconds', { ascending: true })
}

const { data, count, error } = await query

if (error) throw error

// Debug the database results
if (filters.searchTerm) {
  console.log('Database search results for "' + filters.searchTerm + '":', data?.length)
  console.log('Sample results:', data?.slice(0, 3).map(r => r.athlete_name || r.first_name + ' ' + r.last_name))
}



// Filter by search term on the client side for related data
// Results are now filtered at database level, so just use the data directly
let filteredData = data || []

// Apply any remaining client-side filters (course filter)
if (filters.course) {
  filteredData = filteredData.filter(result => 
    result.course_name === filters.course
  )
}

console.log('Final filtered results for display:', filteredData.length)
if (filters.searchTerm) {
  console.log('Ernst results ready for display:', filteredData.filter(r => r.athlete_name?.includes('Ernst')).length)
}
      if (filters.course) {
        filteredData = filteredData.filter(result => 
          result.meets?.courses?.name === filters.course
        )
      }

      setResults(filteredData)
      setTotalResults(count || 0)
      setCurrentPage(page)
      
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
      setTotalResults(0)
    } finally {
      setLoading(false)
    }
  }

  const timeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':')
    if (parts.length === 2) {
      const minutes = parseInt(parts[0])
      const secondsPart = parseFloat(parts[1])
      return Math.round((minutes * 60 + secondsPart) * 100)
    }
    return 0
  }

  const secondsToTime = (hundredths: number): string => {
    if (!hundredths) return ''
    
    const totalSeconds = hundredths / 100
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    
    const isHistoricalPrecision = (hundredths % 10) === 0
    
    if (isHistoricalPrecision) {
      return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
    } else {
      return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`
    }
  }

  const getPerformanceLevel = (timeHundredths: number): string => {
    const timeSeconds = timeHundredths / 100
    if (timeSeconds < 900) return 'Elite'
    if (timeSeconds < 1020) return 'Excellent'
    if (timeSeconds < 1140) return 'Good'
    if (timeSeconds < 1260) return 'Average'
    return 'Developing'
  }

  const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE)
  const startResult = (currentPage - 1) * RESULTS_PER_PAGE + 1
  const endResult = Math.min(currentPage * RESULTS_PER_PAGE, totalResults)

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    if (key === 'minTimeSeconds' || key === 'maxTimeSeconds') {
      const timeValue = value ? timeToSeconds(value) : null
      setFilters(prev => ({ ...prev, [key]: timeValue }))
    } else {
      setFilters(prev => ({ ...prev, [key]: value }))
    }
  }

  const clearAllFilters = () => {
    setFilters({
      searchTerm: '',
      season: '',
      meet: '',
      course: '',
      performanceLevel: '',
      minTimeSeconds: null,
      maxTimeSeconds: null
    })
  }

  const applyQuickFilter = (filterType: string) => {
    switch (filterType) {
      case 'elite':
        setFilters(prev => ({ ...prev, maxTimeSeconds: 90000 }))
        break
      case '2024':
        setFilters(prev => ({ ...prev, season: '2024' }))
        break
      case 'crystal':
        const crystalCourse = courses.find(c => c.name.toLowerCase().includes('crystal'))
        if (crystalCourse) {
          setFilters(prev => ({ ...prev, course: crystalCourse.name }))
        }
        break
      case 'sub17':
        setFilters(prev => ({ ...prev, maxTimeSeconds: 102000 }))
        break
    }
  }

  // Group athletes for athletes view
  const groupedAthletes = results.reduce((acc, result) => {
    const athleteKey = result.athlete_id
    if (!acc[athleteKey]) {
      acc[athleteKey] = {
        athlete: result.athletes,
        athleteId: result.athlete_id,
        bestTime: result.time_seconds,
        raceCount: 1,
        seasons: [result.season_year],
        totalRaces: 1
      }
    } else {
      if (result.time_seconds < acc[athleteKey].bestTime) {
        acc[athleteKey].bestTime = result.time_seconds
      }
      acc[athleteKey].raceCount++
      acc[athleteKey].totalRaces++
      if (!acc[athleteKey].seasons.includes(result.season_year)) {
        acc[athleteKey].seasons.push(result.season_year)
      }
    }
    return acc
  }, {} as any)

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-2xl font-bold mb-4">Mana Running Analytics</h2>
        
        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-6">
          {[
            { key: 'results', label: 'All Results', icon: '📊' },
            { key: 'athletes', label: 'Athletes', icon: '🏃' },
            { key: 'meets', label: 'Meets', icon: '🏆' },
            { key: 'courses', label: 'Courses', icon: '🗺️' },
            { key: 'records', label: 'Records', icon: '⭐' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === tab.key 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Main Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search athletes, schools, meets, courses..."
            value={filters.searchTerm}
            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Results Count */}
        <p className="text-gray-600 mb-4">
          {loading ? 'Searching...' : `Showing ${startResult}-${endResult} of ${totalResults.toLocaleString()} results`}
        </p>

        {/* Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
          <select
            value={filters.season}
            onChange={(e) => handleFilterChange('season', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Seasons</option>
            {seasons.map(season => (
              <option key={season} value={season}>{season}</option>
            ))}
          </select>

          <select
            value={filters.meet}
            onChange={(e) => handleFilterChange('meet', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Meets</option>
            {meets.map(meet => (
              <option key={meet.id} value={meet.id}>{meet.name}</option>
            ))}
          </select>

          <select
            value={filters.course}
            onChange={(e) => handleFilterChange('course', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Courses</option>
            {courses.map(course => (
              <option key={course.id} value={course.name}>
                {course.name.length > 30 ? course.name.substring(0, 30) + '...' : course.name}
              </option>
            ))}
          </select>

          <select
            value={filters.performanceLevel}
            onChange={(e) => handleFilterChange('performanceLevel', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Levels</option>
            <option value="Elite">Elite</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Average">Average</option>
            <option value="Developing">Developing</option>
          </select>

          <input
            type="text"
            placeholder="Min Time (16:30.50)"
            value={filters.minTimeSeconds ? secondsToTime(filters.minTimeSeconds) : ''}
            onChange={(e) => handleFilterChange('minTimeSeconds', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="text"
            placeholder="Max Time (18:00.75)"
            value={filters.maxTimeSeconds ? secondsToTime(filters.maxTimeSeconds) : ''}
            onChange={(e) => handleFilterChange('maxTimeSeconds', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Clear and Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={clearAllFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear All
          </button>
          
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-600 py-2">Quick Filters:</span>
            <button
              onClick={() => applyQuickFilter('elite')}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
            >
              Elite Only
            </button>
            <button
              onClick={() => applyQuickFilter('2024')}
              className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 transition-colors"
            >
              2024 Season
            </button>
            <button
              onClick={() => applyQuickFilter('crystal')}
              className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition-colors"
            >
              Crystal Springs
            </button>
            <button
              onClick={() => applyQuickFilter('sub17')}
              className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm hover:bg-red-200 transition-colors"
            >
              Sub-17 Times
            </button>

<button
  onClick={async () => {
    const { data, error } = await supabase
      .from('athletes')
      .select('first_name, last_name')
      .or('first_name.ilike.%Ernst%,last_name.ilike.%Ernst%')
    
    console.log('Ernst search results:', data)
    if (error) console.error('Error:', error)
  }}
  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
>
  Test: Find Ernst in Athletes
</button>

<button
  onClick={async () => {
    // First find Tyler Ernst's ID
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, first_name, last_name')
      .or('first_name.ilike.%Ernst%,last_name.ilike.%Ernst%')
    
    console.log('Ernst athletes:', athletes)
    
    if (athletes && athletes.length > 0) {
      // Now check if he has any results
      const { data: results } = await supabase
        .from('results')
        .select('*')
        .eq('athlete_id', athletes[0].id)
      
      console.log('Ernst results:', results)
    }
  }}
  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 ml-2"
>
  Test: Find Ernst's Results
</button>


<button
  onClick={async () => {
    const { data, error } = await supabase
      .from('results_with_details')
      .select('*')
      .or('first_name.ilike.%Ernst%,last_name.ilike.%Ernst%')
      .limit(5)
    
    console.log('Ernst in results_with_details:', data)
    if (error) console.error('Error:', error)
  }}
  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 ml-2"
>
  Test: Ernst in results_with_details
</button>





          </div>
        </div>
      </div>

      {/* Athletes View */}
      {viewMode === 'athletes' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Top Athletes</h3>
          </div>
          <div className="space-y-4 p-6">
            {Object.entries(groupedAthletes).slice(0, 20).map(([athleteId, data]: [string, any]) => (
              <div key={athleteId} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">
                      {data.athlete?.first_name?.[0]}{data.athlete?.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={() => window.location.href = `/athlete/${data.athleteId}`}
                      className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {data.athlete?.first_name} {data.athlete?.last_name}
                    </button>
                    <div className="text-sm text-gray-600">
                      {data.totalRaces} races • {data.seasons.length} seasons
                      {data.athlete?.graduation_year && ` • Class of ${data.athlete.graduation_year}`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-blue-600">
                    {secondsToTime(data.bestTime)}
                  </div>
                  <div className="text-sm text-gray-500">Personal Best</div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    getPerformanceLevel(data.bestTime) === 'Elite' ? 'bg-purple-100 text-purple-800' :
                    getPerformanceLevel(data.bestTime) === 'Excellent' ? 'bg-blue-100 text-blue-800' :
                    getPerformanceLevel(data.bestTime) === 'Good' ? 'bg-green-100 text-green-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {getPerformanceLevel(data.bestTime)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Records View */}
      {viewMode === 'records' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">School Records</h3>
          </div>
          <div className="space-y-4 p-6">
            {results.slice(0, 20).map((result, index) => (
              <div key={result.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 font-bold">#{index + 1}</span>
                  </div>
                  <div>
                    <button
                      onClick={() => window.location.href = `/athlete/${result.athlete_id}`}
                      className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {result.athletes?.first_name} {result.athletes?.last_name}
                    </button>
                    <div className="text-sm text-gray-600">
                      {result.meets?.name} • {result.season_year}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-yellow-600">
                    {secondsToTime(result.time_seconds)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {result.meets?.courses?.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Results View */}
      {viewMode === 'results' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Athlete
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    School
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Meet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Place
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      Loading results...
                    </td>
                  </tr>
                ) : results.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No results found. Try adjusting your filters.
                    </td>
                  </tr>
                ) : (
                  results.map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <button
                            onClick={() => window.location.href = `/athlete/${result.athlete_id}`}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                           
{(result as any).first_name && (result as any).last_name 
  ? `${(result as any).first_name} ${(result as any).last_name}`
  : (result as any).athlete_name || 'Unknown Athlete'
}


                          </button>
                          <div className="text-sm text-gray-500">
                            Season: {result.season_year}
                            {result.athletes?.graduation_year && (
                              <span className="ml-2">Class of {result.athletes.graduation_year}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.athletes?.schools?.name || 'Unknown School'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{result.meets?.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{result.meets?.meet_date || ''}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="truncate">{result.meets?.courses?.name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">
                          {result.meets?.courses?.distance_meters ? 
                            `${(result.meets.courses.distance_meters / 1609.34).toFixed(2)} miles` : 
                            'Unknown distance'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">
                        {secondsToTime(result.time_seconds)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          getPerformanceLevel(result.time_seconds) === 'Elite' ? 'bg-purple-100 text-purple-800' :
                          getPerformanceLevel(result.time_seconds) === 'Excellent' ? 'bg-blue-100 text-blue-800' :
                          getPerformanceLevel(result.time_seconds) === 'Good' ? 'bg-green-100 text-green-800' :
                          getPerformanceLevel(result.time_seconds) === 'Average' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {getPerformanceLevel(result.time_seconds)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.place_overall}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 rounded-lg shadow-sm">
          <div className="flex-1 flex justify-between items-center">
            <p className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => performSearch(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </button>
              <button
                onClick={() => performSearch(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}