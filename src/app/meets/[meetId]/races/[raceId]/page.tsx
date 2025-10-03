// app/meets/[meetId]/races/[raceId]/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatMeetDate, formatTime } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { getGradeDisplay } from '@/lib/grade-utils'
import React from 'react'
import { DeleteRaceActions, DeleteResultButton } from '@/components/race-delete-buttons'
import { isAdmin } from '@/lib/auth/admin'

interface RaceResult {
  id: string
  place: number
  athlete_id: string
  athlete_name: string
  athlete_grade: string | null
  team_name: string
  time_seconds: number | null
}

interface Race {
  id: string
  name: string
  category: string
  gender: string
  total_participants: number
  meets: {
    id: string
    name: string
    meet_date: string
    meet_type: string
    courses: {
      name: string
      distance_miles: number
    }[]
  }[]
}

export default async function RaceResultsPage({
  params
}: {
  params: { meetId: string; raceId: string }
}) {
const supabase = await createClient()
const admin = await isAdmin(supabase)

  // Get race details with meet info
  const { data: race, error: raceError } = await supabase
    .from('races')
    .select(`
      id,
      name,
      category,
      gender,
      total_participants,
      meets!inner(
        id,
        name,
        meet_date,
        meet_type,
        courses!inner(
          name,
          distance_miles
        )
      )
    `)
    .eq('id', params.raceId)
    .eq('meet_id', params.meetId)
    .single()

  if (raceError || !race) {
    notFound()
  }
const meet = Array.isArray(race.meets) ? race.meets[0] : race.meets;
const course = meet?.courses ? (Array.isArray(meet.courses) ? meet.courses[0] : meet.courses) : null;

  // Get all results for this race
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
        schools!inner(name)
      )
    `)
    .eq('race_id', params.raceId)
    .order('place_overall', { ascending: true })

  if (resultsError) {
    console.error('Error fetching results:', resultsError)
    return <div>Error loading results</div>
  }

// Transform results to match expected format
const raceResults: RaceResult[] = results?.map((result) => {
  // Safe array access helpers
  const athlete = Array.isArray(result.athletes) ? result.athletes[0] : result.athletes;
  const school = athlete?.schools ? (Array.isArray(athlete.schools) ? athlete.schools[0] : athlete.schools) : null;
  
  
  return {
    id: result.id,
    place: result.place_overall,
    athlete_id: athlete?.id,
    athlete_name: `${athlete?.first_name} ${athlete?.last_name}`,
    athlete_grade: getGradeDisplay(athlete?.graduation_year, meet?.meet_date),
    team_name: school?.name || 'Unknown School',
    time_seconds: result.time_seconds
  }
}) || []

  // Separate timed and non-timed results
  const timedResults = raceResults.filter(r => r.time_seconds !== null)
  const untimedResults = raceResults.filter(r => r.time_seconds === null)
  
  // Calculate some stats for timed results
  const times = timedResults.map(r => r.time_seconds!).filter(Boolean)
  const fastestTime = times.length > 0 ? Math.min(...times) : null
  const averageTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null

  // Group results by team for team standings
  const teamResults = timedResults.reduce((acc, result) => {
    if (!acc[result.team_name]) {
      acc[result.team_name] = []
    }
    acc[result.team_name].push(result)
    
    return acc
  }, {} as Record<string, RaceResult[]>)

// Calculate team scores with proper displacing logic
const teamStandings = Object.entries(teamResults)
  .map(([teamName, runners]) => {
    // Determine runner status
    const runnersWithStatus = runners.map((runner, index) => {
      let status: 'counting' | 'displacer' | 'non-scoring';
      if (index < 5) status = 'counting';
      else if (index < 7) status = 'displacer';
      else status = 'non-scoring';
      
      return { ...runner, status, teamPlace: index + 1 };
    });

    const countingRunners = runnersWithStatus.filter(r => r.status === 'counting');
    const displacers = runnersWithStatus.filter(r => r.status === 'displacer');
    
    const score = countingRunners.reduce((sum, runner) => sum + runner.place, 0);
    
    return {
      teamName,
      score,
      countingRunners,
      displacers,
      nonScoring: runnersWithStatus.filter(r => r.status === 'non-scoring'),
      totalRunners: runners.length
    };
  })
  .filter(team => team.countingRunners.length >= 5)
  .sort((a, b) => a.score - b.score);

  

  
      
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
  <div className="flex justify-between items-center mb-4">
    <h1 className="text-3xl font-bold text-gray-900">
      {race.category} {race.gender === 'M' ? 'Boys' : 'Girls'}
    </h1>
    {admin && <DeleteRaceActions raceId={params.raceId} meetId={params.meetId} />}
  </div>
            
          <div className="grid md:grid-cols-2 gap-4 text-gray-600 mb-4">
            <div>
              <p className="mb-2"><strong>Meet:</strong> {meet?.name}</p>
              <p className="mb-2"><strong>Date:</strong> {formatMeetDate(meet?.meet_date)}</p>
              <p className="mb-2"><strong>Type:</strong> {meet?.meet_type}</p>            
              </div>
            <div>
              <p className="mb-2"><strong>Course:</strong> {course?.name}</p>
              <p className="mb-2"><strong>Distance:</strong> {course?.distance_miles} miles</p>
              <p className="mb-2"><strong>Participants:</strong> {race.total_participants}</p>
            </div>
          </div>
          
          {/* Race Stats */}
          {fastestTime && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{formatTime(fastestTime)}</p>
                <p className="text-sm text-gray-500">Winning Time</p>
              </div>
              {averageTime && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{formatTime(averageTime)}</p>
                  <p className="text-sm text-gray-500">Average Time</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{timedResults.length}</p>
                <p className="text-sm text-gray-500">Finishers</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button className="border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
              Individual Results
            </button>
            {teamStandings.length > 0 && (
              <a 
                href="#team-standings"
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                Team Standings
              </a>
            )}
          </nav>
        </div>
      </div>

      {raceResults.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl text-gray-600 mb-4">No results found</h2>
          <p className="text-gray-500">This race doesn't have any results yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Individual Results */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Individual Results</h2>
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
  Time
</th>
{admin && (
  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
    Actions
  </th>
)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {timedResults.map((result, index) => (
                    <tr key={result.id} className={`hover:bg-gray-50 ${index < 3 ? 'bg-yellow-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${index === 0 ? 'text-yellow-600' : index === 1 ? 'text-gray-600' : index === 2 ? 'text-orange-600' : 'text-gray-900'}`}>
                            {result.place}
                          </span>
                          {index < 3 && (
                            <span className="ml-2 text-lg">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
  <Link 
    href={`/athletes/${result.athlete_id}`}
    className="text-blue-600 hover:text-blue-800 hover:underline"
  >
    {result.athlete_name}
  </Link>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
  {result.time_seconds ? formatTime(result.time_seconds) : 'DNF'}
</td>
{admin && (
  <td className="px-6 py-4 whitespace-nowrap text-right">
    <DeleteResultButton resultId={result.id} raceId={params.raceId} />
  </td>
)}
                    </tr>
                  ))}
                  
                  {/* Non-timed results (DNF, DNS, etc.) */}
                  {untimedResults.map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50 bg-gray-25">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {result.place || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
  <Link 
    href={`/athletes/${result.athlete_id}`}
    className="text-blue-600 hover:text-blue-800 hover:underline"
  >
    {result.athlete_name}
  </Link>
</div>
                        {result.athlete_grade && (
                          <div className="text-sm text-gray-400">
                            Grade {result.athlete_grade}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {result.team_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        DNF
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Team Standings */}
          {teamStandings.length > 0 && (
            <div id="team-standings" className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Team Standings</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Based on sum of top 5 finishers per team
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Team
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Scoring Runners
                      </th>
                    </tr>
                  </thead>
<tbody className="bg-white divide-y divide-gray-200">
  {teamStandings.map((team, index) => (
    <React.Fragment key={team.teamName}>
      <tr className={`hover:bg-gray-50 ${index < 3 ? 'bg-blue-50' : ''}`}>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <span className={`text-sm font-medium ${index === 0 ? 'text-yellow-600' : index === 1 ? 'text-gray-600' : index === 2 ? 'text-orange-600' : 'text-gray-900'}`}>
              {index + 1}
            </span>
            {index < 3 && (
              <span className="ml-2 text-lg">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-sm font-medium text-gray-900">
          <div>{team.teamName}</div>
          <div className="text-xs text-gray-500 mt-1">
            {team.totalRunners} total runners
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <span className="font-bold">{team.score}</span>
        </td>
        <td className="px-6 py-4">
          <div className="space-y-2">
            {/* Counting runners (1-5) */}
            <div>
              <span className="text-xs font-medium text-green-700">Scorers (1-5):</span>
              <div className="space-x-1 mt-1">
                {team.countingRunners.map((runner, i) => (
                  <span key={runner.id} className="inline-block">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                      #{runner.teamPlace}: {runner.place}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            
            {/* Displacers (6-7) */}
            {team.displacers.length > 0 && (
              <div>
                <span className="text-xs font-medium text-yellow-700">Displacers (6-7):</span>
                <div className="space-x-1 mt-1">
                  {team.displacers.map((runner) => (
                    <span key={runner.id} className="inline-block">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        #{runner.teamPlace}: {runner.place}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Non-scoring (8+) */}
            {team.nonScoring.length > 0 && (
              <div>
                <span className="text-xs font-medium text-gray-600">Non-scoring (8+):</span>
                <div className="space-x-1 mt-1">
                  {team.nonScoring.map((runner) => (
                    <span key={runner.id} className="inline-block">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        #{runner.teamPlace}: {runner.place}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
    </React.Fragment>
  ))}
</tbody>

                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}