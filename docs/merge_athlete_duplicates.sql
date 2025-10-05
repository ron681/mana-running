-- =====================================================
-- ATHLETE DUPLICATE MERGE SCRIPT
-- =====================================================
-- This will:
-- 1. Keep the oldest record for each duplicate athlete
-- 2. Update all results and school_transfers to point to kept record
-- 3. Delete duplicate athlete records
-- 4. Add constraint to prevent future duplicates
-- =====================================================

-- Step 1: Create temp table with athletes to keep (oldest by created_at)
CREATE TEMP TABLE athletes_to_keep AS
SELECT DISTINCT ON (first_name, last_name, current_school_id, graduation_year)
  id as keep_id,
  first_name,
  last_name,
  current_school_id,
  graduation_year,
  created_at
FROM athletes
ORDER BY first_name, last_name, current_school_id, graduation_year, created_at ASC;

-- Step 2: Create mapping of duplicate IDs to the ID we're keeping
CREATE TEMP TABLE athlete_id_mapping AS
SELECT 
  a.id as old_id,
  atk.keep_id as new_id
FROM athletes a
JOIN athletes_to_keep atk ON 
  a.first_name = atk.first_name 
  AND a.last_name = atk.last_name
  AND a.current_school_id = atk.current_school_id
  AND a.graduation_year = atk.graduation_year
WHERE a.id != atk.keep_id;

-- Step 3: VERIFICATION - Show what we're about to merge
SELECT 
  'VERIFICATION' as stage,
  COUNT(*) as total_duplicates_to_merge,
  COUNT(DISTINCT new_id) as unique_athletes_affected
FROM athlete_id_mapping;

-- Step 4: Update results table
UPDATE results
SET athlete_id = aim.new_id
FROM athlete_id_mapping aim
WHERE results.athlete_id = aim.old_id;

-- Show results update count
SELECT 
  'Results table updated' as stage,
  COUNT(*) as records_updated
FROM results r
JOIN athlete_id_mapping aim ON r.athlete_id = aim.new_id;

-- Step 5: Update school_transfers table
UPDATE school_transfers
SET athlete_id = aim.new_id
FROM athlete_id_mapping aim
WHERE school_transfers.athlete_id = aim.old_id;

-- Show school_transfers update count
SELECT 
  'School transfers table updated' as stage,
  COUNT(*) as records_updated
FROM school_transfers st
JOIN athlete_id_mapping aim ON st.athlete_id = aim.new_id;

-- Step 6: Delete duplicate athlete records
DELETE FROM athletes
WHERE id IN (SELECT old_id FROM athlete_id_mapping);

-- Show deletion count
SELECT 
  'Duplicate athletes deleted' as stage,
  (SELECT COUNT(*) FROM athlete_id_mapping) as records_deleted;

-- Step 7: Add unique constraint to prevent future duplicates
ALTER TABLE athletes 
ADD CONSTRAINT athletes_unique_person 
UNIQUE (first_name, last_name, current_school_id, graduation_year);

-- Step 8: FINAL SUMMARY
SELECT 
  'MERGE COMPLETE' as status,
  COUNT(*) as remaining_athletes,
  (SELECT COUNT(DISTINCT (first_name, last_name, current_school_id, graduation_year)) FROM athletes) as unique_athletes
FROM athletes;

-- Step 9: VERIFICATION - Should return 0 rows
SELECT 
  first_name, 
  last_name, 
  current_school_id, 
  graduation_year,
  COUNT(*) as duplicate_count
FROM athletes
GROUP BY first_name, last_name, current_school_id, graduation_year
HAVING COUNT(*) > 1;
