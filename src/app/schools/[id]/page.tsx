// src/app/schools/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { schoolCRUD, athleteCRUD } from '@/lib/crud-operations'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface School {
  id: string
  name: string
  state?: string
  created_at: string
}

interface Athlete {
  id: string
  first_name: string
  last_name: string
  graduation_year: number
  gender: string
  current_school_id: string
  results_count?: number
}

interface Props {
  params: {
    id: string
  }
}

const supabase = createClientComponentClient()

export default function SchoolPage({ params }: Props) {
  const [school, setSchool] = useState<School | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGender, setSelectedGender] = useState('')
  const [selectedGradYear, setSelectedGradYear] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const athletesPerPage = 25

  useEffect(() => {
    loadSchoolData()
  }, [params.id])

  const loadSchoolData = async () => {
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

    // Load only athletes for this school
const { data: schoolAthletes, error: athletesError } = await supabase
  .from('athletes')
  .select(`
    *,
    school:schools(id, name)
  `)
  .eq('current_school_id', params.id)
  .order('last_name')

if (athletesError) throw athletesError

      setAthletes(schoolAthletes)
    } catch (err) {
      console.error('Error loading school data:', err)
      setError('Failed to load school data')
    } finally {
      setLoading(false)
    }
  }

  // Filter athletes based on search and filters
  const filteredAthletes = athletes.filter(athlete => {
    const matchesSearch = !searchTerm || 
      athlete.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      athlete.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesGender = !selectedGender || athlete.gender === selectedGender
    const matchesGradYear = !selectedGradYear || athlete.graduation_year?.toString() === selectedGradYear

    return matchesSearch && matchesGender && matchesGradYear
  })

  // Sort athletes by last name
  const sortedAthletes = filteredAthletes.sort((a, b) => 
    a.last_name.localeCompare(b.last_name)
  )

  // Pagination
  const totalPages = Math.ceil(sortedAthletes.length / athletesPerPage)
  const startIndex = (currentPage - 1) * athletesPerPage
  const endIndex = startIndex + athletesPerPage
  const currentAthletes = sortedAthletes.slice(startIndex, endIndex)

  // Get unique values for filters
  const genders = [...new Set(athletes.map(a => a.gender).filter(Boolean))]
  const gradYears = [...new Set(athletes.map(a => a.graduation_year).filter(Boolean))].sort((a, b) => b - a)

  const getClassYear = (gradYear: number) => {
    if (!gradYear) return 'N/A'
    return gradYear.toString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading School...</div>
          <div className="text-gray-600">Getting athlete roster...</div>
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
            <span className="text-black font-medium">{school.name}</span>
          </nav>
        </div>

        {/* School Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">{school.name}</h1>
              <div className="text-gray-600">
                <div>{athletes.length} total athletes</div>
                <div className="text-sm mt-1">
                  {genders.map(gender => {
                    const count = athletes.filter(a => a.gender === gender).length
                    return count > 0 ? `${count} ${gender}` : null
                  }).filter(Boolean).join(' • ')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <div className="px-6 py-4 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                Athletes
              </div>
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
                Season History
              </a>
              <a 
                href={`/schools/${school.id}/results`}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300"
              >
                Season Results
              </a>
              <a 
                href={`/schools/${school.id}/team-selection`}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300"
              >
                Team Selection
              </a>
            </nav>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Athletes
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search by name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              />
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
                {genders.map(gender => (
                  <option key={gender} value={gender}>{gender}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Graduation Year
              </label>
              <select
                value={selectedGradYear}
                onChange={(e) => {
                  setSelectedGradYear(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              >
                <option value="">All Years</option>
                {gradYears.map(year => (
                  <option key={year} value={year.toString()}>Class of {year}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedGender('')
                  setSelectedGradYear('')
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
          Showing {startIndex + 1}-{Math.min(endIndex, sortedAthletes.length)} of {sortedAthletes.length} athletes
        </div>

        {/* Athletes Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-black">School Roster</h2>
          </div>
          
          {sortedAthletes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">No athletes found matching your criteria.</div>
              <div className="text-sm text-gray-400">
                Try adjusting your search or filters.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b text-left bg-gray-50">
                    <th className="py-3 px-4 font-bold text-black">Athlete Name</th>
                    <th className="py-3 px-4 font-bold text-black">Class</th>
                    <th className="py-3 px-4 font-bold text-black">Gender</th>
                    <th className="py-3 px-4 font-bold text-black">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentAthletes.map((athlete) => (
                    <tr key={athlete.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <a 
                          href={`/athletes/${athlete.id}`}
                          className="font-bold text-red-600 hover:text-red-800 transition-colors"
                        >
                          {athlete.last_name}, {athlete.first_name}
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                          {getClassYear(athlete.graduation_year)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${
                          athlete.gender === 'Boys' || athlete.gender === 'M' ? 'bg-blue-100 text-blue-800' :
                          athlete.gender === 'Girls' || athlete.gender === 'F' ? 'bg-pink-100 text-pink-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {athlete.gender || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <a 
                          href={`/athletes/${athlete.id}`}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                        >
                          View Profile
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
       {/* Pagination */}
{totalPages > 1 && (
  <div className="flex items-center justify-between mt-8 pt-4 border-t">
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
        onClick={() => setCurrentPage(Math.max(1, currentPage - 10))}
        disabled={currentPage <= 10}
        className="px-3 py-2 border rounded text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        -10
      </button>
      <button
        onClick={() => setCurrentPage(Math.max(1, currentPage - 5))}
        disabled={currentPage <= 5}
        className="px-3 py-2 border rounded text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        -5
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
        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 5))}
        disabled={currentPage > totalPages - 5}
        className="px-3 py-2 border rounded text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        +5
      </button>
      <button
        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 10))}
        disabled={currentPage > totalPages - 10}
        className="px-3 py-2 border rounded text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        +10
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
            href="/schools"
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
          >
            ← Back to All Schools
          </a>
        </div>
      </div>
    </div>
  )
}