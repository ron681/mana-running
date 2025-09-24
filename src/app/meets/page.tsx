// app/meets/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { formatMeetDate } from '@/lib/utils'

interface Meet {
  id: string
  name: string
  meet_date: string
  meet_type: string
  courses: {
    name: string
    distance_miles: number
  }
  race_count: number
  total_participants: number
}

export default async function MeetsPage() {
  const supabase = createServerComponentClient({ cookies })
  
  // Get all meets with race counts and participant totals
  const { data: meets, error } = await supabase
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
      races!inner(
        id,
        total_participants
      )
    `)
    .order('meet_date', { ascending: false })

  if (error) {
    console.error('Error fetching meets:', error)
    return <div>Error loading meets</div>
  }

  // Process meets to calculate totals
  const processedMeets: Meet[] = meets?.map(meet => ({
    id: meet.id,
    name: meet.name,
    meet_date: meet.meet_date,
    meet_type: meet.meet_type,
    courses: meet.courses,
    race_count: meet.races.length,
    total_participants: meet.races.reduce((sum, race) => sum + (race.total_participants || 0), 0)
  })) || []

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Cross Country Meets</h1>
        <Link 
          href="/import"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          Import New Meet
        </Link>
      </div>

      {processedMeets.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl text-gray-600 mb-4">No meets found</h2>
          <p className="text-gray-500 mb-6">Import your first meet to get started.</p>
          <Link 
            href="/import"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            Import Meet Data
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {processedMeets.map((meet) => (
            <Link
              key={meet.id}
              href={`/meets/${meet.id}`}
              className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200"
            >
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {meet.name}
                </h2>
                <p className="text-sm text-gray-600 mb-1">
                  📅 {formatMeetDate(meet.meet_date)}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  🏆 {meet.meet_type}
                </p>
                <p className="text-sm text-gray-600">
                  🏃‍♀️ {meet.courses.name} ({meet.courses.distance_miles} mi)
                </p>
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  {meet.race_count} race{meet.race_count !== 1 ? 's' : ''}
                </div>
                <div className="text-sm font-medium text-blue-600">
                  {meet.total_participants} runners
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}