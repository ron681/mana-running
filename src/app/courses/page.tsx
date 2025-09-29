'use client'

import { useEffect, useState } from 'react'
import { courseCRUD } from '@/lib/crud-operations'

interface Course {
  id: string
  name: string
  distance_meters: number
  distance_miles: number
  mile_difficulty: number | null      // NEW: How hard vs 1-mile track
  xc_time_rating: number | null       // NEW: For XC time conversion
  rating_confidence: string
  total_results_count: number
  meets_count?: number
}

type SortField = 'name' | 'distance_miles' | 'mile_difficulty' | 'meets_count' | 'total_results_count';
type SortDirection = 'asc' | 'desc';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDistance, setSelectedDistance] = useState('')
  const [showWithResults, setShowWithResults] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
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
        setCourses(allCourses)
      }
    } catch (err) {
      console.error('Error loading courses:', err)
      setError('Failed to load courses')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default to ascending
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1) // Reset to first page when sorting
  }

  // Filter and sort courses
  const filteredAndSortedCourses = courses
    .filter(course => {
      const matchesSearch = !searchTerm || 
        course.name.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesDistance = !selectedDistance || 
        Math.abs(course.distance_miles - parseFloat(selectedDistance)) < 0.1

      const matchesResults = !showWithResults || 
        (course.total_results_count && course.total_results_count > 0)

      return matchesSearch && matchesDistance && matchesResults
    })
    .sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'distance_miles':
          aValue = a.distance_miles || 0
          bValue = b.distance_miles || 0
          break
        case 'mile_difficulty':
          aValue = a.mile_difficulty || 0
          bValue = b.mile_difficulty || 0
          break
        case 'meets_count':
          aValue = a.meets_count || 0
          bValue = b.meets_count || 0
          break
        case 'total_results_count':
          aValue = a.total_results_count || 0
          bValue = b.total_results_count || 0
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCourses.length / coursesPerPage)
  const startIndex = (currentPage - 1) * coursesPerPage
  const endIndex = startIndex + coursesPerPage
  const currentCourses = filteredAndSortedCourses.slice(startIndex, endIndex)

  // Get unique distances for filter
  const distances = [...new Set(courses.map(c => c.distance_miles).filter(Boolean))]
    .sort((a, b) => a - b)

  // Sortable header component
  const SortableHeader = ({ 
    field, 
    children, 
    className = "" 
  }: { 
    field: SortField; 
    children: React.ReactNode; 
    className?: string;
  }) => {
    const isActive = sortField === field
    const isAsc = sortDirection === 'asc'
    
    return (
      <th 
        className={`py-3 px-4 font-bold text-black cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          <div className="flex flex-col ml-1">
            <svg 
              className={`w-3 h-3 ${isActive && isAsc ? 'text-green-600' : 'text-gray-400'}`} 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            <svg 
              className={`w-3 h-3 -mt-1 ${isActive && !isAsc ? 'text-green-600' : 'text-gray-400'}`} 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </th>
    )
  }

  // Updated difficulty colors and labels for mile_difficulty (vs 1-mile track baseline)
  const getDifficultyColor = (mileDifficulty: number) => {
    if (mileDifficulty >= 1.20) return 'bg-red-100 text-red-800'      // Very Hard (20%+ harder than track mile)
    if (mileDifficulty >= 1.15) return 'bg-orange-100 text-orange-800' // Hard (15-20% harder)
    if (mileDifficulty >= 1.05) return 'bg-yellow-100 text-yellow-800' // Moderate (5-15% harder)
    return 'bg-green-100 text-green-800'                               // Fast/Easy (< 5% harder)
  }

  const getDifficultyLabel = (mileDifficulty: number) => {
    if (mileDifficulty >= 1.20) return 'Very Hard'
    if (mileDifficulty >= 1.15) return 'Hard'  
    if (mileDifficulty >= 1.05) return 'Moderate'
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
        {/* Page Header with Import Link */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-black mb-2">Cross Country Courses</h1>
            <p className="text-gray-600">Browse all cross country courses with meet history and performance data</p>
          </div>
          <a 
            href="/courses/import-courses"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Import Courses
          </a>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Results Filter
              </label>
              <div className="flex items-center h-10">
                <input
                  type="checkbox"
                  id="show-with-results"
                  checked={showWithResults}
                  onChange={(e) => {
                    setShowWithResults(e.target.checked)
                    setCurrentPage(1)
                  }}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="show-with-results" className="ml-2 text-sm text-gray-700">
                  Has results only
                </label>
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedDistance('')
                  setShowWithResults(false)
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
          Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedCourses.length)} of {filteredAndSortedCourses.length} courses
          {sortField !== 'name' && (
            <span className="ml-2 text-green-600">
              (sorted by {sortField.replace('_', ' ')} {sortDirection === 'asc' ? '↑' : '↓'})
            </span>
          )}
        </div>

        {/* Courses Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-black">Course Directory</h2>
          </div>
          
          {filteredAndSortedCourses.length === 0 ? (
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
                    <SortableHeader field="name">Course Name</SortableHeader>
                    <SortableHeader field="distance_miles">Distance</SortableHeader>
                    <SortableHeader field="mile_difficulty">Difficulty</SortableHeader>
                    <SortableHeader field="meets_count">Meets</SortableHeader>
                    <SortableHeader field="total_results_count">Total Results</SortableHeader>
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
                          {course.mile_difficulty !== null ? (
                            <div className="flex flex-col space-y-1">
                              <span className={`px-2 py-1 rounded text-sm font-semibold ${getDifficultyColor(course.mile_difficulty)}`}>
                                {getDifficultyLabel(course.mile_difficulty)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {course.mile_difficulty.toFixed(3)}x vs track mile
                              </span>
                              {course.xc_time_rating && (
                                <span className="text-xs text-blue-600">
                                  XC Rating: {course.xc_time_rating.toFixed(3)}
                                </span>
                              )}
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

        {/* Rating System Explanation */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">Course Rating System</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-2">Difficulty Rating (vs Track Mile):</h4>
              <ul className="space-y-1">
                <li>• <strong>1.00:</strong> Same effort as 1-mile track</li>
                <li>• <strong>1.10:</strong> 10% harder than track mile</li>
                <li>• <strong>1.20:</strong> 20% harder than track mile</li>
                <li>• Higher rating = more challenging course</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">XC Time Conversion:</h4>
              <ul className="space-y-1">
                <li>• XC Rating converts times to Crystal Springs equivalent</li>
                <li>• Allows fair comparison across different courses</li>
                <li>• Used for team selection and performance analysis</li>
                <li>• Based on distance and terrain difficulty</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}