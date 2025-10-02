'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { formatMeetDateShort } from '@/lib/utils'

interface Meet {
  id: string
  name: string
  meet_date: string
  meet_type: string
  venue: string
  race_count: number
}

type SortField = 'meet_date' | 'name' | 'meet_type' | 'venue'
type SortDirection = 'asc' | 'desc'

export default function MeetsPage() {
  const [meets, setMeets] = useState<Meet[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('meet_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const meetsPerPage = 50

  const supabase = createClientComponentClient()

  useEffect(() => {
    loadMeets()
  }, [])

  const loadMeets = async () => {
    try {
      setLoading(true)
      
      // Get meets with race counts and first course name as venue
      const { data: meetsData, error } = await supabase
        .from('meets')
        .select(`
          id,
          name,
          meet_date,
          meet_type,
          races(
            id,
            course:courses(name)
          )
        `)
        .order('meet_date', { ascending: false })

      if (error) throw error

const processedMeets: Meet[] = meetsData?.map(meet => ({
  id: meet.id,
  name: meet.name,
  meet_date: meet.meet_date,
  meet_type: meet.meet_type,
  venue: ((meet.races?.[0]?.course as any)?.[0]?.name || (meet.races?.[0]?.course as any)?.name || 'N/A').split('|')[0].trim(),
  race_count: meet.races?.length || 0
})) || []

setMeets(processedMeets)
    } catch (error) {
      console.error('Error loading meets:', error)
    } finally {
      setLoading(false)
    }
  }


  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

const sortedMeets = [...meets].sort((a, b) => {
  let aVal: string | number = a[sortField]
  let bVal: string | number = b[sortField]

  // Handle date sorting
  if (sortField === 'meet_date') {
    aVal = new Date(aVal).getTime()
    bVal = new Date(bVal).getTime()
  }

  if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
  if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
  return 0
})

  // Pagination
  const totalPages = Math.ceil(sortedMeets.length / meetsPerPage)
  const startIndex = (currentPage - 1) * meetsPerPage
  const endIndex = startIndex + meetsPerPage
  const currentMeets = sortedMeets.slice(startIndex, endIndex)

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>
    }
    return <span className="text-green-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl font-semibold">Loading meets...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-black mb-2">Cross Country Meets</h1>
            <p className="text-gray-600">{meets.length} total meets</p>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {startIndex + 1}-{Math.min(endIndex, sortedMeets.length)} of {sortedMeets.length} meets
        </div>

        {/* Meets Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th 
                    onClick={() => handleSort('meet_date')}
                    className="py-3 px-4 text-left font-bold text-black cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Date <SortIcon field="meet_date" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('name')}
                    className="py-3 px-4 text-left font-bold text-black cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Meet Name <SortIcon field="name" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('meet_type')}
                    className="py-3 px-4 text-left font-bold text-black cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Type <SortIcon field="meet_type" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('venue')}
                    className="py-3 px-4 text-left font-bold text-black cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Venue <SortIcon field="venue" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-left font-bold text-black">
                    Races
                  </th>
                  <th className="py-3 px-4 text-left font-bold text-black">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentMeets.map((meet) => (
                  <tr key={meet.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 whitespace-nowrap">
                    {formatMeetDateShort(meet.meet_date)}
                    </td>
                    <td className="py-3 px-4">
                      <a 
                        href={`/meets/${meet.id}`}
                        className="font-bold text-blue-600 hover:text-blue-800"
                      >
                        {meet.name}
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                        {meet.meet_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {meet.venue}
                    </td>
                    <td className="py-3 px-4">
                      {meet.race_count}
                    </td>
                    <td className="py-3 px-4">
                      <a 
                        href={`/meets/${meet.id}`}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        View Meet
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
      </div>
    </div>
  )
}