// src/app/schools/[id]/results/page.tsx
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

interface Result {
  id: string
  athlete_id: string
  athlete_name: string
  gender: string
  time_seconds: number
  xc_time: number
  place: number | null
  meet_name: string
  meet_date: string
  course_name: string
  season_year: number
  grade: number | null
}

interface Props {
  params: {
    id: string
  }
}

export default function ResultsPage({ params }: Props) {
  const [school, setSchool] = useState<School | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [selectedGender, setSelectedGender] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const resultsPerPage = 50

  const supabase = createClientComponentClient()

  useEffect(() => {
    loadData()
  }, [params.id])

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

      // Load all results for the school
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select(`
          id,
          athlete_id,
          time_seconds,
          place,
          season_year,
          grade,
          athletes!inner (
            id,
            first_name,
            last_name,
            gender,
            current_school_id
          ),
          races!inner (
            meet_id,
            course_id,
            meets (
              name,
              meet_date
            ),
            courses (
              name,
              xc_time_rating
            )
          )
        `)
        .eq('athletes.current_school_id', params.id)
        .order('meet_date', { ascending: false, nullsFirst: false })
        .order('time_seconds', { ascending: true })

      if (resultsError) throw resultsError

      // Process results
      const processedResults: Result[] = []

      resultsData?.forEach(result => {
        const athlete = Array.isArray(result.athletes) ? result.athletes[0] : result.athletes
        const race = Array.isArray(result.races) ? result.races[0] : result.races
        
        if (!athlete || !race) return

        const meet = race.meets ? (Array.isArray(race.meets) ? race.meets[0] : race.meets) : null
        const course = race.courses ? (Array.isArray(race.courses) ? race.courses[0] : race.courses) : null
        
        if (!meet || !course) return

        const xcTime = result.time_seconds * course.xc_time_rating

        processedResults.push({
          id: result.id,
          athlete_id: athlete.id,
          athlete_name: `${athlete.last_name}, ${athlete.first_name}`,
          gender: athlete.gender,
          time_seconds: result.time_seconds,
          xc_time: Math.round(xcTime),
          place: result.place,
          meet_name: meet.name,
          meet_date: meet.meet_date,
          course_name: course.name || 'Unknown Course',
          season_year: result.season_year,
          grade: result.grade
        })
      })

      setResults(processedResults)
    } catch (err) {
      console.error('Error loading results:', err)
      setError('Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  // Get unique seasons for filter
  const availableSeasons = Array.from(new Set(results.map(r => r.season_year)))
    .filter(Boolean)
    .sort((a, b) => b - a)

  // Filter results
  const filteredResults = results.filter(result => {
    const matchesSeason = selectedSeason === 'all' || result.season_year?.toString() === selectedSeason
    const matchesGender = !selectedGender || result.gender === selectedGender
    const matchesSearch = !searchTerm || 
      result.athlete_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.meet_name.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSeason && matchesGender && matchesSearch
  })

  // Pagination
  const totalPages = Math.ceil(filteredResults.length / resultsPerPage)
  const startIndex = (currentPage - 1) * resultsPerPage
  const endIndex = startIndex + resultsPerPage
  const currentResults = filteredResults.slice(startIndex, endIndex)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Results...</div>
          <div className="text-gray-600">Getting race results...</div>
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
            <span className="text-black font-medium">All Results</span>
          </nav>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h1 className="text-3xl font-bold text-black mb-2">{school.name}</h1>
          <p className="text-lg text-gray-600">All Race Results</p>
          <div className="mt-2 text-sm text-gray-500">
            {results.length} total results
          </div>
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
              <div className="px-6 py-4 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                All Results
              </div>
            </nav>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Athlete or meet name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Season
              </label>
              <select
                value={selectedSeason}
                onChange={(e) => {
                  setSelectedSeason(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              >
                <option value="all">All Seasons</option>
                {availableSeasons.map(season => (
                  <option key={season} value={season.toString()}>
                    {season}-{season + 1}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <select
                value={selectedGender}
                onChange={(e) => {
                  setSelectedGender(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              >
                <option value="">All Genders</option>
                <option value="M">Boys</option>
                <option value="F">Girls</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedSeason('all')
                  setSelectedGender('')
                  setCurrentPage(1)
                }}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {startIndex + 1}-{Math.min(endIndex, filteredResults.length)} of {filteredResults.length} results
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredResults.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">No results found.</div>
              <div className="text-sm text-gray-400">
                Try adjusting your filters.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b text-left bg-gray-50">
                    <th className="py-3 px-4 font-bold text-black">Date</th>
                    <th className="py-3 px-4 font-bold text-black">Athlete</th>
                    <th className="py-3 px-4 font-bold text-black">Meet</th>
                    <th className="py-3 px-4 font-bold text-black">Grade</th>
                    <th className="py-3 px-4 font-bold text-black">Place</th>
                    <th className="py-3 px-4 font-bold text-black">Raw Time</th>
                    <th className="py-3 px-4 font-bold text-black">XC Time</th>
                    <th className="py-3 px-4 font-bold text-black">Season</th>
                  </tr>
                </thead>
                <tbody>
                  {currentResults.map((result) => (
                    <tr key={result.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">
                        {new Date(result.meet_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <a 
                          href={`/athletes/${result.athlete_id}`}
                          className="font-semibold text-red-600 hover:text-red-800"
                        >
                          {result.athlete_name}
                        </a>
                        <div className="text-xs text-gray-500">
                          {result.gender === 'M' || result.gender === 'Boys' ? 'Boys' : 'Girls'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="font-medium">{result.meet_name}</div>
                        <div className="text-xs text-gray-500">{result.course_name}</div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {result.grade || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold">
                        {result.place ? `#${result.place}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono">
                        {formatTime(result.time_seconds)}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono font-semibold text-blue-600">
                        {formatTime(result.xc_time)}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {result.season_year ? `${result.season_year}-${result.season_year + 1}` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 border rounded text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                First
              </button>
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
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border rounded text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Last
              </button>
            </div>
          </div>
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
