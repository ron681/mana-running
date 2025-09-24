// app/meets/[meetId]/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { formatMeetDate, formatTime } from '@/lib/utils'
import { notFound } from 'next/navigation'

interface Race {
  id: string
  name: string
  category: string
  gender: string
  total_participants: number
  fastest_time: number | null
}[]

interface Meet {
  id: string
  name: string
  meet_date: string
  meet_type: string
  courses: {
    name: string
    distance_miles: number
  }
  races: Race[]
}

export default async function MeetDetailPage({
  params
}: {
  params: { meetId: string }
}) {
  const supabase = createServerComponentClient({ cookies })
  
  // Get meet details with races and fastest times
  const { data: meet, error } = await supabase
    .from('meets')
    .select(`
      id,
      name,
      meet_date,
      meet_type,
      courses!inner(
        name,
        distance_miles
      ),
      races(
        id,
        name,
        category,
        gender,
        total_participants,
        results(
          time_seconds
        )
      )
    `)
    .eq('id', params.meetId)
    .single()

  if (error || !meet) {
    notFound()
  }
  // Safe course access
const course = Array.isArray(meet.courses) ? meet.courses[0] : meet.courses

  // Process races to get fastest times
  const processedRaces: Race[] = meet.races.map(race => {
    const times = race.results.map(r => r.time_seconds).filter(Boolean)
    const fastestTime = times.length > 0 ? Math.min(...times) : null
    
    return {
      id: race.id,
      name: race.name,
      category: race.category,
      gender: race.gender,
      total_participants: race.total_participants || 0,
      fastest_time: fastestTime
    }
  })

  // Sort races by category (Varsity, JV, Reserves) then by gender
  const categoryOrder = { 'Varsity': 1, 'JV': 2, 'Reserves': 3 }
  const sortedRaces = processedRaces.sort((a, b) => {
    const categoryCompare = (categoryOrder[a.category as keyof typeof categoryOrder] || 999) - 
                           (categoryOrder[b.category as keyof typeof categoryOrder] || 999)
    if (categoryCompare !== 0) return categoryCompare
    return a.gender.localeCompare(b.gender)
  })

  const totalParticipants = processedRaces.reduce((sum, race) => sum + race.total_participants, 0)

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
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{meet.name}</h1>
          
          <div className="grid md:grid-cols-2 gap-4 text-gray-600">
            <div>
              <p className="mb-2"><strong>Date:</strong> {formatMeetDate(meet.meet_date)}</p>
              <p className="mb-2"><strong>Type:</strong> {meet.meet_type}</p>
            </div>
            <div>
            <p className="mb-2"><strong>Course:</strong> {course?.name}</p>
            <p className="mb-2"><strong>Distance:</strong> {course?.distance_miles} miles</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-lg font-medium text-gray-900">
              {processedRaces.length} races • {totalParticipants} total participants
            </p>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedRaces.map((race) => (
          <Link
            key={race.id}
            href={`/meets/${params.meetId}/races/${race.id}`}
            className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {race.category} {race.gender === 'M' ? 'Boys' : 'Girls'}
              </h3>
              
              <div className="space-y-1 text-sm text-gray-600">
                <p>👥 {race.total_participants} runners</p>
                {race.fastest_time && (
                  <p>⚡ Fastest: {formatTime(race.fastest_time)}</p>
                )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-100">
              <span className="text-blue-600 font-medium text-sm">
                View Results →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {sortedRaces.length === 0 && (
        <div className="text-center py-12">
          <h2 className="text-xl text-gray-600 mb-4">No races found</h2>
          <p className="text-gray-500">This meet doesn't have any race data yet.</p>
        </div>
      )}
    </div>
  )
}