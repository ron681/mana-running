# RACE PARTICIPANTS COUNT - ISSUE & FIX

## 📋 ISSUE SUMMARY

**Problem:** The `total_participants` field in the `races` table contains incorrect or stale values.

**Identified:** October 7, 2025

**Current Status:** Active issue - data is inconsistent

---

## 🔍 TECHNICAL DETAILS

### Database Schema
```sql
-- races table structure (relevant fields)
CREATE TABLE races (
  id UUID PRIMARY KEY,
  meet_id UUID NOT NULL REFERENCES meets(id),
  course_id UUID REFERENCES courses(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  gender TEXT NOT NULL,
  total_participants INTEGER,  -- This field is incorrect!
  ...
);

-- results table (source of truth)
CREATE TABLE results (
  id UUID PRIMARY KEY,
  race_id UUID REFERENCES races(id),
  athlete_id UUID NOT NULL,
  time_seconds INTEGER NOT NULL,
  ...
);
```

### The Relationship
- **One race** → **Many results** (1:N relationship)
- `races.total_participants` should ALWAYS equal COUNT of results where `race_id = races.id`
- Currently NO mechanism maintains this synchronization

---

## 🚨 IMPACT

### What's Broken
1. **Race Statistics**: Incorrect participant counts displayed
2. **Course Metrics**: Course difficulty ratings may be wrong
3. **Team Scoring**: Meet scoring could be inaccurate
4. **Historical Data**: Cannot trust historical participation trends

### Example Discrepancy
```sql
-- Example query showing the problem
SELECT 
  r.id,
  r.name,
  r.total_participants as stored_count,
  (SELECT COUNT(*) FROM results WHERE race_id = r.id) as actual_count,
  r.total_participants - (SELECT COUNT(*) FROM results WHERE race_id = r.id) as difference
FROM races r
WHERE r.total_participants IS NOT NULL
  AND r.total_participants != (SELECT COUNT(*) FROM results WHERE race_id = r.id)
ORDER BY ABS(difference) DESC
LIMIT 20;
```

---

## ✅ COMPLETE FIX (Step-by-Step)

### STEP 1: Fix Existing Data (One-time)
**Time:** 2 minutes  
**Run in:** Supabase SQL Editor

```sql
-- Update all races with correct participant counts
UPDATE races r
SET total_participants = (
  SELECT COUNT(*)
  FROM results res
  WHERE res.race_id = r.id
)
WHERE r.id IN (
  SELECT DISTINCT race_id 
  FROM results 
  WHERE race_id IS NOT NULL
);

-- Set to 0 for races with no results
UPDATE races
SET total_participants = 0
WHERE id NOT IN (
  SELECT DISTINCT race_id 
  FROM results 
  WHERE race_id IS NOT NULL
);
```

**Verification:**
```sql
-- Should return 0 rows after fix
SELECT 
  r.id,
  r.name,
  r.total_participants as stored,
  (SELECT COUNT(*) FROM results WHERE race_id = r.id) as actual
FROM races r
WHERE r.total_participants != (SELECT COUNT(*) FROM results WHERE race_id = r.id);
```

---

### STEP 2: Create Auto-Update Trigger (Permanent Solution)
**Time:** 3 minutes  
**Run in:** Supabase SQL Editor

```sql
-- Create function to update race participant count
CREATE OR REPLACE FUNCTION update_race_participants()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the race's total_participants based on the trigger event
  UPDATE races
  SET total_participants = (
    SELECT COUNT(*)
    FROM results
    WHERE race_id = COALESCE(NEW.race_id, OLD.race_id)
  )
  WHERE id = COALESCE(NEW.race_id, OLD.race_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_race_participants_trigger ON results;

-- Create trigger on results table for INSERT, UPDATE, DELETE
CREATE TRIGGER update_race_participants_trigger
AFTER INSERT OR UPDATE OR DELETE ON results
FOR EACH ROW
EXECUTE FUNCTION update_race_participants();
```

**What This Does:**
- **INSERT result** → Increments race `total_participants`
- **DELETE result** → Decrements race `total_participants`
- **UPDATE result** (if race_id changes) → Updates both old and new race counts
- Happens automatically, no application code needed

**Verification:**
```sql
-- Verify trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'update_race_participants_trigger';

-- Should return: update_race_participants_trigger | INSERT | results
--                update_race_participants_trigger | UPDATE | results
--                update_race_participants_trigger | DELETE | results
```

---

### STEP 3: Add Application Validation (Optional but Recommended)
**Time:** 10 minutes  
**Files:** `/src/lib/crud-operations.ts` or wherever results are created

```typescript
/**
 * Validate race participant count after result operations
 * Add this after any bulk result import or result creation
 */
async function validateRaceParticipants(raceId: string) {
  const { data: race } = await supabase
    .from('races')
    .select('total_participants')
    .eq('id', raceId)
    .single();

  const { count: actualCount } = await supabase
    .from('results')
    .select('*', { count: 'exact', head: true })
    .eq('race_id', raceId);

  if (race?.total_participants !== actualCount) {
    console.error(
      `[VALIDATION ERROR] Race ${raceId}:`,
      `Stored count: ${race?.total_participants}`,
      `Actual count: ${actualCount}`,
      `Difference: ${(race?.total_participants || 0) - (actualCount || 0)}`
    );
    
    // This should never happen with the trigger, but log if it does
    return false;
  }
  
  return true;
}

// Example usage after importing results
async function importRaceResults(raceId: string, results: ResultData[]) {
  // ... import logic ...
  
  // Validate after import
  const isValid = await validateRaceParticipants(raceId);
  if (!isValid) {
    console.warn('Participant count validation failed after import');
  }
}
```

---

### STEP 4: Test the Fix
**Time:** 5 minutes

```sql
-- Test 1: Insert a result and check count increments
INSERT INTO results (athlete_id, race_id, meet_id, time_seconds, season_year)
VALUES (
  '<test-athlete-id>',
  '<test-race-id>',
  '<test-meet-id>',
  900,
  2025
);

-- Verify count increased by 1
SELECT total_participants FROM races WHERE id = '<test-race-id>';

-- Test 2: Delete the result and check count decrements
DELETE FROM results 
WHERE athlete_id = '<test-athlete-id>' 
  AND race_id = '<test-race-id>';

-- Verify count decreased by 1
SELECT total_participants FROM races WHERE id = '<test-race-id>';
```

---

## 📊 MONITORING

### Daily Check (Run Once Per Day)
```sql
-- Check for any mismatches (should always return 0 rows)
SELECT COUNT(*) as mismatched_races
FROM races r
WHERE r.total_participants != (
  SELECT COUNT(*) FROM results WHERE race_id = r.id
);
```

### Performance Impact Check
```sql
-- Verify trigger is not slowing down inserts
-- Run before and after trigger creation
EXPLAIN ANALYZE
INSERT INTO results (athlete_id, race_id, meet_id, time_seconds, season_year)
VALUES ('<athlete-id>', '<race-id>', '<meet-id>', 900, 2025);
```

---

## 🔧 TROUBLESHOOTING

### If Counts Still Don't Match

**1. Check if trigger exists:**
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'update_race_participants_trigger';
```

**2. Check if function exists:**
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'update_race_participants';
```

**3. Re-run the data fix:**
```sql
UPDATE races r
SET total_participants = (
  SELECT COUNT(*) FROM results WHERE race_id = r.id
);
```

### If Trigger Not Firing

**Check trigger definition:**
```sql
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'update_race_participants_trigger';
```

**Manually fire function:**
```sql
-- Test the function directly
SELECT update_race_participants();
```

---

## 📝 CHECKLIST

- [ ] **STEP 1 COMPLETE**: Run UPDATE query to fix existing data
- [ ] **STEP 1 VERIFIED**: Confirm 0 mismatched races
- [ ] **STEP 2 COMPLETE**: Create trigger function
- [ ] **STEP 2 COMPLETE**: Create trigger on results table
- [ ] **STEP 2 VERIFIED**: Confirm trigger exists (3 rows: INSERT, UPDATE, DELETE)
- [ ] **STEP 3 COMPLETE**: Add validation code to application (optional)
- [ ] **STEP 4 COMPLETE**: Test insert/delete scenarios
- [ ] **STEP 4 VERIFIED**: Counts update correctly

---

## 🎯 SUCCESS CRITERIA

After implementing this fix, the following should be TRUE:

1. ✅ All races have accurate `total_participants` counts
2. ✅ Trigger automatically maintains counts on every result change
3. ✅ Daily monitoring query returns 0 mismatched races
4. ✅ Application validation (if implemented) shows no errors
5. ✅ Race statistics pages show correct participant numbers

---

## 📅 MAINTENANCE

### Daily (Automated)
- Monitor mismatch query (should return 0)

### Weekly
- Review application validation logs for any anomalies

### After Bulk Imports
- Run verification query to ensure counts are correct
- Check import logs for any validation warnings

---

## 🔗 RELATED DOCUMENTATION

- **Full Action Items:** `/docs/IMMEDIATE_ACTION_ITEMS.md` (Item #1)
- **Quick Reference:** `/docs/QUICK_REFERENCE.md` (Troubleshooting section)
- **Project Summary:** `/docs/MANA_RUNNING_PROJECT_SUMMARY.md` (Known Issues section)
- **Schema Changes:** `/docs/schema-changelog.md`

---

**Document Created:** October 7, 2025  
**Status:** Ready for implementation  
**Priority:** CRITICAL - Do immediately
