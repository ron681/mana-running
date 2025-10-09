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

  // Get meet basic info (no course - that's in races now)
  const { data: meet, error: meetError } = await supabaseClient
    .from('meets')
    .select('id, name, meet_date, meet_type')
    .eq('id', params.meetId)
    .single();

  if (meetError || !meet) {
    console.error('Error fetching meet:', meetError);
    notFound();
  }

  // Get course info from races (pick first race's course for XC time rating)
  const { data: racesWithCourse, error: raceError } = await supabaseClient
    .from('races')
    .select(`
      course:courses(
        id,
        name,
        distance_meters,
        xc_time_rating
      )
    `)
    .eq('meet_id', params.meetId)
    .limit(1)
    .single();

  if (raceError || !racesWithCourse) {
    console.error('Error fetching race course:', raceError);
    return <div>Error: No races found for this meet</div>;
  }

  const course = Array.isArray(racesWithCourse.course) 
    ? racesWithCourse.course[0] 
    : racesWithCourse.course;

  if (!course?.xc_time_rating) {
    console.error('Missing xc_time_rating for course:', course);
    return <div>Error: Course rating not found</div>;
  }

  // Get all results for this meet
  const { data: results, error: resultsError } = await supabaseClient
    .from('results')
    .select(`
      id,
      place_overall,
      time_seconds,
      race_id,
      athlete:athletes!inner(
        id,
        first_name,
        last_name,
        graduation_year,
        current_school_id,
        school:schools(
          id,
          name
        )
      ),
      race:races!inner(
        id,
        name,
        category,
        gender
      )
    `)
    .eq('race_id', 'race.meet_id', params.meetId)
    .not('time_seconds', 'is', null)
    .order('time_seconds', { ascending: true });

  // Alternative query if the above doesn't work - get all races first then filter
  let finalResults = results;
  if (resultsError || !results) {
    // Fallback: get races for this meet, then get results
    const { data: races } = await supabaseClient
      .from('races')
      .select('id')
      .eq('meet_id', params.meetId);
    
    if (races && races.length > 0) {
      const raceIds = races.map(r => r.id);
      const { data: resultsData, error: resultsErr } = await supabaseClient
        .from('results')
        .select(`
          id,
          place_overall,
          time_seconds,
          race_id,
          athlete:athletes!inner(
            id,
            first_name,
            last_name,
            graduation_year,
            current_school_id,
            school:schools(
              id,
              name
            )
          ),
          race:races!inner(
            id,
            name,
            category,
            gender
          )
        `)
        .in('race_id', raceIds)
        .not('time_seconds', 'is', null)
        .order('time_seconds', { ascending: true });
      
      if (resultsErr) {
        console.error('Error fetching results:', resultsErr);
        return <div>Error loading results</div>;
      }
      finalResults = resultsData;
    }
  }

  if (!finalResults || finalResults.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href={`/meets/${params.meetId}`} className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Meet
        </Link>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Combined Results - {meet.name}</h1>
          <p className="text-gray-600">No results found for this meet.</p>
        </div>
      </div>
    );
  }

  const combinedResults: CombinedResult[] = finalResults.map((result, index) => {
    const athlete = Array.isArray(result.athlete) ? result.athlete[0] : result.athlete;
    const school = athlete?.school ? (Array.isArray(athlete.school) ? athlete.school[0] : athlete.school) : null;
    const race = Array.isArray(result.race) ? result.race[0] : result.race;

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

        {/* XC Time Conversion Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                📊 XC Time Conversion Applied
              </h3>
              <p className="text-blue-800 text-sm leading-relaxed">
                All race times for this meet have been converted to <strong>XC Time</strong> to enable fair comparison of team performances across the day. 
                This conversion accounts for differences in course difficulty, allowing teams who raced on different courses to be compared accurately. 
                Team scores and placements shown below are based on these normalized XC times.
              </p>
            </div>
          </div>
        </div>

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