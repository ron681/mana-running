'use client'

import { useEffect, useState } from 'react'
import { meetCRUD } from '@/lib/crud-operations'

interface Meet {
  id: string
  name: string
  date: string
  gender: string
  meet_type: string
  course?: { name: string; location?: string }
  participants_count?: number
}

export default function RacesPage() {
  const [meets, setMeets] = useState<Meet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGender, setSelectedGender] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const meetsPerPage = 20

  useEffect(() => {
    loadMeets()
  }, [])

  const loadMeets = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get all meets with course information
      const allMeets = await meetCRUD.getAll()
      
      if (allMeets) {
        // Sort by date (newest first) - your column is 'date' not 'meet_date'
        const sortedMeets = allMeets.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        setMeets(sortedMeets)
      }
    } catch (err) {
      console.error('Error loading meets:', err)
      setError('Failed to load meets')
    } finally {
      setLoading(false)
    }
  }

  // Filter meets based on search and filters
  const filteredMeets = meets.filter(meet => {
    const matchesSearch = !searchTerm || 
      meet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meet.course?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesGender = !selectedGender || meet.gender === selectedGender
    const matchesType = !selectedType || meet.meet_type === selectedType
    
    // Year filter
    const meetDate = new Date(meet.date);
    const isValidDate = !isNaN(meetDate.getTime());
    const meetYear = isValidDate ? meetDate.getFullYear().toString() : null;
    const matchesYear = !selectedYear || meetYear === selectedYear;

    return matchesSearch && matchesGender && matchesType && matchesYear
  })

  // Pagination
  const totalPages = Math.ceil(filteredMeets.length / meetsPerPage)
  const startIndex = (currentPage - 1) * meetsPerPage
  const endIndex = startIndex + meetsPerPage
  const currentMeets = filteredMeets.slice(startIndex, endIndex)

  // Get unique values for filters
  const genders = [...new Set(meets.map(m => m.gender).filter(Boolean))]
  const types = [...new Set(meets.map(m => m.meet_type).filter(Boolean))]
  const years = [...new Set(meets.map(m => {
    const meetDate = new Date(m.date);
    return !isNaN(meetDate.getTime()) ? meetDate.getFullYear().toString() : null;
  }).filter((year): year is string => year !== null))].sort((a, b) => (b as string).localeCompare(a as string))

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Races...</div>
          <div className="text-gray-600">Getting meet information...</div>
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
            onClick={loadMeets}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
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
          <h1 className="text-3xl font-bold text-black mb-2">Races & Meets</h1>
          <p className="text-gray-600">Browse all cross country meets and races with detailed results</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Meets
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by meet or course name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Years</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Genders</option>
                {genders.map(gender => (
                  <option key={gender} value={gender}>{gender}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meet Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                {types.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedGender('')
                  setSelectedType('')
                  setSelectedYear('')
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
          Showing {startIndex + 1}-{Math.min(endIndex, filteredMeets.length)} of {filteredMeets.length} meets
        </div>

        {/* Meets Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-black">Race Results</h2>
          </div>
          
          {filteredMeets.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">No meets found matching your criteria.</div>
              <div className="text-sm text-gray-400">
                Try adjusting your search or filters.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b text-left bg-gray-50">
                    <th className="py-3 px-4 font-bold text-black">Meet Name</th>
                    <th className="py-3 px-4 font-bold text-black">Date</th>
                    <th className="py-3 px-4 font-bold text-black">Year</th>
                    <th className="py-3 px-4 font-bold text-black">Gender</th>
                    <th className="py-3 px-4 font-bold text-black">Type</th>
                    <th className="py-3 px-4 font-bold text-black">Course</th>
                    <th className="py-3 px-4 font-bold text-black">Results</th>
                    <th className="py-3 px-4 font-bold text-black">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMeets.map((meet) => {
                    const meetDate = new Date(meet.date);
                    const isValidDate = !isNaN(meetDate.getTime());
                    
                    return (
                      <tr key={meet.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <a 
                            href={`/races/${meet.id}`}
                            className="font-bold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            {meet.name}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-sm text-black">
                          {isValidDate ? formatDate(meet.date) : 'Invalid Date'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded text-sm font-semibold bg-gray-800 text-white">
                            {isValidDate ? meetDate.getFullYear() : 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-sm font-semibold ${
                            meet.gender === 'Boys' ? 'bg-blue-100 text-blue-800' :
                            meet.gender === 'Girls' ? 'bg-pink-100 text-pink-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {meet.gender || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-black">
                          {meet.meet_type || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-sm text-black">
                          {meet.course?.name || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-1 rounded text-sm font-bold bg-green-100 text-green-800">
                            {meet.participants_count || 0}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <a 
                            href={`/races/${meet.id}`}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                          >
                            View Results
                          </a>
                        </td>
                      </tr>
                    );
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
