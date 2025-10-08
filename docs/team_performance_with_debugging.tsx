// IMPROVED VERSION - Team Performance Loading with Debugging
// Replace loadTopTeamPerformances() in /app/courses/[id]/page.tsx
// This version includes comprehensive logging and better error handling

const loadTopTeamPerformances = async (courseId: string) => {
  try {
    console.log('=== LOADING TEAM PERFORMANCES ===')
    console.log('Course ID:', courseId)
    
    // Fetch ALL results for races on this course
    const { data: raceResults, error } = await supabase
      .from('results')
      .select(`
        id,
        time_seconds,
        race:races!inner(
          id,
          gender,
          course_id,
          meet:meets!inner(
            id,
            name,
            meet_date
          )
        ),
        athlete:athletes!inner(
          id,
          first_name,
          last_name,
          graduation_year,
          school:schools!inner(
            id,
            name
          )
        )
      `)
      .eq('race.course_id', courseId)

    if (error) {
      console.error('Supabase query error:', error)
      throw error
    }

    console.log('Raw results count:', raceResults?.length || 0)

    // Process results with proper type handling
    const processedResults = raceResults?.map(r => ({
      ...r,
      race: Array.isArray(r.race) ? r.race[0] : r.race,
      athlete: Array.isArray(r.athlete) ? r.athlete[0] : r.athlete
    })).map(r => ({
      ...r,
      race: {
        ...r.race,
        meet: Array.isArray(r.race.meet) ? r.race.meet[0] : r.race.meet
      },
      athlete: {
        ...r.athlete,
        school: Array.isArray(r.athlete.school) ? r.athlete.school[0] : r.athlete.school
      }
    })) || []

    console.log('Processed results count:', processedResults.length)

    // Sample first result to verify structure
    if (processedResults.length > 0) {
      console.log('Sample result structure:', {
        race_id: processedResults[0].race.id,
        race_gender: processedResults[0].race.gender,
        athlete_gender: processedResults[0].athlete.gender,
        school_name: processedResults[0].athlete.school.name
      })
    }

    // Process boys teams
    const boysResults = processedResults.filter(r => 
      r.race?.gender === 'Boys' || r.athlete?.gender === 'M'
    )
    
    console.log('Boys results count:', boysResults.length)
    
    const boysTeamMap = new Map<string, typeof processedResults>()
    
    // Group by RACE + school
    for (const result of boysResults) {
      const key = `${result.race.id}_${result.athlete.school.id}`
      if (!boysTeamMap.has(key)) {
        boysTeamMap.set(key, [])
      }
      boysTeamMap.get(key)!.push(result)
    }

    console.log('Boys team groups:', boysTeamMap.size)
    
    // Log team sizes
    const boysTeamSizes: { [key: string]: number } = {}
    boysTeamMap.forEach((results, key) => {
      boysTeamSizes[key] = results.length
    })
    console.log('Boys team sizes:', boysTeamSizes)

    // Calculate team scores
    const boysTeamPerformances: TeamPerformance[] = []
    
    for (const [key, teamResults] of boysTeamMap.entries()) {
      console.log(`Processing boys team: ${key}, runners: ${teamResults.length}`)
      
      // Need at least 5 runners
      if (teamResults.length >= 5) {
        // Sort by time and take top 5
        const sorted = teamResults.sort((a, b) => a.time_seconds - b.time_seconds)
        const topFive = sorted.slice(0, 5)
        const totalTime = topFive.reduce((sum, r) => sum + r.time_seconds, 0)
        
        console.log(`✓ Valid boys team found: ${topFive[0].athlete.school.name} at ${topFive[0].race.meet.name}`)
        
        boysTeamPerformances.push({
          school_id: topFive[0].athlete.school.id,
          school_name: topFive[0].athlete.school.name,
          meet_id: topFive[0].race.meet.id,
          meet_name: topFive[0].race.meet.name,
          meet_date: topFive[0].race.meet.meet_date,
          total_time: totalTime,
          runner_count: teamResults.length,
          top_five: topFive.map(r => ({
            athlete_id: r.athlete.id,
            athlete_name: `${r.athlete.first_name} ${r.athlete.last_name}`,
            time_seconds: r.time_seconds
          }))
        })
      }
    }

    console.log('Boys team performances found:', boysTeamPerformances.length)

    // Sort and take top 5 performances
    boysTeamPerformances.sort((a, b) => a.total_time - b.total_time)
    const topBoysTeams = boysTeamPerformances.slice(0, 5)
    console.log('Top 5 boys teams:', topBoysTeams.map(t => `${t.school_name} - ${t.total_time}`))
    setBoysTeams(topBoysTeams)

    // Process girls teams (same logic)
    const girlsResults = processedResults.filter(r => 
      r.race?.gender === 'Girls' || r.athlete?.gender === 'F'
    )
    
    console.log('Girls results count:', girlsResults.length)
    
    const girlsTeamMap = new Map<string, typeof processedResults>()
    
    // Group by RACE + school
    for (const result of girlsResults) {
      const key = `${result.race.id}_${result.athlete.school.id}`
      if (!girlsTeamMap.has(key)) {
        girlsTeamMap.set(key, [])
      }
      girlsTeamMap.get(key)!.push(result)
    }

    console.log('Girls team groups:', girlsTeamMap.size)

    // Calculate team scores
    const girlsTeamPerformances: TeamPerformance[] = []
    
    for (const [key, teamResults] of girlsTeamMap.entries()) {
      console.log(`Processing girls team: ${key}, runners: ${teamResults.length}`)
      
      // Need at least 5 runners
      if (teamResults.length >= 5) {
        // Sort by time and take top 5
        const sorted = teamResults.sort((a, b) => a.time_seconds - b.time_seconds)
        const topFive = sorted.slice(0, 5)
        const totalTime = topFive.reduce((sum, r) => sum + r.time_seconds, 0)
        
        console.log(`✓ Valid girls team found: ${topFive[0].athlete.school.name} at ${topFive[0].race.meet.name}`)
        
        girlsTeamPerformances.push({
          school_id: topFive[0].athlete.school.id,
          school_name: topFive[0].athlete.school.name,
          meet_id: topFive[0].race.meet.id,
          meet_name: topFive[0].race.meet.name,
          meet_date: topFive[0].race.meet.meet_date,
          total_time: totalTime,
          runner_count: teamResults.length,
          top_five: topFive.map(r => ({
            athlete_id: r.athlete.id,
            athlete_name: `${r.athlete.first_name} ${r.athlete.last_name}`,
            time_seconds: r.time_seconds
          }))
        })
      }
    }

    console.log('Girls team performances found:', girlsTeamPerformances.length)

    // Sort and take top 5 performances
    girlsTeamPerformances.sort((a, b) => a.total_time - b.total_time)
    const topGirlsTeams = girlsTeamPerformances.slice(0, 5)
    console.log('Top 5 girls teams:', topGirlsTeams.map(t => `${t.school_name} - ${t.total_time}`))
    setGirlsTeams(topGirlsTeams)

    console.log('=== TEAM PERFORMANCES LOADED ===')

  } catch (err) {
    console.error('Error loading team performances:', err)
    // Set empty arrays so UI doesn't break
    setBoysTeams([])
    setGirlsTeams([])
  }
}

// ALTERNATIVE: Always show the section even if no data
// Replace the conditional render with this:

{/* Top 5 Team Performances - ALWAYS SHOW */}
<div className="bg-white rounded-lg shadow mb-6 p-6">
  <h2 className="text-2xl font-bold text-black mb-4">Top 5 Team Performances</h2>
  
  {/* Disclaimer */}
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
    <div className="flex items-start space-x-2">
      <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <p className="text-sm text-yellow-800">
        <strong>Note:</strong> Team times are the sum of the top 5 runners from a school at a single race on this course.
      </p>
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
    {/* Boys Teams */}
    <div>
      <h3 className="text-xl font-bold text-blue-600 mb-4">Boys</h3>
      {boysTeams.length === 0 ? (
        <div className="text-gray-500 text-sm">
          No complete team performances (5+ runners) found.
          <br />
          Check browser console for diagnostic information.
        </div>
      ) : (
        // ... existing boys team display code
      )}
    </div>

    {/* Girls Teams */}
    <div>
      <h3 className="text-xl font-bold text-pink-600 mb-4">Girls</h3>
      {girlsTeams.length === 0 ? (
        <div className="text-gray-500 text-sm">
          No complete team performances (5+ runners) found.
          <br />
          Check browser console for diagnostic information.
        </div>
      ) : (
        // ... existing girls team display code
      )}
    </div>
  </div>
</div>
