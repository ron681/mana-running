'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@/lib/supabase/client'

interface School {
  id: string
  name: string
  created_at: string
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const schoolsPerPage = 20

  const supabase = createClientComponentClient()

  useEffect(() => {
    loadSchools()
  }, [])

  const loadSchools = async () => {
    try {
      setLoading(true)
      setError(null)

      // SUPER FAST: Just get schools, no counts needed
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select(`
          id,
          name,
          created_at
        `)
        .order('name', { ascending: true })

      if (schoolsError) {
        throw schoolsError
      }

      const schools: School[] = schoolsData || []

      setSchools(schools)
    } catch (err) {
      console.error('Error loading schools:', err)
      setError('Failed to load schools')
    } finally {
      setLoading(false)
    }
  }

  // Filter schools based on search
  const filteredSchools = schools.filter(school => 
    !searchTerm || school.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Pagination
  const totalPages = Math.ceil(filteredSchools.length / schoolsPerPage)
  const startIndex = (currentPage - 1) * schoolsPerPage
  const endIndex = startIndex + schoolsPerPage
  const currentSchools = filteredSchools.slice(startIndex, endIndex)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Schools...</div>
          <div className="text-gray-600">Getting school information...</div>
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
            onClick={loadSchools}
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
          <h1 className="text-3xl font-bold text-black mb-2">Schools</h1>
          <p className="text-gray-600">Browse all schools with their athletes and performance data</p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Schools
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search by school name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {startIndex + 1}-{Math.min(endIndex, filteredSchools.length)} of {filteredSchools.length} schools
        </div>

        {/* Schools Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-black">School Directory</h2>
          </div>
          
          {filteredSchools.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">No schools found matching your search.</div>
              <div className="text-sm text-gray-400">
                Try adjusting your search criteria.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b text-left bg-gray-50">
                    <th className="py-3 px-4 font-bold text-black">School Name</th>
                    <th className="py-3 px-4 font-bold text-black">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSchools.map((school) => (
                    <tr key={school.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <a 
                          href={`/schools/${school.id}`}
                          className="text-lg font-bold text-red-600 hover:text-red-800 transition-colors"
                        >
                          {school.name}
                        </a>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex space-x-2">
                          <a 
                            href={`/schools/${school.id}`}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                          >
                            View School
                          </a>
                        </div>
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