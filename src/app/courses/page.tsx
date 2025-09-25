'use client'

import { useEffect, useState } from 'react'
import { courseCRUD } from '@/lib/crud-operations'

interface Course {
  id: string
  name: string
  distance_meters: number
  distance_miles: number
  rating: number | null
  rating_confidence: string
  total_results_count: number
  meets_count?: number
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDistance, setSelectedDistance] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const coursesPerPage = 15

  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    try {
      setLoading(true)
      setError(null)

      const allCourses = await courseCRUD.getAll()
      
      if (allCourses) {
        // Sort by name
        const sortedCourses = allCourses.sort((a, b) => 
          a.name.localeCompare(b.name)
        )
        setCourses(sortedCourses)
      }
    } catch (err) {
      console.error('Error loading courses:', err)
      setError('Failed to load courses')
    } finally {
      setLoading(false)
    }
  }

  // Filter courses based on search and distance
  const filteredCourses = courses.filter(course => {
    const matchesSearch = !searchTerm || 
      course.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesDistance = !selectedDistance || 
      Math.abs(course.distance_miles - parseFloat(selectedDistance)) < 0.1

    return matchesSearch && matchesDistance
  })

  // Pagination
  const totalPages = Math.ceil(filteredCourses.length / coursesPerPage)
  const startIndex = (currentPage - 1) * coursesPerPage
  const endIndex = startIndex + coursesPerPage
  const currentCourses = filteredCourses.slice(startIndex, endIndex)

  // Get unique distances for filter
  const distances = [...new Set(courses.map(c => c.distance_miles).filter(Boolean))]
    .sort((a, b) => a - b)

  const getDifficultyColor = (rating: number) => {
    if (rating >= 1.025) return 'bg-red-100 text-red-800'      // Extremely Hard
    if (rating >= 1.000) return 'bg-orange-100 text-orange-800' // Hard  
    if (rating >= 0.975) return 'bg-yellow-100 text-yellow-800' // Moderate
    return 'bg-green-100 text-green-800'                        // Fast
  }

  const getDifficultyLabel = (rating: number) => {
    if (rating >= 1.025) return 'Extremely Hard'
    if (rating >= 1.000) return 'Hard'
    if (rating >= 0.975) return 'Moderate'
    return 'Fast'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Courses...</div>
          <div className="text-gray-600">Getting course information...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-xl font-semibold mb-2 text-red-600">Error</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button 
            onClick={loadCourses}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Cross Country Courses</h1>
          <p className="text-gray-600">Browse all cross country courses with meet history and performance data</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Courses
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search by course name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distance
              </label>
              <select
                value={selectedDistance}
                onChange={(e) => {
                  setSelectedDistance(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All Distances</option>
                {distances.map(distance => (
                  <option key={distance} value={distance.toString()}>
                    {distance.toFixed(2)} miles
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedDistance('')
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
          Showing {startIndex + 1}-{Math.min(endIndex, filteredCourses.length)} of {filteredCourses.length} courses
        </div>

        {/* Courses Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-black">Course Directory</h2>
          </div>
          
          {filteredCourses.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">No courses found matching your criteria.</div>
              <div className="text-sm text-gray-400">
                Try adjusting your search or filters.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b text-left bg-gray-50">
                    <th className="py-3 px-4 font-bold text-black">Course Name</th>
                    <th className="py-3 px-4 font-bold text-black">Distance</th>
                    <th className="py-3 px-4 font-bold text-black">Rating</th>
                    <th className="py-3 px-4 font-bold text-black">Meets</th>
                    <th className="py-3 px-4 font-bold text-black">Total Results</th>
                    <th className="py-3 px-4 font-bold text-black">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCourses.map((course) => {
                    return (
                      <tr key={course.id} className="border-b hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <a 
                            href={`/courses/${course.id}`}
                            className="text-lg font-bold text-green-600 hover:text-green-800 transition-colors"
                          >
                            {course.name}
                          </a>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm">
                            <div className="font-medium text-black">
                              {course.distance_miles?.toFixed(2)} miles
                            </div>
                            <div className="text-gray-500">
                              {course.distance_meters}m
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {course.rating !== null ? (
                            <div className="flex flex-col space-y-1">
                              <span className={`px-2 py-1 rounded text-sm font-semibold ${getDifficultyColor(course.rating)}`}>
                                {getDifficultyLabel(course.rating)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {course.rating.toFixed(3)}
                              </span>
                            </div>
                          ) : (
                            <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                              Not Rated
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="px-2 py-1 rounded text-sm font-semibold bg-blue-100 text-blue-800">
                            {course.meets_count || 0}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="px-2 py-1 rounded text-sm font-semibold bg-green-100 text-green-800">
                            {course.total_results_count || 0}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex space-x-2">
                            <a 
                              href={`/courses/${course.id}`}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                            >
                              View Details
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
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
  )
}