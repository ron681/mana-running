export interface TeamRunner {
  athleteId: string;
  athleteName: string;
  athleteGrade: string | null;
  time: number;
  xcTime?: number;
  overallPlace: number;
  teamPlace: number;
  status: 'counting' | 'displacer' | 'non-scoring';
}

export interface TeamScore {
  schoolId: string;
  schoolName: string;
  score: number;
  totalTime: number;
  runners: TeamRunner[];
  place: number;
}

export function calculateXcTimeTeamScores(
  results: Array<{
    id: string;
    athlete_id: string;
    athlete_name: string;
    athlete_grade: string | null;
    school_id: string;
    school_name: string;
    time_seconds: number;
    xc_time: number;
  }>
): TeamScore[] {
  // Sort by XC Time
  const sorted = [...results].sort((a, b) => a.xc_time - b.xc_time);

  // Group by school
  const schoolGroups = new Map<string, typeof sorted>();
  sorted.forEach(result => {
    if (!schoolGroups.has(result.school_id)) {
      schoolGroups.set(result.school_id, []);
    }
    schoolGroups.get(result.school_id)!.push(result);
  });

  // Calculate scores
  const teamScores: TeamScore[] = [];

  schoolGroups.forEach((schoolResults, schoolId) => {
    if (schoolResults.length < 5) return; // Need at least 5 runners

    const runners: TeamRunner[] = schoolResults.map((result, teamIndex) => {
      let status: 'counting' | 'displacer' | 'non-scoring';
      if (teamIndex < 5) status = 'counting';
      else if (teamIndex < 7) status = 'displacer';
      else status = 'non-scoring';

      return {
        athleteId: result.id,
        athleteName: result.athlete_name,
        athleteGrade: result.athlete_grade,
        time: result.time_seconds,
        xcTime: result.xc_time,
        overallPlace: sorted.indexOf(result) + 1,
        teamPlace: teamIndex + 1,
        status
      };
    });

    // Sum XC Times of top 5
    const totalTime = runners
      .filter(r => r.status === 'counting')
      .reduce((sum, r) => sum + (r.xcTime || 0), 0);

    teamScores.push({
      schoolId,
      schoolName: schoolResults[0].school_name,
      score: totalTime,
      totalTime,
      runners,
      place: 0 // Will be assigned after sorting
    });
  });

  // Sort by score and assign places
  return teamScores
    .sort((a, b) => a.score - b.score)
    .map((team, index) => ({ ...team, place: index + 1 }));
}