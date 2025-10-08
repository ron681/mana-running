# Race Page Client Component Implementation Guide

## Overview

Using the same pattern as the Combined Results page (`ResultsTable.tsx`), we've created a client-side component for sortable individual results while keeping team scoring calculation on the server.

## Files to Create/Update

### 1. Create Client Component
**File:** `/components/IndividualResultsTable.tsx`
**Source:** [IndividualResultsTable.tsx](computer:///mnt/user-data/outputs/IndividualResultsTable.tsx)

**Features:**
- Sortable columns (Place, Name, Team, Time, Team Points)
- Click column headers to sort
- Visual indicators for sort direction (↑/↓)
- Maintains podium highlighting (🥇🥈🥉)
- Shows "-" for non-scoring runners in Team Points column

### 2. Update Race Page
**File:** `/app/meets/[meetId]/races/[raceId]/page.tsx`
**Source:** [race_page_with_client_component.tsx](computer:///mnt/user-data/outputs/race_page_with_client_component.tsx)

**Changes:**
- Import `IndividualResultsTable` client component
- Keep all data fetching and calculation server-side
- Pass pre-calculated results to client component
- Team scoring logic now matches Combined Results page

## Architecture Benefits

### Server Component (Race Page)
✅ Data fetching from Supabase  
✅ Team scoring calculations  
✅ Displacement logic  
✅ Security checks (isAdmin)

### Client Component (IndividualResultsTable)
✅ Sorting functionality  
✅ Interactive UI features  
✅ Fast client-side sorting (no server round-trip)  
✅ Consistent with Combined Results page

## Key Improvements

1. **Consistent UX:** Matches the sorting behavior of Combined Results page
2. **Performance:** Sorting happens instantly on the client
3. **Clean Code:** Separation of server/client concerns
4. **Correct Scoring:** Team Points column shows scoring place (after displacement)
5. **Sortable:** All columns can be sorted (Place, Name, Team, Time, Team Points)

## What's Different from Original?

### Before (Server-only):
```tsx
// All rendering in server component
<table>
  <thead>
    <tr>
      <th>Place</th> {/* No sorting */}
      <th>Name</th>
      {/* ... */}
    </tr>
  </thead>
  <tbody>
    {/* Static table */}
  </tbody>
</table>
```

### After (Hybrid):
```tsx
// Server component calculates data
const timedResultsWithScoring = calculateScoringPlaces(timedResults);

// Client component handles interaction
<IndividualResultsTable 
  timedResults={timedResultsWithScoring}
  untimedResults={untimedResults}
  raceId={params.raceId}
  isAdmin={admin}
/>
```

## Team Scoring Logic (Now Correct)

### Step 1: Identify Complete Teams
```typescript
const teamStandings = Object.entries(teamResults)
  .map(([schoolId, runners]) => {
    const countingRunners = runners.slice(0, 5);
    const displacers = runners.slice(5, 7);
    const nonScoring = runners.slice(7);
    return { /* ... */ };
  })
  .filter(team => team.countingRunners.length >= 5);
```

### Step 2: Calculate Qualifying Athletes
```typescript
const qualifyingAthleteIds = new Set<string>();
teamStandings.forEach(team => {
  team.countingRunners.forEach(runner => qualifyingAthleteIds.add(runner.athlete_id));
  team.displacers.forEach(runner => qualifyingAthleteIds.add(runner.athlete_id));
});
```

### Step 3: Assign Scoring Places (After Displacement)
```typescript
let scoringPlace = 1;
timedResults.forEach(result => {
  if (qualifyingAthleteIds.has(result.athlete_id)) {
    result.scoringPlace = scoringPlace++;
  } else {
    result.scoringPlace = null; // Non-scoring
  }
});
```

### Step 4: Calculate Team Scores Using Scoring Places
```typescript
teamStandings.forEach(team => {
  team.score = team.countingRunners.reduce((sum, runner) => {
    const resultWithScoring = timedResults.find(r => r.athlete_id === runner.athlete_id);
    return sum + (resultWithScoring?.scoringPlace || 0);
  }, 0);
});
```

## Testing Checklist

After deployment, verify:

- [ ] Individual results table loads correctly
- [ ] Click column headers to sort (all columns)
- [ ] Sort indicators (↑/↓) appear and toggle correctly
- [ ] Team Points column shows scoring places
- [ ] Non-scoring runners show "-" in Team Points
- [ ] Podium medals (🥇🥈🥉) display on top 3
- [ ] Team Standings show correct scores
- [ ] Team Standings badges show scoring places (not overall places)
- [ ] Team scores match between race page and combined results page
- [ ] Admin delete buttons work (if admin)

## Comparison with Combined Results

Both pages now use the same pattern:

| Feature | Combined Results | Race Page |
|---------|-----------------|-----------|
| Client Component | `ResultsTable.tsx` | `IndividualResultsTable.tsx` |
| Sortable Columns | ✅ | ✅ |
| Team Points Column | ✅ | ✅ |
| Displacement Logic | ✅ | ✅ |
| Server-side Calculation | ✅ | ✅ |
| Client-side Sorting | ✅ | ✅ |

## Implementation Steps

1. Create `/components/IndividualResultsTable.tsx`
2. Replace `/app/meets/[meetId]/races/[raceId]/page.tsx`
3. Test sorting functionality
4. Verify team scoring matches Combined Results
5. Confirm Team Points column displays correctly

Done! The race page now has the same professional UX as the Combined Results page.
