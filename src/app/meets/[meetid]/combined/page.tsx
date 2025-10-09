import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ResultsTable from './ResultsTable'
import { formatMeetDate, formatTime } from '@/lib/utils'
import { getGradeDisplay } from '@/lib/grade-utils'

interface CombinedResult {
  id: string
  place: number
  athlete_id: string
  athlete_name: string
  athlete_grade: string | null
  school_id: string
  team_name: string
  time_seconds: number // In centiseconds
  xc_time: number // In centiseconds
  race_name: string
  race_category: string
  race_gender: string
  overallPlace: number
  scoringPlace: number
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

interface TeamScore {
  schoolId: string
  schoolName: string
  place: number
  totalTime: number // In centiseconds
  teamScore: number // Sum of top 5 scoring places
  runners: {
    athleteId: string
    athleteName: string
    athleteGrade: string | null
    time: number // In centiseconds
    xcTime: number // In centiseconds
    overallPlace: number
    teamPlace: number
    status: 'counting' | 'displacer' | 'non-counting'
    resultId: string
  }[]
}

function calculateXcTimeTeamScores(results: CombinedResult[]): { 
  completeTeams: TeamScore[], 
  incompleteTeams: Array<{
    schoolId: string
    schoolName: string
    totalRunners: number
    runners: {
      athleteId: string
      athleteName: string
      athleteGrade: string | null
      time: number
      xcTime: number
      overallPlace: number
      teamPlace: number
      resultId: string
    }[]
  }>
} {
  const schoolMap = new Map<string, CombinedResult[]>();
  for (const result of results) {
    if (result.school_id) {
      if (!schoolMap.has(result.school_id)) {
        schoolMap.set(result.school_id, []);
      }
      schoolMap.get(result.school_id)!.push(result);
    }
  }

  const completeTeams: TeamScore[] = [];
  const incompleteTeams: Array<{
    schoolId: string
    schoolName: string
    totalRunners: number
    runners: {
      athleteId: string
      athleteName: string
      athleteGrade: string | null
      time: number
      xcTime: number
      overallPlace: number
      teamPlace: number
      resultId: string
    }[]
  }> = [];

  for (const [schoolId, runners] of schoolMap) {
    const sortedRunners = runners.sort((a, b) => a.xc_time - b.xc_time);
    const teamRunners = sortedRunners.map((runner, index): {
      athleteId: string
      athleteName: string
      athleteGrade: string | null
      time: number
      xcTime: number
      overallPlace: number
      teamPlace: number
      status: 'counting' | 'displacer' | 'non-counting'
      resultId: string
    } => ({
      athleteId: runner.athlete_id,
      athleteName: runner.athlete_name,
      athleteGrade: runner.athlete_grade,
      time: runner.time_seconds,
      xcTime: runner.xc_time,
      overallPlace: runner.overallPlace || runner.place,
      teamPlace: index + 1,
      status: index < 5 ? 'counting' : index < 7 ? 'displacer' : 'non-counting',
      resultId: runner.id,
    }));

    if (runners.length < 5) {
      incompleteTeams.push({
        schoolId,
        schoolName: runners[0].team_name,
        totalRunners: runners.length,
        runners: teamRunners,
      });
      continue;
    }

    const totalTime = teamRunners.slice(0, 5).reduce((sum, runner) => sum + runner.xcTime, 0);

    completeTeams.push({
      schoolId,
      schoolName: runners[0].team_name,
      place: 0,
      totalTime,
      teamScore: 0, // Will be set later
      runners: teamRunners,
    });
  }

  // Sort incomplete teams alphabetically
  incompleteTeams.sort((a, b) => a.schoolName.localeCompare(b.schoolName));

  return { completeTeams, incompleteTeams };
}

export default async function CombinedResultsPage({
  params,
}: {
  params: { meetId: string }
}) {
  const supabaseClient = supabase;

  const { data: meet, error: meetError } = await supabaseClient
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
    .single();

  if (meetError || !meet) {
    console.error('Error fetching meet:', meetError);
    notFound();
  }

  const course = Array.isArray(meet.courses) ? meet.courses[0] : meet.courses;
  if (!course?.xc_time_rating) {
    console.error('Missing xc_time_rating for course:', course);
    return <div>Error: Course rating not found</div>;
  }

  const { data: results, error: resultsError } = await supabaseClient
    .from('results')
    .select(`
      id,
      place_overall,
      time_seconds,
      meet_id,
      race_id,
      athletes!inner(
        id,
        first_name,
        last_name,
        graduation_year,
        current_school_id,
        schools(
          id,
          name
        )
      ),
      races!inner(
        id,
        name,
        category,
        gender
      )
    `)
    .eq('meet_id', params.meetId)
    .not('time_seconds', 'is', null)
    .order('time_seconds', { ascending: true });

  if (resultsError || !results) {
    console.error('Error fetching results:', resultsError);
    return <div>Error loading results</div>;
  }

  const combinedResults: CombinedResult[] = results.map((result, index) => {
    const athlete = Array.isArray(result.athletes) ? result.athletes[0] : result.athletes;
    const school = athlete?.schools ? (Array.isArray(athlete.schools) ? athlete.schools[0] : athlete.schools) : null;
    const race = Array.isArray(result.races) ? result.races[0] : result.races;

    const timeInCentiseconds = result.time_seconds * 100;

    return {
      id: result.id,
      place: index + 1,
      athlete_id: athlete.id,
      athlete_name: `${athlete.first_name} ${athlete.last_name}`,
      athlete_grade: getGradeDisplay(athlete.graduation_year, meet.meet_date),
      school_id: school?.id || '',
      team_name: school?.name || 'Unknown School',
      time_seconds: timeInCentiseconds,
      xc_time: timeInCentiseconds * course.xc_time_rating,
      race_name: race.name,
      race_category: race.category,
      race_gender: race.gender,
      overallPlace: 0, // Default value, will be updated later
      scoringPlace: 0, // Default value, will be updated later
    };
  });

  const boyResults = combinedResults.filter(r => r.race_gender === 'M');
  const girlResults = combinedResults.filter(r => r.race_gender === 'F');

const { completeTeams: boysTeamScores, incompleteTeams: boysIncompleteTeams } = calculateXcTimeTeamScores(boyResults);
  const { completeTeams: girlsTeamScores, incompleteTeams: girlsIncompleteTeams } = calculateXcTimeTeamScores(girlResults);

  // Prepare qualifying athlete IDs for displacement (top 7 per team, separated by gender)
  const boysQualifyingAthleteIds = new Set<string>();
  boysTeamScores.forEach(team => {
    team.runners.slice(0, 7).forEach(runner => boysQualifyingAthleteIds.add(runner.athleteId));
  });

  const girlsQualifyingAthleteIds = new Set<string>();
  girlsTeamScores.forEach(team => {
    team.runners.slice(0, 7).forEach(runner => girlsQualifyingAthleteIds.add(runner.athleteId));
  });

  // Sort and assign scoring places separately for boys and girls
  const boysSortedResults = [...boyResults].sort((a, b) => a.xc_time - b.xc_time).map((r, i) => ({
    ...r,
    overallPlace: i + 1,
    scoringPlace: boysQualifyingAthleteIds.has(r.athlete_id) ? i + 1 : 0,
  }));

  const girlsSortedResults = [...girlResults].sort((a, b) => a.xc_time - b.xc_time).map((r, i) => ({
    ...r,
    overallPlace: i + 1,
    scoringPlace: girlsQualifyingAthleteIds.has(r.athlete_id) ? i + 1 : 0,
  }));

  // Update team scores with sum of scoring places for top 5, separated by gender
  const updateTeamScores = (teamScores: TeamScore[], sortedResults: CombinedResult[]) => {
    teamScores.forEach(team => {
      const top5Runners = team.runners.slice(0, 5);
      team.teamScore = top5Runners.reduce((sum, runner) => {
        const sortedRunner = sortedResults.find(r => r.athlete_id === runner.athleteId);
        return sum + (sortedRunner ? sortedRunner.scoringPlace : 0);
      }, 0);
    });
    teamScores.sort((a, b) => a.teamScore - b.teamScore);
    teamScores.forEach((team, index) => {
      team.place = index + 1;
    });
  };

  updateTeamScores(boysTeamScores, boysSortedResults);
  updateTeamScores(girlsTeamScores, girlsSortedResults);

  // Combine results for display, keeping overall place but using gender-specific scoring
  const allSortedResults = [...boysSortedResults, ...girlsSortedResults].sort((a, b) => a.xc_time - b.xc_time).map((r, i) => ({
    ...r,
    overallPlace: i + 1,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
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
          <p className="text-lg font-medium text-gray-900">
            {combinedResults.length} total finishers • {boysTeamScores.length} boys teams • {girlsTeamScores.length} girls teams
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <div id="boys-team" className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Boys Team Scores</h2>
          </div>
          <div className="p-6">
            {boysTeamScores.length === 0 ? (
              <p className="text-gray-600">No boys teams with sufficient runners</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team Place</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team Score</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {boysTeamScores.map((team) => (
                      <tr key={team.schoolId}>
                        <td className="px-4 py-2 whitespace-nowrap font-medium">{team.place}</td>
                        <td className="px-4 py-2">{team.schoolName}</td>
                        <td className="px-4 py-2 whitespace-nowrap font-medium">{team.teamScore}</td>
                        <td className="px-4 py-2 font-mono">{formatTime(team.totalTime / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        {boysIncompleteTeams.length > 0 && (
          <div id="boys-incomplete" className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Incomplete Boys Teams</h2>
              <p className="text-sm text-gray-600 mt-1">
                Teams with fewer than 5 finishers (not eligible for team scoring)
              </p>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Finishers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {boysIncompleteTeams.map((team) => (
                      <tr key={team.schoolId} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div className="font-medium">{team.schoolName}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {team.totalRunners} {team.totalRunners === 1 ? 'runner' : 'runners'}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="space-x-1">
                            {team.runners.map((runner) => (
                              <span key={runner.resultId} className="inline-block">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                  #{runner.teamPlace}: {runner.overallPlace}
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
          </div>
)}

        <div id="girls-team" className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-pink-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Girls Team Scores</h2>
          </div>
          <div className="p-6">
            {girlsTeamScores.length === 0 ? (
              <p className="text-gray-600">No girls teams with sufficient runners</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team Place</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team Score</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {girlsTeamScores.map((team) => (
                      <tr key={team.schoolId}>
                        <td className="px-4 py-2 whitespace-nowrap font-medium">{team.place}</td>
                        <td className="px-4 py-2">{team.schoolName}</td>
                        <td className="px-4 py-2 whitespace-nowrap font-medium">{team.teamScore}</td>
                        <td className="px-4 py-2 font-mono">{formatTime(team.totalTime / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {girlsIncompleteTeams.length > 0 && (
          <div id="girls-incomplete" className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Incomplete Girls Teams</h2>
              <p className="text-sm text-gray-600 mt-1">
                Teams with fewer than 5 finishers (not eligible for team scoring)
              </p>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Finishers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {girlsIncompleteTeams.map((team) => (
                      <tr key={team.schoolId} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div className="font-medium">{team.schoolName}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {team.totalRunners} {team.totalRunners === 1 ? 'runner' : 'runners'}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="space-x-1">
                            {team.runners.map((runner) => (
                              <span key={runner.resultId} className="inline-block">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                  #{runner.teamPlace}: {runner.overallPlace}
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
          </div>
        )}

        <ResultsTable boysResults={boysSortedResults} girlsResults={girlsSortedResults} boysTeamScores={boysTeamScores} girlsTeamScores={girlsTeamScores} />

      </div>
    </div>
  );
}