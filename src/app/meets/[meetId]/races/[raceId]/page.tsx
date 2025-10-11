// app/meets/[meetId]/races/[raceId]/page.tsx
import { createServerComponentClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatMeetDate, formatTime } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { getGradeDisplay } from '@/lib/grade-utils'
import React from 'react'
import { DeleteRaceActions } from '@/components/race-delete-buttons'
import { isAdmin } from '@/lib/auth/admin'
import IndividualResultsTable from '@/components/IndividualResultsTable'

interface RaceResult {
  id: string
  place: number
  athlete_id: string
  athlete_name: string
  athlete_grade: string | null
  team_name: string
  school_id: string
  time_seconds: number | null
  scoringPlace: number | null
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
  }
  courses: {
    name: string
    distance_miles: number
  } | null
}

export default async function RaceResultsPage({
  params
}: {
  params: { meetId: string; raceId: string }
}) {
const supabase = await createServerComponentClient()
const admin = await isAdmin(supabase)

  // Get race details with meet info AND course info (course_id is in races now)
  const { data: race, error: raceError } = await supabase
    .from('races')
    .select(`
      id,
      name,
      category,
      gender,
      total_participants,
      meet:meets!inner(
        id,
        name,
        meet_date,
        meet_type
      ),
      course:courses(
        name,
        distance_miles
      )
    `)
    .eq('id', params.raceId)
    .eq('meet_id', params.meetId)
    .single()

  if (raceError || !race) {
    console.error('Race error:', raceError)
    notFound()
  }

  const meet = Array.isArray(race.meet) ? race.meet[0] : race.meet
  const course = Array.isArray(race.course) ? race.course[0] : race.course

  // Get all results for this race
  const { data: results, error: resultsError } = await supabase
    .from('results')
    .select(`
      id,
      place_overall,
      time_seconds,
      athlete:athletes!inner(
        id,
        first_name,
        last_name,
        graduation_year,
        current_school_id,
        school:schools!inner(
          id,
          name
        )
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
  const athlete = Array.isArray(result.athlete) ? result.athlete[0] : result.athlete
  const school = athlete?.school ? (Array.isArray(athlete.school) ? athlete.school[0] : athlete.school) : null
  
  return {
    id: result.id,
    place: result.place_overall,
    athlete_id: athlete?.id,
    athlete_name: `${athlete?.first_name} ${athlete?.last_name}`,
    athlete_grade: getGradeDisplay(athlete?.graduation_year, meet?.meet_date),
    team_name: school?.name || 'Unknown School',
    school_id: school?.id || '',
    time_seconds: result.time_seconds,
    scoringPlace: null  // Will be calculated below
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
    if (!acc[result.school_id]) {
      acc[result.school_id] = []
    }
    acc[result.school_id].push(result)
    
    return acc
  }, {} as Record<string, RaceResult[]>)

// Calculate team scores with proper displacing logic
const allTeamStandings = Object.entries(teamResults)
  .map(([schoolId, runners]) => {
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
      schoolId,
      teamName: runners[0].team_name,
      score,
      countingRunners,
      displacers,
      nonScoring: runnersWithStatus.filter(r => r.status === 'non-scoring'),
      totalRunners: runners.length,
      allRunners: runnersWithStatus
    };
  });

// Separate complete and incomplete teams
const teamStandings = allTeamStandings
  .filter(team => team.countingRunners.length >= 5)
  .sort((a, b) => a.score - b.score);

const incompleteTeams = allTeamStandings
  .filter(team => team.countingRunners.length < 5)
  .sort((a, b) => a.teamName.localeCompare(b.teamName));

  
// Get qualifying athlete IDs (top 7 from complete teams) for displacement
const qualifyingAthleteIds = new Set<string>();
teamStandings.forEach(team => {
  team.countingRunners.forEach(runner => qualifyingAthleteIds.add(runner.athlete_id));
  team.displacers.forEach(runner => qualifyingAthleteIds.add(runner.athlete_id));
});

// Assign scoring places AFTER displacement (only to qualifying athletes)
let scoringPlace = 1;
const timedResultsWithScoring = timedResults.map(result => {
  if (qualifyingAthleteIds.has(result.athlete_id)) {
    result.scoringPlace = scoringPlace++;
  } else {
    result.scoringPlace = null; // Non-scoring (incomplete team or 8+)
  }
  return result;
});

// Calculate team scores using scoring places (not overall places)
teamStandings.forEach(team => {
  team.score = team.countingRunners.reduce((sum, runner) => {
    const resultWithScoring = timedResultsWithScoring.find(r => r.athlete_id === runner.athlete_id);
    return sum + (resultWithScoring?.scoringPlace || 0);
  }, 0);
});

// Sort team standings by score
teamStandings.sort((a, b) => a.score - b.score);

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
              {course ? (
                <>
                  <p className="mb-2"><strong>Course:</strong> {course.name}</p>
                  <p className="mb-2"><strong>Distance:</strong> {course.distance_miles} miles</p>
                </>
              ) : (
                <p className="mb-2 text-gray-400">No course assigned</p>
              )}
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
          {/* Individual Results - Client Component */}
          <IndividualResultsTable 
            timedResults={timedResultsWithScoring}
            untimedResults={untimedResults}
            raceId={params.raceId}
            isAdmin={admin}
          />

          {/* Team Standings */}
          {teamStandings.length > 0 && (
            <div id="team-standings" className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Team Standings</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Based on sum of top 5 finishers per team (after displacement)
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
    <React.Fragment key={team.schoolId}>
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
                {team.countingRunners.map((runner, i) => {
                  const resultWithScoring = timedResultsWithScoring.find(r => r.athlete_id === runner.athlete_id);
                  return (
                    <span key={runner.id} className="inline-block">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                        #{runner.teamPlace}: {resultWithScoring?.scoringPlace || '-'}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
            
            {/* Displacers (6-7) */}
            {team.displacers.length > 0 && (
              <div>
                <span className="text-xs font-medium text-yellow-700">Displacers (6-7):</span>
                <div className="space-x-1 mt-1">
                  {team.displacers.map((runner) => {
                    const resultWithScoring = timedResultsWithScoring.find(r => r.athlete_id === runner.athlete_id);
                    return (
                      <span key={runner.id} className="inline-block">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          #{runner.teamPlace}: {resultWithScoring?.scoringPlace || '-'}
                        </span>
                      </span>
                    );
                  })}
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

          {/* Incomplete Teams */}
          {incompleteTeams.length > 0 && (
            <div id="incomplete-teams" className="bg-white rounded-lg shadow-md overflow-hidden mt-6">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Incomplete Teams</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Teams with fewer than 5 finishers (not eligible for team scoring)
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Team
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Finishers
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incompleteTeams.map((team) => (
                      <tr key={team.teamName} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          <div>{team.teamName}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {team.totalRunners} {team.totalRunners === 1 ? 'runner' : 'runners'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-x-1">
                            {team.allRunners.map((runner) => (
                              <span key={runner.id} className="inline-block">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                  #{runner.teamPlace}: {runner.place}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
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