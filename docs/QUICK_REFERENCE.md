# MANA RUNNING - QUICK REFERENCE CARD

## 🔗 ESSENTIAL LINKS

**Production:** https://mana-running.vercel.app/  
**GitHub:** https://github.com/ron681/mana-running  
**Vercel Dashboard:** https://vercel.com/dashboard  
**Supabase Dashboard:** [Your Supabase URL]/project/_/editor

---

## ⚡ QUICK COMMANDS

```bash
# Development
npm run dev                    # Start local server (http://localhost:3000)
npm run build                  # Test production build
npm run lint                   # Check code quality

# Database
supabase db reset              # Reset local database
supabase db push               # Push migrations to remote
supabase migration new <name>  # Create new migration

# Deployment
git push origin main           # Auto-deploy to production
vercel logs                    # View deployment logs
```

---

## 🗄️ DATABASE QUICK QUERIES

### Check for Duplicates
```sql
SELECT first_name, last_name, current_school_id, graduation_year, COUNT(*)
FROM athletes
GROUP BY first_name, last_name, current_school_id, graduation_year
HAVING COUNT(*) > 1;
```

### Top 7 Varsity (Boys 5K)
```sql
SELECT a.first_name, a.last_name, AVG(r.finish_time) as avg_time
FROM results r
JOIN athletes a ON a.id = r.athlete_id
JOIN races ra ON ra.id = r.race_id
WHERE a.current_school_id = '<school-id>' 
  AND ra.distance = '5K' 
  AND ra.gender = 'M'
GROUP BY a.id, a.first_name, a.last_name
ORDER BY avg_time ASC
LIMIT 7;
```

### Athlete Race History
```sql
SELECT r.finish_time, r.place, m.name, m.date, ra.distance
FROM results r
JOIN races ra ON ra.id = r.race_id
JOIN meets m ON m.id = r.meet_id
WHERE r.athlete_id = '<athlete-id>'
ORDER BY m.date DESC;
```

### Find Course PRs
```sql
SELECT a.first_name, a.last_name, MIN(r.time_seconds) as pr
FROM results r
JOIN athletes a ON a.id = r.athlete_id
JOIN races ra ON ra.id = r.race_id
JOIN courses c ON c.id = ra.course_id
WHERE c.name = 'Crystal Springs'
GROUP BY a.id, a.first_name, a.last_name
ORDER BY pr ASC
LIMIT 10;
```

### Verify Race Participant Counts
```sql
-- Check races where stored count doesn't match actual results
SELECT 
  r.id,
  r.name,
  r.total_participants as stored_count,
  (SELECT COUNT(*) FROM results WHERE race_id = r.id) as actual_count,
  r.total_participants - (SELECT COUNT(*) FROM results WHERE race_id = r.id) as diff
FROM races r
WHERE r.total_participants IS NOT NULL
  AND r.total_participants != (SELECT COUNT(*) FROM results WHERE race_id = r.id)
ORDER BY ABS(r.total_participants - (SELECT COUNT(*) FROM results WHERE race_id = r.id)) DESC
LIMIT 20;
```

### Find Races by Course
```sql
SELECT r.id, r.name, r.gender, r.category, m.name as meet_name, m.meet_date
FROM races r
JOIN meets m ON m.id = r.meet_id
WHERE r.course_id = '<course-id>'
ORDER BY m.meet_date DESC;
```

---

## 🚨 CRITICAL CODE SNIPPETS

### Prevent Duplicate Athletes
```typescript
// ALWAYS check before creating athlete
const { data: existing } = await supabase
  .from('athletes')
  .select('id')
  .eq('first_name', firstName)
  .eq('last_name', lastName)
  .eq('current_school_id', schoolId)
  .eq('graduation_year', gradYear)
  .single();

if (existing) {
  return existing.id; // Use existing
}
// Only create if not found
```

### Validate Input Data
```typescript
// Graduation year: 2024-2030
if (gradYear < 2024 || gradYear > 2030) {
  throw new Error('Invalid graduation year');
}

// 5K time: 5:00 to 40:00 (in seconds)
if (finishTime < 300 || finishTime > 2400) {
  throw new Error('Invalid finish time');
}
```

---

## 🔍 TROUBLESHOOTING

### Duplicates Appearing?
1. Check constraint exists:
   ```sql
   SELECT constraint_name FROM information_schema.table_constraints
   WHERE table_name = 'athletes' AND constraint_name = 'athletes_unique_person';
   ```
2. Verify duplicate check in code (see above)
3. Check import scripts

### Slow Queries?
1. Check indexes exist:
   ```sql
   SELECT indexname, tablename FROM pg_indexes 
   WHERE schemaname = 'public' ORDER BY tablename;
   ```
2. Review query in Supabase → Database → Query Performance
3. Add LIMIT to large result sets

### Race Participant Counts Wrong?
1. Check if trigger exists:
   ```sql
   SELECT trigger_name FROM information_schema.triggers
   WHERE event_object_table = 'results'
     AND trigger_name = 'update_race_participants_trigger';
   ```
2. If missing, create trigger (see IMMEDIATE_ACTION_ITEMS.md)
3. Fix existing counts:
   ```sql
   UPDATE races r
   SET total_participants = (
     SELECT COUNT(*) FROM results WHERE race_id = r.id
   );
   ```

### Auth Errors?
1. Check environment variables in Vercel
2. Verify Supabase auth is not using deprecated helpers
3. Check redirect URLs in Supabase Dashboard

### Deployment Failed?
1. Check Vercel deployment logs
2. Verify build passes locally: `npm run build`
3. Check environment variables are set

---

## 📊 DATABASE STATS (Current)

**Athletes:** 4,477 unique  
**Constraint:** Active on (first_name, last_name, current_school_id, graduation_year)  
**Last Cleanup:** October 2025 (removed 1,328 duplicates)

---

## 🎯 COACHING QUICK ACCESS

### Team Performance This Season
```sql
SELECT 
  a.first_name || ' ' || a.last_name as athlete,
  COUNT(r.id) as races,
  AVG(r.finish_time) as avg_time,
  MIN(r.finish_time) as pr,
  MAX(r.place) as best_place
FROM results r
JOIN athletes a ON a.id = r.athlete_id
JOIN races ra ON ra.id = r.race_id
JOIN meets m ON m.id = r.meet_id
WHERE a.current_school_id = '<your-school-id>'
  AND ra.distance = '5K'
  AND ra.gender = 'M'
  AND m.date >= '2024-08-01'  -- Current season
GROUP BY a.id, a.first_name, a.last_name
ORDER BY avg_time ASC;
```

### Compare to Opponent
```sql
SELECT 
  s.name as school,
  COUNT(DISTINCT a.id) as runners,
  AVG(r.finish_time) as avg_time
FROM results r
JOIN athletes a ON a.id = r.athlete_id
JOIN schools s ON s.id = a.current_school_id
JOIN races ra ON ra.id = r.race_id
WHERE a.current_school_id IN ('<your-school>', '<opponent-school>')
  AND ra.distance = '5K'
  AND ra.gender = 'M'
GROUP BY s.name;
```

---

## 📁 IMPORTANT FILE PATHS

```
/app/layout.tsx                    # Root layout
/lib/supabase/client.ts           # Supabase browser client
/lib/supabase/server.ts           # Supabase server client
/components/ui/                    # shadcn/ui components
/app/api/                          # API routes
/supabase/migrations/              # Database migrations
/merge_athlete_duplicates.sql     # Duplicate cleanup script
```

---

## 🔐 ENVIRONMENT VARIABLES

Required in Vercel:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Check: Vercel Dashboard → Settings → Environment Variables

---

## 📚 DOCUMENTATION

**Full Summary:** `MANA_RUNNING_PROJECT_SUMMARY.md`  
**Action Items:** `IMMEDIATE_ACTION_ITEMS.md`  
**This Card:** `QUICK_REFERENCE.md`  
**GitHub README:** `README.md`

---

## ⏱️ PERFORMANCE TARGETS

- Page Load: < 2 seconds
- Query Time: < 500ms
- Lighthouse Score: > 90
- Uptime: 99.9%

---

**Last Updated:** October 2025  
**Keep this card accessible for daily reference**
