import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { formatMeetDate, formatTime } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { getGradeDisplay } from '@/lib/grade-utils'
import { calculateXcTimeTeamScores } from '@/lib/teamScoring'

interface CombinedResult {
  id: string
  place: number
  athlete_id: string
  athlete_name: string
  athlete_grade: string | null
  school_id: string
  team_name: string
  school_name: string  // ADD THIS LINE
  time_seconds: number
  xc_time: number
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
    id: string
    name: string
    distance_meters: number
    xc_time_rating: number
  }[]
}

export default async function CombinedResultsPage({
  params
}: {
  params: { meetId: string }
}) {
  const supabase = createServerComponentClient({ cookies })
  
  // Get meet details with course XC Time rating
  const { data: meet, error: meetError } = await supabase
    .from('meets')
    .select(`
      id, 
      name, 
      meet_date, 
      meet_type,
      courses(
        id,
        name,
        distance_meters,
        xc_time_rating
      )
    `)
    .eq('id', params.meetId)
    .single()

  if (meetError || !meet) {
    notFound()
  }

  const course = Array.isArray(meet.courses) ? meet.courses[0] : meet.courses

// Get all results with school info
const { data: results, error: resultsError } = await supabase
  .from('results')
  .select(`
    id,
    place_overall,
    time_seconds,
    athletes!inner(
      id,
      first_name,
      last_name,
      graduation_year,
      school_id,
      schools(
        id,
        name
      )
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

  // Calculate XC Time for each result
  const combinedResults: CombinedResult[] = results?.map((result, index) => {
    const athlete = Array.isArray(result.athletes) ? result.athletes[0] : result.athletes
    const school = athlete?.schools ? (Array.isArray(athlete.schools) ? athlete.schools[0] : athlete.schools) : null
    const race = Array.isArray(result.races) ? result.races[0] : result.races

return {
  id: result.id,
  place: index + 1,
  athlete_id: athlete.id,
  athlete_name: `${athlete.first_name} ${athlete.last_name}`,
  athlete_grade: getGradeDisplay(athlete.graduation_year, meet.meet_date),
  school_id: school?.id || '',
  team_name: school?.name || 'Unknown School',
  school_name: school?.name || 'Unknown School',  // ADD THIS LINE
  time_seconds: result.time_seconds,
  xc_time: result.time_seconds * (course?.xc_time_rating || 1),
  race_name: race.name,
  race_category: race.category,
  race_gender: race.gender
}
  }) || []

  // Separate by gender
  const boyResults = combinedResults.filter(r => r.race_gender === 'M')
  const girlResults = combinedResults.filter(r => r.race_gender === 'F')

  // Calculate team scores for each gender
  const boysTeamScores = calculateXcTimeTeamScores(boyResults)
  const girlsTeamScores = calculateXcTimeTeamScores(girlResults)

  // Re-sort individual results by XC Time and assign places
  const boysSorted = [...boyResults].sort((a, b) => a.xc_time - b.xc_time)
    .map((r, i) => ({ ...r, place: i + 1 }))
  const girlsSorted = [...girlResults].sort((a, b) => a.xc_time - b.xc_time)
    .map((r, i) => ({ ...r, place: i + 1 }))

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
            {formatMeetDate(meet.meet_date)} • {meet.meet_type} • {course?.name} ({((course?.distance_meters || 0) / 1609.34).toFixed(2)} mi)
          </p>
          <p className="text-sm text-gray-600 mb-2">
            XC Time Rating: {course?.xc_time_rating?.toFixed(3) || 'N/A'}
          </p>
          <p className="text-lg font-medium text-gray-900">
            {combinedResults.length} total finishers • {boysTeamScores.length} boys teams • {girlsTeamScores.length} girls teams
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <a href="#boys-team" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
          Boys Team Scores
        </a>
        <a href="#girls-team" className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg font-medium">
          Girls Team Scores
        </a>
        <a href="#boys-individual" className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium">
          Boys Individual
        </a>
        <a href="#girls-individual" className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium">
          Girls Individual
        </a>
      </div>

      <div className="space-y-8">
        {/* Boys Team Scores */}
        <div id="boys-team" className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Boys Team Scores (XC Time)</h2>
          </div>
          <div className="p-6 space-y-6">
            {boysTeamScores.map((team) => (
              <div key={team.schoolId} className="border-b pb-4 last:border-b-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {team.place}. {team.schoolName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Total XC Time: {team.totalTime.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Place</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">XC Time</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {team.runners.map((runner) => (
                        <tr key={runner.athleteId} className={
                          runner.status === 'counting' ? 'bg-green-50' :
                          runner.status === 'displacer' ? 'bg-yellow-50' : ''
                        }>
                          <td className="px-3 py-2 whitespace-nowrap font-medium">{runner.overallPlace}</td>
                          <td className="px-3 py-2">
                            {runner.athleteName}
                            {runner.athleteGrade && <span className="text-gray-500 ml-1">({runner.athleteGrade})</span>}
                          </td>
                          <td className="px-3 py-2 font-mono">{formatTime(runner.time)}</td>
                          <td className="px-3 py-2 font-mono">{runner.xcTime?.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              runner.status === 'counting' ? 'bg-green-100 text-green-800' :
                              runner.status === 'displacer' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {runner.status === 'counting' ? `Scorer #${runner.teamPlace}` :
                               runner.status === 'displacer' ? `Displacer #${runner.teamPlace}` :
                               `Non-scoring #${runner.teamPlace}`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Girls Team Scores */}
        <div id="girls-team" className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-pink-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Girls Team Scores (XC Time)</h2>
          </div>
          <div className="p-6 space-y-6">
            {girlsTeamScores.map((team) => (
              <div key={team.schoolId} className="border-b pb-4 last:border-b-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {team.place}. {team.schoolName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Total XC Time: {team.totalTime.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Place</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">XC Time</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {team.runners.map((runner) => (
                        <tr key={runner.athleteId} className={
                          runner.status === 'counting' ? 'bg-green-50' :
                          runner.status === 'displacer' ? 'bg-yellow-50' : ''
                        }>
                          <td className="px-3 py-2 whitespace-nowrap font-medium">{runner.overallPlace}</td>
                          <td className="px-3 py-2">
                            {runner.athleteName}
                            {runner.athleteGrade && <span className="text-gray-500 ml-1">({runner.athleteGrade})</span>}
                          </td>
                          <td className="px-3 py-2 font-mono">{formatTime(runner.time)}</td>
                          <td className="px-3 py-2 font-mono">{runner.xcTime?.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              runner.status === 'counting' ? 'bg-green-100 text-green-800' :
                              runner.status === 'displacer' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {runner.status === 'counting' ? `Scorer #${runner.teamPlace}` :
                               runner.status === 'displacer' ? `Displacer #${runner.teamPlace}` :
                               `Non-scoring #${runner.teamPlace}`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Boys Individual Results */}
        <div id="boys-individual" className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Boys Individual Results</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Place</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">XC Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {boysSorted.slice(0, 50).map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{result.place}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{result.athlete_name}</div>
                      {result.athlete_grade && <div className="text-sm text-gray-500">Grade {result.athlete_grade}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.team_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{formatTime(result.time_seconds)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{result.xc_time.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Girls Individual Results */}
        <div id="girls-individual" className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-pink-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Girls Individual Results</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Place</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">XC Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {girlsSorted.slice(0, 50).map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{result.place}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{result.athlete_name}</div>
                      {result.athlete_grade && <div className="text-sm text-gray-500">Grade {result.athlete_grade}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.team_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{formatTime(result.time_seconds)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{result.xc_time.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}