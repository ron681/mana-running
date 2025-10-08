-- Diagnostic Query: Check if Team Performance Data Exists
-- Run this in Supabase SQL Editor to verify if any courses have complete team results

-- 1. Check how many results exist per race grouped by school
WITH race_school_counts AS (
  SELECT 
    r.id as race_id,
    r.gender,
    m.name as meet_name,
    m.meet_date,
    c.name as course_name,
    s.name as school_name,
    COUNT(*) as runner_count
  FROM results res
  JOIN races r ON res.race_id = r.id
  JOIN meets m ON r.meet_id = m.id
  JOIN courses c ON r.course_id = c.id
  JOIN athletes a ON res.athlete_id = a.id
  JOIN schools s ON a.current_school_id = s.id
  GROUP BY r.id, r.gender, m.name, m.meet_date, c.name, s.name
  HAVING COUNT(*) >= 5
)
SELECT 
  course_name,
  meet_name,
  meet_date,
  gender,
  school_name,
  runner_count,
  race_id
FROM race_school_counts
ORDER BY runner_count DESC, meet_date DESC
LIMIT 20;

-- 2. Check specific course (replace 'course-id-here' with actual course ID)
-- WITH team_results AS (
--   SELECT 
--     r.id as race_id,
--     r.gender,
--     m.name as meet_name,
--     m.meet_date,
--     s.name as school_name,
--     s.id as school_id,
--     a.first_name || ' ' || a.last_name as athlete_name,
--     res.time_seconds
--   FROM results res
--   JOIN races r ON res.race_id = r.id
--   JOIN meets m ON r.meet_id = m.id
--   JOIN athletes a ON res.athlete_id = a.id
--   JOIN schools s ON a.current_school_id = s.id
--   WHERE r.course_id = 'course-id-here'
--   ORDER BY r.id, s.name, res.time_seconds
-- )
-- SELECT 
--   race_id,
--   gender,
--   meet_name,
--   school_name,
--   COUNT(*) as runners,
--   STRING_AGG(athlete_name || ' (' || time_seconds || ')', ', ' ORDER BY time_seconds) as top_runners
-- FROM team_results
-- GROUP BY race_id, gender, meet_name, school_name
-- HAVING COUNT(*) >= 5
-- ORDER BY gender, MIN(meet_date) DESC;

-- 3. Check gender field values to ensure they match expected format
SELECT DISTINCT gender, COUNT(*) 
FROM races 
GROUP BY gender;

-- 4. Sample a specific race to see the data structure
SELECT 
  r.id as race_id,
  r.gender as race_gender,
  m.name as meet_name,
  a.gender as athlete_gender,
  s.name as school_name,
  a.first_name || ' ' || a.last_name as athlete,
  res.time_seconds
FROM results res
JOIN races r ON res.race_id = r.id
JOIN meets m ON r.meet_id = m.id
JOIN athletes a ON res.athlete_id = a.id
JOIN schools s ON a.current_school_id = s.id
LIMIT 20;
