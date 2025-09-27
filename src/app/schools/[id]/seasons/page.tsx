// src/app/schools/[id]/seasons/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { schoolCRUD } from '@/lib/crud-operations';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

interface SchoolSeasonsPageProps {
  params: { id: string };
}

interface SeasonData {
  academic_year: number;
  season_name: string;
  boys_stats: TeamSeasonStats;
  girls_stats: TeamSeasonStats;
  top_boys: AthleteSeasonResult[];
  top_girls: AthleteSeasonResult[];
  meets_count: number;
  races_count: number;
  team_performances: TeamPerformance[];
  season_best_team: {
    boys: TeamScore | null;
    girls: TeamScore | null;
  };
}

interface TeamSeasonStats {
  total_athletes: number;
  avg_xc_time: number | null;
  best_xc_time: number | null;
  meets_participated: number;
  varsity_avg: number | null;
  jv_avg: number | null;
}

interface AthleteSeasonResult {
  athlete_id: number;
  athlete_name: string;
  grade: number;
  best_xc_time: number;
  best_actual_time: number;
  best_course: string;
  best_meet: string;
  best_date: string;
  total_races: number;
  avg_xc_time: number;
}

interface TeamPerformance {
  meet_name: string;
  meet_date: string;
  boys_team: TeamScore | null;
  girls_team: TeamScore | null;
}

interface TeamScore {
  total_xc_time: number;
  athletes: {
    name: string;
    xc_time: number;
    actual_time: number;
    place: number;
  }[];
}

async function getSchoolData(schoolId: string) {
  const schools = await schoolCRUD.getAll();
  const school = schools?.find(s => s.id === schoolId);
  
  if (!school) {
    return null;
  }

  return school;
}

async function getSchoolSeasons(schoolId: string): Promise<SeasonData[]> {
  console.log('Looking for school_id:', schoolId);
  
  const { data: seasonsData, error } = await supabase
    .from('results_with_details')
    .select(`
      race_gender,
      graduation_year,
      athlete_id,
      athlete_name,
      time_seconds,
      xc_time_rating,
      course_name,
      meet_name,
      meet_date,
      race_category
    `)
    .eq('school_id', schoolId)
    .order('meet_date', { ascending: false });

  if (error || !seasonsData) {
    console.error('Error fetching seasons data:', error);
    return [];
  }

  console.log('Found results:', seasonsData.length);

  // Add academic year calculation to each result
  const resultsWithAcademicYear = seasonsData.map(result => {
    const meetDate = new Date(result.meet_date);
    const year = meetDate.getFullYear();
    const month = meetDate.getMonth() + 1; // JavaScript months are 0-based
    
    // Academic year: July 1 - June 30
    // If meet is July-December, it's in that year's season
    // If meet is January-June, it's in the previous year's season
 const academicYear = month >= 7 ? year + 1 : year; // Academic year is always one year ahead of season year
     
    // Calculate current grade from graduation year and meet date
    const currentGrade = 12 - (result.graduation_year - academicYear);
    
    return {
      ...result,
      academic_year: academicYear,
      gender: result.race_gender === 'M' ? 'Boys' : 'Girls',
      grade: currentGrade,
      race_division: result.race_category || 'Varsity' // Use race_category as division
    };
  });

  console.log('Results with academic years:', resultsWithAcademicYear.slice(0, 3));

  // Group by academic year
  const seasonGroups = resultsWithAcademicYear.reduce((acc, result) => {
    const year = result.academic_year;
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(result);
    return acc;
  }, {} as Record<number, typeof resultsWithAcademicYear>);

  console.log('Season groups:', Object.keys(seasonGroups));

  // Process each season
  const seasons: SeasonData[] = [];

  for (const [year, results] of Object.entries(seasonGroups)) {
    const academicYear = parseInt(year);
    const seasonName = `${academicYear}-${(academicYear + 1).toString().slice(-2)}`;

    // Separate by gender
    const boysResults = results.filter(r => r.gender === 'Boys');
    const girlsResults = results.filter(r => r.gender === 'Girls');

    // Calculate team stats
    const boysStats = calculateTeamStats(boysResults);
    const girlsStats = calculateTeamStats(girlsResults);

    // Get top performers
    const topBoys = getTopPerformers(boysResults, 10);
    const topGirls = getTopPerformers(girlsResults, 10);

    // Calculate team performances
    const teamPerformances = calculateTeamPerformances(results);
    const seasonBestTeam = calculateSeasonBestTeam(results);

    // Count unique meets and races
    const uniqueMeets = new Set(results.map(r => r.meet_name)).size;
    const uniqueRaces = new Set(results.map(r => `${r.meet_name}-${r.race_category}`)).size;

    seasons.push({
      academic_year: academicYear,
      season_name: seasonName,
      boys_stats: boysStats,
      girls_stats: girlsStats,
      top_boys: topBoys,
      top_girls: topGirls,
      meets_count: uniqueMeets,
      races_count: uniqueRaces,
      team_performances: teamPerformances,
      season_best_team: seasonBestTeam
    });
  }

  return seasons;
}

function calculateTeamStats(results: any[]): TeamSeasonStats {
  if (results.length === 0) {
    return {
      total_athletes: 0,
      avg_xc_time: null,
      best_xc_time: null,
      meets_participated: 0,
      varsity_avg: null,
      jv_avg: null
    };
  }

  // Calculate XC Times
  const xcTimes = results.map(r => r.time_seconds * r.xc_time_rating);
  const varsityResults = results.filter(r => r.race_division?.toLowerCase().includes('varsity'));
  const jvResults = results.filter(r => r.race_division?.toLowerCase().includes('jv') || r.race_division?.toLowerCase().includes('junior'));

  const varsityXcTimes = varsityResults.map(r => r.time_seconds * r.xc_time_rating);
  const jvXcTimes = jvResults.map(r => r.time_seconds * r.xc_time_rating);

  return {
    total_athletes: new Set(results.map(r => r.athlete_id)).size,
    avg_xc_time: xcTimes.reduce((sum, time) => sum + time, 0) / xcTimes.length,
    best_xc_time: Math.min(...xcTimes),
    meets_participated: new Set(results.map(r => r.meet_name)).size,
    varsity_avg: varsityXcTimes.length > 0 ? 
      varsityXcTimes.reduce((sum, time) => sum + time, 0) / varsityXcTimes.length : null,
    jv_avg: jvXcTimes.length > 0 ? 
      jvXcTimes.reduce((sum, time) => sum + time, 0) / jvXcTimes.length : null
  };
}

function calculateTeamPerformances(results: any[]): TeamPerformance[] {
  // Group by meet
  const meetGroups = results.reduce((acc, result) => {
    const meetKey = `${result.meet_name}-${result.meet_date}`;
    if (!acc[meetKey]) {
      acc[meetKey] = [];
    }
    acc[meetKey].push(result);
    return acc;
  }, {} as Record<string, any[]>);

  const teamPerformances: TeamPerformance[] = [];

  for (const [meetKey, meetResults] of Object.entries(meetGroups) as [string, any[]][]) {
    const boysResults = meetResults.filter((r: any) => r.gender === 'Boys');
    const girlsResults = meetResults.filter((r: any) => r.gender === 'Girls');

    const boysTeam = calculateTeamScore(boysResults);
    const girlsTeam = calculateTeamScore(girlsResults);

    teamPerformances.push({
      meet_name: meetResults[0].meet_name,
      meet_date: meetResults[0].meet_date,
      boys_team: boysTeam,
      girls_team: girlsTeam
    });
  }

  // Sort by date (most recent first)
  return teamPerformances.sort((a, b) => 
    new Date(b.meet_date).getTime() - new Date(a.meet_date).getTime()
  );
}

function calculateSeasonBestTeam(results: any[]): { boys: TeamScore | null; girls: TeamScore | null } {
  const boysResults = results.filter(r => r.gender === 'Boys');
  const girlsResults = results.filter(r => r.gender === 'Girls');

  // Get season best for each athlete (fastest XC time)
  const boysSBs = getSeasonBests(boysResults);
  const girlsSBs = getSeasonBests(girlsResults);

  const boysTeam = calculateTeamScore(boysSBs);
  const girlsTeam = calculateTeamScore(girlsSBs);

  return {
    boys: boysTeam,
    girls: girlsTeam
  };
}

function getSeasonBests(results: any[]): any[] {
  // Group by athlete and get their fastest time
  const athleteGroups = results.reduce((acc, result) => {
    const athleteId = result.athlete_id;
    if (!acc[athleteId]) {
      acc[athleteId] = [];
    }
    acc[athleteId].push(result);
    return acc;
  }, {} as Record<string, any[]>);

  const seasonBests = [];
  for (const [athleteId, athleteResults] of Object.entries(athleteGroups) as [string, any[]][]) {
    // Find fastest XC time for this athlete
    const fastest = athleteResults.reduce((best: any, current: any) => {
      const currentXCTime = current.time_seconds * current.xc_time_rating;
      const bestXCTime = best.time_seconds * best.xc_time_rating;
      return currentXCTime < bestXCTime ? current : best;
    });
    
    seasonBests.push(fastest);
  }

  return seasonBests;
}

function calculateTeamScore(results: any[]): TeamScore | null {
  if (results.length === 0) return null;

  // Calculate XC time for each result and sort by fastest
  const resultsWithXCTime = results.map(result => ({
    ...result,
    xc_time: result.time_seconds * result.xc_time_rating
  })).sort((a, b) => a.xc_time - b.xc_time);

  // Take top 5 (or however many we have)
  const top5 = resultsWithXCTime.slice(0, 5);
  
  if (top5.length === 0) return null;

  const totalXCTime = top5.reduce((sum, result) => sum + result.xc_time, 0);

  return {
    total_xc_time: totalXCTime,
    athletes: top5.map((result, index) => ({
      name: result.athlete_name,
      xc_time: result.xc_time,
      actual_time: result.time_seconds,
      place: index + 1
    }))
  };
}

function getTopPerformers(results: any[], limit: number): AthleteSeasonResult[] {
  // Group by athlete
  const athleteGroups = results.reduce((acc, result) => {
    const athleteId = result.athlete_id;
    if (!acc[athleteId]) {
      acc[athleteId] = [];
    }
    acc[athleteId].push(result);
    return acc;
  }, {} as Record<number, any[]>);

  // Calculate best performance for each athlete
  const performers: AthleteSeasonResult[] = [];

  for (const [athleteId, athleteResults] of Object.entries(athleteGroups) as [string, any[]][]) {
    const xcTimes = athleteResults.map(r => ({
      xc_time: r.time_seconds * r.xc_time_rating,
      actual_time: r.time_seconds,
      course: r.course_name,
      meet: r.meet_name,
      date: r.meet_date
    }));

    // Find best XC Time
    const bestPerformance = xcTimes.reduce((best, current) => 
      current.xc_time < best.xc_time ? current : best
    );

    const avgXcTime = xcTimes.reduce((sum, perf) => sum + perf.xc_time, 0) / xcTimes.length;

    performers.push({
      athlete_id: parseInt(athleteId),
      athlete_name: athleteResults[0].athlete_name,
      grade: athleteResults[0].grade,
      best_xc_time: bestPerformance.xc_time,
      best_actual_time: bestPerformance.actual_time,
      best_course: bestPerformance.course,
      best_meet: bestPerformance.meet,
      best_date: bestPerformance.date,
      total_races: athleteResults.length,
      avg_xc_time: avgXcTime
    });
  }

  // Sort by best XC Time and return top performers
  return performers
    .sort((a, b) => a.best_xc_time - b.best_xc_time)
    .slice(0, limit);
}

function formatTime(centiseconds: number): string {
  const totalSeconds = centiseconds / 100;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((totalSeconds % 1) * 100);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function SeasonCard({ season }: { season: SeasonData }) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">{season.season_name} Season</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">{season.meets_count} meets</Badge>
            <Badge variant="outline">{season.races_count} races</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="boys" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="boys">
              Boys ({season.boys_stats.total_athletes} athletes)
            </TabsTrigger>
            <TabsTrigger value="girls">
              Girls ({season.girls_stats.total_athletes} athletes)
            </TabsTrigger>
            <TabsTrigger value="team-times">
              Team Times
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="boys" className="space-y-4">
            <TeamStatsSection stats={season.boys_stats} />
            <TopPerformersSection performers={season.top_boys} gender="Boys" />
          </TabsContent>
          
          <TabsContent value="girls" className="space-y-4">
            <TeamStatsSection stats={season.girls_stats} />
            <TopPerformersSection performers={season.top_girls} gender="Girls" />
          </TabsContent>

          <TabsContent value="team-times" className="space-y-4">
            <TeamTimesSection 
              seasonBest={season.season_best_team}
              performances={season.team_performances}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TeamStatsSection({ stats }: { stats: TeamSeasonStats }) {
  if (stats.total_athletes === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available for this season
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
      <div className="text-center">
        <div className="text-2xl font-bold">{stats.total_athletes}</div>
        <div className="text-sm text-muted-foreground">Athletes</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold">
          {stats.best_xc_time ? formatTime(stats.best_xc_time) : 'N/A'}
        </div>
        <div className="text-sm text-muted-foreground">Best XC Time</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold">
          {stats.varsity_avg ? formatTime(stats.varsity_avg) : 'N/A'}
        </div>
        <div className="text-sm text-muted-foreground">Varsity Avg</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold">{stats.meets_participated}</div>
        <div className="text-sm text-muted-foreground">Meets</div>
      </div>
    </div>
  );
}

function TeamTimesSection({ 
  seasonBest, 
  performances 
}: { 
  seasonBest: { boys: TeamScore | null; girls: TeamScore | null };
  performances: TeamPerformance[];
}) {
  return (
    <div className="space-y-6">
      {/* Season Best Team Times */}
      <div>
        <h4 className="text-lg font-semibold mb-4">Team Time with SBs (Season Bests)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Boys Team */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h5 className="font-semibold text-blue-800 mb-3">Boys Team</h5>
            {seasonBest.boys ? (
              <div>
                <div className="text-2xl font-bold text-blue-900 mb-3">
                  {formatTime(seasonBest.boys.total_xc_time)}
                </div>
                <div className="space-y-2">
                  {seasonBest.boys.athletes.map((athlete, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{athlete.place}. {athlete.name}</span>
                      <span className="font-mono">{formatTime(athlete.xc_time)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-blue-600">No data available</div>
            )}
          </div>

          {/* Girls Team */}
          <div className="bg-pink-50 rounded-lg p-4">
            <h5 className="font-semibold text-pink-800 mb-3">Girls Team</h5>
            {seasonBest.girls ? (
              <div>
                <div className="text-2xl font-bold text-pink-900 mb-3">
                  {formatTime(seasonBest.girls.total_xc_time)}
                </div>
                <div className="space-y-2">
                  {seasonBest.girls.athletes.map((athlete, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{athlete.place}. {athlete.name}</span>
                      <span className="font-mono">{formatTime(athlete.xc_time)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-pink-600">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Season Performances */}
      <div>
        <h4 className="text-lg font-semibold mb-4">Season Performances</h4>
        {performances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No team performances recorded yet.
          </div>
        ) : (
          <div className="space-y-4">
            {performances.map((performance, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h5 className="font-semibold">{performance.meet_name}</h5>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(performance.meet_date)}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Boys Performance */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <h6 className="font-medium text-blue-800 mb-2">Boys</h6>
                    {performance.boys_team ? (
                      <div>
                        <div className="text-xl font-bold text-blue-900 mb-2">
                          {formatTime(performance.boys_team.total_xc_time)}
                        </div>
                        <div className="space-y-1">
                          {performance.boys_team.athletes.map((athlete, athleteIndex) => (
                            <div key={athleteIndex} className="flex justify-between text-sm">
                              <span>{athlete.place}. {athlete.name}</span>
                              <span className="font-mono">{formatTime(athlete.xc_time)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-blue-600 text-sm">No team data</div>
                    )}
                  </div>

                  {/* Girls Performance */}
                  <div className="bg-pink-50 rounded-lg p-3">
                    <h6 className="font-medium text-pink-800 mb-2">Girls</h6>
                    {performance.girls_team ? (
                      <div>
                        <div className="text-xl font-bold text-pink-900 mb-2">
                          {formatTime(performance.girls_team.total_xc_time)}
                        </div>
                        <div className="space-y-1">
                          {performance.girls_team.athletes.map((athlete, athleteIndex) => (
                            <div key={athleteIndex} className="flex justify-between text-sm">
                              <span>{athlete.place}. {athlete.name}</span>
                              <span className="font-mono">{formatTime(athlete.xc_time)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-pink-600 text-sm">No team data</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopPerformersSection({ 
  performers, 
  gender 
}: { 
  performers: AthleteSeasonResult[]; 
  gender: string; 
}) {
  if (performers.length === 0) {
    return null;
  }

  return (
    <div>
      <h4 className="text-lg font-semibold mb-3">Top {gender} Performers</h4>
      <div className="space-y-2">
        {performers.map((performer, index) => (
          <div
            key={performer.athlete_id}
            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              <div>
                <Link
                  href={`/athletes/${performer.athlete_id}`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {performer.athlete_name}
                </Link>
                <div className="text-sm text-muted-foreground">
                  Grade {performer.grade} • {performer.total_races} races
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg">
                {formatTime(performer.best_xc_time)}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatTime(performer.best_actual_time)} at {performer.best_course}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(performer.best_date)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function SchoolSeasonsPage({ params }: SchoolSeasonsPageProps) {
  const school = await getSchoolData(params.id);
  
  if (!school) {
    notFound();
  }

  const seasons = await getSchoolSeasons(params.id);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href={`/schools/${school.id}`}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back to {school.name}
          </Link>
        </div>
        <h1 className="text-3xl font-bold">{school.name} - Season History</h1>
        <p className="text-muted-foreground mt-2">
          Complete season-by-season performance analysis
        </p>
      </div>

      {seasons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-lg">
              No season data available for this school yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {seasons.map((season) => (
            <SeasonCard key={season.academic_year} season={season} />
          ))}
        </div>
      )}
    </div>
  );
}