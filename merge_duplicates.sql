-- Create a temporary table to track which athletes to keep
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

-- Create a mapping of all duplicate IDs to the ID we're keeping
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

-- Show what we're about to merge (verification step)
SELECT 
  COUNT(*) as total_duplicates_to_merge,
  COUNT(DISTINCT new_id) as unique_athletes_affected
FROM athlete_id_mapping;

-- Update performances table to point to kept athlete
UPDATE performances
SET athlete_id = aim.new_id
FROM athlete_id_mapping aim
WHERE performances.athlete_id = aim.old_id;

-- Update any other tables that reference athletes
-- Check your schema for other foreign keys to athletes table
-- Examples (uncomment if these tables exist):

-- UPDATE team_rosters
-- SET athlete_id = aim.new_id
-- FROM athlete_id_mapping aim
-- WHERE team_rosters.athlete_id = aim.old_id;

-- UPDATE athlete_seasons
-- SET athlete_id = aim.new_id
-- FROM athlete_id_mapping aim
-- WHERE athlete_seasons.athlete_id = aim.old_id;

-- Delete duplicate athlete records
DELETE FROM athletes
WHERE id IN (SELECT old_id FROM athlete_id_mapping);

-- Add unique constraint to prevent future duplicates
ALTER TABLE athletes 
ADD CONSTRAINT athletes_unique_person 
UNIQUE (first_name, last_name, current_school_id, graduation_year);

-- Show summary
SELECT 
  'Merge complete' as status,
  COUNT(*) as remaining_athletes
FROM athletes;