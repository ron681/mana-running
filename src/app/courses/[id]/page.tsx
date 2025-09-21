'use client'

import { useEffect, useState } from 'react'
import { courseCRUD, meetCRUD, resultCRUD } from '@/lib/crud-operations'

interface Course {
  id: string
  name: string
  distance_meters: number
  distance_miles: number
  difficulty_rating: number
  rating_confidence: string
  total_results_count: number
}

interface Meet {
  id: string
  name: string
  meet_date: string
  gender: string
  meet_type: string
  participants_count?: number
}

interface Result {
  id: string
  time_seconds: number
  place_overall: number
  season_year: number
  athlete: {
    first_name: string
    last_name: string
    graduation_year: number
    school: {
      name: string
    }
  }
  meet: {
    name: string
    meet_date: string
  }
}

interface Props {
  params: {
    id: string
  }
}

export default function IndividualCoursePage({ params }: Props) {
  const [course, setCourse] = useState<Course | null>(null)
  const [meets, setMeets] = useState<Meet[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'meets' | 'results'>('meets')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  useEffect(() => {
    loadCourseData()
  }, [params.id])

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

      // Load results - this would need a custom query in real implementation
      // For now, we'll show placeholder since we don't have a direct course->results query
      setResults([])

    } catch (err) {
      console.error('Error loading course data:', err)
      setError('Failed to load course data')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
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

  const getDifficultyColor = (rating: number) => {
    if (rating >= 1.0) return 'bg-red-100 text-red-800'
    if (rating >= 0.5) return 'bg-yellow-100 text-yellow-800'
    if (rating >= 0.0) return 'bg-green-100 text-green-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getDifficultyLabel = (rating: number) => {
    if (rating >= 1.0) return 'Very Hard'
    if (rating >= 0.5) return 'Moderate'
    if (rating >= 0.0) return 'Easy'
    return 'Unknown'
  }

  // Pagination for current tab
  const currentItems = activeTab === 'meets' ? meets : results
  const totalPages = Math.ceil(currentItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = currentItems.slice(startIndex, endIndex)

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
                  <span className="text-gray-600">Difficulty:</span>
                  <div className="mt-1">
                    {course.difficulty_rating !== null ? (
                      <div className="flex flex-col space-y-1">
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${getDifficultyColor(course.difficulty_rating)} inline-block w-fit`}>
                          {getDifficultyLabel(course.difficulty_rating)}
                        </span>
                        <span className="text-xs text-gray-500">
                          Rating: {course.difficulty_rating.toFixed(3)}
                        </span>
                      </div>
                    ) : (
                      <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                        Not Rated
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

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => {
                  setActiveTab('meets')
                  setCurrentPage(1)
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'meets'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Meets on Course ({meets.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('results')
                  setCurrentPage(1)
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'results'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Results on Course ({results.length})
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'meets' ? (
              // Meets Tab Content
              <div>
                <h3 className="text-xl font-bold text-black mb-4">Meets Held on This Course</h3>
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
                          <th className="py-3 px-4 font-bold text-black">Gender</th>
                          <th className="py-3 px-4 font-bold text-black">Type</th>
                          <th className="py-3 px-4 font-bold text-black">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((meet) => (
                          <tr key={meet.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <a 
                                href={`/races/${meet.id}`}
                                className="font-bold text-green-600 hover:text-green-800 transition-colors"
                              >
                                {(meet as any).name || "Unknown Meet"}
                              </a>
                            </td>
                            <td className="py-3 px-4 text-black">
                              {formatDate((meet as any).meet_date || new Date())}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-sm font-semibold ${
                                (meet as any).gender === 'Boys' ? 'bg-blue-100 text-blue-800' :
                                (meet as any).gender === 'Girls' ? 'bg-pink-100 text-pink-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {(meet as any).gender || 'N/A'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-black">
                              {(meet as any).meet_type || 'N/A'}
                            </td>
                            <td className="py-3 px-4">
                              <a 
                                href={`/races/${meet.id}`}
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
              </div>
            ) : (
              // Results Tab Content
              <div>
                <h3 className="text-xl font-bold text-black mb-4">All Results on This Course</h3>
                <div className="text-center py-12">
                  <div className="text-gray-500 mb-4">Results data coming soon.</div>
                  <div className="text-sm text-gray-400">
                    This feature will show all individual race results from every meet held on this course.
                  </div>
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, currentItems.length)} of {currentItems.length} {activeTab}
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