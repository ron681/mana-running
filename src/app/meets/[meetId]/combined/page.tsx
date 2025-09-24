// app/meets/[meetId]/combined/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { formatMeetDate, formatTime } from '@/lib/utils'
import { notFound } from 'next/navigation'

interface CombinedResult {
  id: string
  place: number
  athlete_name: string
  athlete_grade: number | null
  team_name: string
  time_seconds: number
  race_name: string
  race_category: string
  race_gender: string
}

interface Meet {
  id: string
  name: string
  meet_date: string
  meet_type: string
  courses: {
    name: string
    distance_miles: number
  }
}

export default async function CombinedResultsPage({
  params
}: {
  params: { meetId: string }
}) {
  const supabase = createServerComponentClient({ cookies })
  
  // Get meet details
  const { data: meet, error: meetError } = await supabase
    .from('meets')
    .select(`
      id, 
      name, 
      meet_date, 
      meet_type,
      courses!inner(
        name,
        distance_miles
      )
    `)
    .eq('id', params.meetId)
    .single()

  if (meetError || !meet) {
    notFound()
  }

  // Get all results from all races in this meet, sorted by time
  const { data: results, error: resultsError } = await supabase
    .from('results')
    .select(`
      id,
      place_overall,
      time_seconds,
      athletes!inner(
        first_name,
        last_name,
        graduation_year,
        schools!inner(name)
      ),
      races!inner(
        name,
        category,
        gender
      )
    `)
    .eq('meet_id', params.meetId)
    .not('time_seconds', 'is', null)
    .order('time_seconds', { ascending: true })

  if (resultsError) {
    console.error('Error fetching results:', resultsError)
    return <div>Error loading results</div>
  }

  // Process and transform results to match expected format
  const combinedResults: CombinedResult[] = results?.map((result, index) => ({
    id: result.id,
    place: index + 1, // Overall place across all races
    athlete_name: `${result.athletes.first_name} ${result.athletes.last_name}`,
    athlete_grade: result.athletes.graduation_year ? new Date().getFullYear() - result.athletes.graduation_year + 12 : null,
    team_name: result.athletes.schools.name,
    time_seconds: result.time_seconds,
    race_name: result.races.name,
    race_category: result.races.category,
    race_gender: result.races.gender
  })) || []

  // Group results by gender for separate rankings
  const boyResults = combinedResults.filter(r => r.race_gender === 'M')
  const girlResults = combinedResults.filter(r => r.race_gender === 'F')

  // Reassign places within gender groups
  const boysWithPlaces = boyResults.map((result, index) => ({ ...result, place: index + 1 }))
  const girlsWithPlaces = girlResults.map((result, index) => ({ ...result, place: index + 1 }))

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href={`/meets/${params.meetId}`}
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to Meet
        </Link>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Combined Results - {meet.name}
          </h1>
          <p className="text-gray-600 mb-4">
            {formatMeetDate(meet.meet_date)} • {meet.meet_type} • {meet.courses.name} ({meet.courses.distance_miles} mi)
          </p>
          <p className="text-lg font-medium text-gray-900">
            {combinedResults.length} total finishers across all races
          </p>
        </div>
      </div>
{/* Toggle buttons for gender */}
<div className="mb-6 flex gap-2">
  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium">
    All Results
  </button>
  <a href="#boys-results" className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium">
    Boys ({boysWithPlaces.length})
  </a>
  <a href="#girls-results" className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium">
    Girls ({girlsWithPlaces.length})
  </a>
</div>
      {combinedResults.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl text-gray-600 mb-4">No results found</h2>
          <p className="text-gray-500">This meet doesn't have any timed results yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* All Results */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">All Results</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Place
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Race
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {combinedResults.slice(0, 50).map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {result.place}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {result.athlete_name}
                        </div>
                        {result.athlete_grade && (
                          <div className="text-sm text-gray-500">
                            Grade {result.athlete_grade}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.team_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.race_category} {result.race_gender === 'M' ? 'Boys' : 'Girls'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {formatTime(result.time_seconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {combinedResults.length > 50 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
                Showing top 50 results • {combinedResults.length - 50} more not displayed
              </div>
            )}
          </div>

          {/* Boys Results */}
          <div id="boys-results" className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Boys Results</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Place
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Race
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {boysWithPlaces.slice(0, 25).map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {result.place}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {result.athlete_name}
                        </div>
                        {result.athlete_grade && (
                          <div className="text-sm text-gray-500">
                            Grade {result.athlete_grade}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.team_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.race_category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {formatTime(result.time_seconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Girls Results */}
          <div id="girls-results" className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-pink-50 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Girls Results</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Place
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Race
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {girlsWithPlaces.slice(0, 25).map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {result.place}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {result.athlete_name}
                        </div>
                        {result.athlete_grade && (
                          <div className="text-sm text-gray-500">
                            Grade {result.athlete_grade}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.team_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.race_category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {formatTime(result.time_seconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}