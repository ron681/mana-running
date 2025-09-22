'use client'

import { useEffect, useState } from 'react'
import { meetCRUD, resultCRUD } from '@/lib/crud-operations'
import { formatTime } from '@/lib/timeConverter'
import { getGradeDisplay } from '@/lib/grade-utils'

interface Meet {
  id: string
  name: string
  meet_date: string
  gender: string
  meet_type: string
  course?: {
    id: string
    name: string
    distance_miles: number
    difficulty_rating: number
  }
}

interface Result {
  id: string
  time_seconds: number
  place_overall: number
  place_team: number
  season_year: number
  athlete: {
    id: string
    first_name: string
    last_name: string
    graduation_year: number
    school: {
      name: string
    }
  }
}

interface Props {
  params: {
    id: string
  }
}

export default function IndividualRacePage({ params }: Props) {
  const [meet, setMeet] = useState<Meet | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRaceData()
  }, [params.id])

  const loadRaceData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load meet details and results
      const [meetData, resultsData] = await Promise.all([
        meetCRUD.getById(params.id),
        resultCRUD.getByMeetId(params.id)
      ])

      setMeet(meetData)
      setResults(resultsData || [])
    } catch (err) {
      console.error('Error loading race data:', err)
      setError('Failed to load race data')
    } finally {
      setLoading(false)
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

  // Helper function to get grade color based on grade level
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case '12': return 'bg-red-100 text-red-800'
      case '11': return 'bg-orange-100 text-orange-800'
      case '10': return 'bg-yellow-100 text-yellow-800'
      case '9': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Race Results...</div>
          <div className="text-gray-600">Getting race information...</div>
        </div>
      </div>
    )
  }

  if (error || !meet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-xl font-semibold mb-2 text-red-600">Error</div>
          <div className="text-gray-600 mb-4">{error || 'Race not found'}</div>
          <a 
            href="/races"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Back to Races
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
            <a href="/" className="hover:text-blue-600">Home</a>
            <span className="mx-2">/</span>
            <a href="/races" className="hover:text-blue-600">Races</a>
            <span className="mx-2">/</span>
            <span className="text-black font-medium">{meet.name}</span>
          </nav>
        </div>

        {/* Race Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">{meet.name}</h1>
              <div className="space-y-1 text-gray-600">
                <div>Date: <span className="font-medium text-black">{formatDate(meet.meet_date)}</span></div>
                {meet.course && (
                  <div>Course: <span className="font-medium text-black">{meet.course.name}</span></div>
                )}
                {meet.course?.distance_miles && (
                  <div>Distance: <span className="font-medium text-black">{meet.course.distance_miles.toFixed(2)} miles</span></div>
                )}
                {meet.meet_type && (
                  <div>Type: <span className="font-medium text-black">{meet.meet_type}</span></div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <span className={`px-3 py-1 rounded text-sm font-semibold ${
                meet.gender === 'Boys' ? 'bg-blue-100 text-blue-800' :
                meet.gender === 'Girls' ? 'bg-pink-100 text-pink-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {meet.gender}
              </span>
              <div className="text-sm text-gray-600">
                {results.length} participants
              </div>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-black">Race Results</h2>
          </div>
          
          {results.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">No results found for this race.</div>
              <div className="text-sm text-gray-400">
                Results may not have been imported yet.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b text-left bg-gray-50">
                    <th className="py-3 px-4 font-bold text-black">Place</th>
                    <th className="py-3 px-4 font-bold text-black">Athlete</th>
                    <th className="py-3 px-4 font-bold text-black">School</th>
                    <th className="py-3 px-4 font-bold text-black">Grade</th>
                    <th className="py-3 px-4 font-bold text-black">Time</th>
                    <th className="py-3 px-4 font-bold text-black">Team Place</th>
                  </tr>
                </thead>
                <tbody>
                  {results
                    .sort((a, b) => a.place_overall - b.place_overall)
                    .map((result) => {
                      const grade = result.athlete.graduation_year 
                        ? getGradeDisplay(result.athlete.graduation_year, meet.meet_date)
                        : 'N/A';
                      
                      return (
                        <tr key={result.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <span className={`font-bold text-lg ${
                                result.place_overall <= 3 ? 'text-yellow-600' :
                                result.place_overall <= 10 ? 'text-blue-600' :
                                'text-black'
                              }`}>
                                {result.place_overall}
                              </span>
                              {result.place_overall === 1 && (
                                <span className="ml-2 text-yellow-500">🥇</span>
                              )}
                              {result.place_overall === 2 && (
                                <span className="ml-2 text-gray-400">🥈</span>
                              )}
                              {result.place_overall === 3 && (
                                <span className="ml-2 text-yellow-600">🥉</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <a 
                              href={`/athletes/${result.athlete.id}`}
                              className="font-bold text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              {result.athlete.first_name} {result.athlete.last_name}
                            </a>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-black">
                              {result.athlete.school?.name || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-sm font-semibold ${getGradeColor(grade)}`}>
                              {grade}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-lg font-bold text-black">
                              {formatTime(result.time_seconds)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {result.place_team ? (
                              <span className="px-2 py-1 rounded text-sm bg-blue-100 text-blue-800">
                                {result.place_team}
                              </span>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Back Button */}
        <div className="mt-6">
          <a 
            href="/races"
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
          >
            ← Back to All Races
          </a>
        </div>
      </div>
    </div>
  )
}