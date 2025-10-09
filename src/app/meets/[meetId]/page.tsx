// app/meets/[meetId]/page.tsx
import { createServerComponentClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { formatMeetDate, formatTime } from '@/lib/utils'
import { notFound } from 'next/navigation'

interface RaceData {
  id: string
  name: string
  category: string
  gender: string
  course_id: string | null
  course_name: string | null
  course_distance: number | null
  results_count: number
  fastest_time: number | null
}

export default async function MeetDetailPage({
  params
}: {
  params: { meetId: string }
}) {
  const supabase = createServerComponentClient({ cookies })
  
  // Get the meet basic info
  const { data: meet, error: meetError } = await supabase
    .from('meets')
    .select('id, name, meet_date, meet_type')
    .eq('id', params.meetId)
    .single()

  if (meetError || !meet) {
    notFound()
  }

  // Get all races for this meet
  const { data: races, error: racesError } = await supabase
    .from('races')
    .select(`
      id,
      name,
      category,
      gender,
      course_id,
      courses (
        name,
        distance_miles
      )
    `)
    .eq('meet_id', params.meetId)
    .order('category')
    .order('gender')

  if (racesError) {
    console.error('Error loading races:', racesError)
  }

  // Get results count for each race
  const processedRaces: RaceData[] = []
  
  for (const race of races || []) {
    const { data: results } = await supabase
      .from('results')
      .select('time_seconds')
      .eq('race_id', race.id)

    const times = results?.map(r => r.time_seconds).filter(Boolean) || []
    const fastestTime = times.length > 0 ? Math.min(...times) : null
    
    const course = Array.isArray(race.courses) ? race.courses[0] : race.courses
    
    processedRaces.push({
      id: race.id,
      name: race.name,
      category: race.category,
      gender: race.gender,
      course_id: race.course_id,
      course_name: course?.name || null,
      course_distance: course?.distance_miles || null,
      results_count: results?.length || 0,
      fastest_time: fastestTime
    })
  }

  // Sort races by category then by gender
  const categoryOrder: Record<string, number> = { 
    'Varsity': 1, 
    'Junior Varsity': 2, 
    'JV': 2,
    'Reserves': 3,
    'Frosh-Soph': 4,
    'Freshmen': 5
  }
  
  const sortedRaces = processedRaces.sort((a, b) => {
    // Extract category for sorting (look for keywords)
    const getCategoryPriority = (cat: string) => {
      if (cat.toLowerCase().includes('varsity') && !cat.toLowerCase().includes('junior')) return 1
      if (cat.toLowerCase().includes('jv') || cat.toLowerCase().includes('junior')) return 2
      if (cat.toLowerCase().includes('reserve')) return 3
      if (cat.toLowerCase().includes('frosh') || cat.toLowerCase().includes('soph')) return 4
      if (cat.toLowerCase().includes('fresh')) return 5
      return 999
    }
    
    const categoryCompare = getCategoryPriority(a.category) - getCategoryPriority(b.category)
    if (categoryCompare !== 0) return categoryCompare
    
    // Boys before Girls
    return a.gender.localeCompare(b.gender)
  })

  const totalRaces = sortedRaces.length
  const totalParticipants = sortedRaces.reduce((sum, race) => sum + race.results_count, 0)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/meets"
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to Meets
        </Link>
        
        {/* Main Meet Info Box */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{meet.name}</h1>
          
          <div className="grid md:grid-cols-2 gap-4 text-gray-600">
            <div>
              <p className="mb-2"><strong>Date:</strong> {formatMeetDate(meet.meet_date)}</p>
              <p className="mb-2"><strong>Type:</strong> {meet.meet_type}</p>
            </div>
            <div className="text-right md:text-left">
              <p className="mb-2"><strong>Races:</strong> {totalRaces}</p>
              <p className="mb-2"><strong>Total Runners:</strong> {totalParticipants}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mb-6">
          <Link
            href={`/meets/${params.meetId}/combined`}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            View Combined Results
          </Link>
        </div>
      </div>

      {/* Races Grid */}
      {sortedRaces.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedRaces.map((race) => {
            // Parse course name to remove redundant distance info
            const courseNameParts = race.course_name?.split('|') || []
            const cleanCourseName = courseNameParts[0]?.trim() || race.course_name
            
            return (
              <Link
                key={race.id}
                href={`/meets/${params.meetId}/races/${race.id}`}
                className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200"
              >
                <div className="mb-4">
                  {/* Race Title */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    {race.name}
                  </h3>

                  {/* Course Info */}
                  {cleanCourseName ? (
                    <div className="text-sm text-gray-600 mb-3 pb-3 border-b border-gray-100">
                      <p className="font-medium text-gray-700">📍 {cleanCourseName}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 mb-3 pb-3 border-b border-gray-100">
                      <p>No course assigned</p>
                    </div>
                  )}
                  
                  {/* Stats */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Runners:</span>
                      <span className="font-semibold text-gray-900">{race.results_count}</span>
                    </div>
                    {race.fastest_time && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Fastest:</span>
                        <span className="font-mono font-semibold text-blue-600">{formatTime(race.fastest_time)}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-100">
                  <span className="text-blue-600 font-medium text-sm flex items-center justify-between">
                    View Results 
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl text-gray-600 mb-2">No races found</h2>
          <p className="text-gray-500">This meet doesn't have any race data yet.</p>
        </div>
      )}
    </div>
  )
}