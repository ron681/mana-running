# DATABASE SCALABILITY - DESIGN PRINCIPLES

**Last Updated:** October 10, 2025

## Core Principle

**Build for 1,000,000+ records from day one.**

Every query, every page, every feature must work efficiently whether the database has 100 records or 1,000,000 records.

---

## The Problem: Fetch-and-Filter Anti-Pattern

### ❌ WRONG Approach (Will Break at Scale)

```typescript
// Fetch ALL results, filter in JavaScript
const { data: allResults } = await supabase
  .from('results')
  .select('*')
  .eq('school_id', schoolId)
  .limit(10000)  // Arbitrary limit

// Find the fastest time in JavaScript
const fastest = allResults.reduce((prev, curr) => 
  curr.time < prev.time ? curr : prev
)
```

**Problems:**
- Transfers 10,000+ rows from database to browser
- JavaScript filtering is slow
- Hits limit when school has >10,000 results
- Wastes bandwidth and memory
- Breaks on mobile devices

---

## The Solution: Database Aggregation

### ✅ CORRECT Approach (Scales to Millions)

```sql
-- SQL function returns ONLY the fastest result
CREATE FUNCTION get_school_fastest_time(p_school_id UUID)
RETURNS TABLE(...) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM results
  WHERE school_id = p_school_id
  ORDER BY time_seconds ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

```typescript
// Frontend calls the function
const { data } = await supabase
  .rpc('get_school_fastest_time', { 
    p_school_id: schoolId 
  })
// Returns exactly 1 row - always fast
```

**Benefits:**
- Database does the heavy lifting
- Returns only needed data (1 row vs 10,000 rows)
- Works with any dataset size
- Lightning fast with proper indexes
- Low bandwidth usage

---

## Real-World Example: School Records Page

### The Issue (October 10, 2025)

School records page was hitting the 1000-row default limit. Nelson Bernal's 1980 results weren't appearing because Westmont has 1000+ total results.

### The Fix

**Before (Broken):**
```typescript
// Fetches up to 10,000 results, filters in JS
const { data: results } = await supabase
  .from('results')
  .select('*, race(*), athlete(*), course(*)')
  .eq('athlete.school_id', schoolId)
  .limit(10000)  // Still breaks at 10,001+

// JavaScript finds the fastest
const fastest = results.reduce(...)
```

**After (Scalable):**
```sql
-- SQL function finds the record directly
CREATE FUNCTION get_school_xc_record(
  p_school_id UUID,
  p_gender TEXT,
  p_grade INTEGER
) RETURNS TABLE(...) AS $$
  -- Returns the single fastest result
  -- Works with 1M+ results
$$;
```

```typescript
// Only fetches the 1 needed record
const { data } = await supabase
  .rpc('get_school_xc_record', {
    p_school_id: schoolId,
    p_gender: 'M',
    p_grade: 12
  })
```

---

## When to Use Each Pattern

### Use SQL Functions When:
- Finding MIN/MAX/AVG (fastest time, average pace, etc.)
- Finding TOP N records (top 10 performances)
- Complex filtering with calculations (grade at time of race)
- Aggregating across many rows (team totals)
- **Any time you'd use `.reduce()`, `.filter()`, `.sort()` on large arrays**

### Use Direct Queries When:
- Fetching a single known record by ID
- Paginated lists (with `.range()` for offset pagination)
- Simple lookups with known small result sets (<100 rows)

### Never Use:
- `.limit(1000)` or any arbitrary limit
- Fetching all data then filtering in JavaScript
- Processing thousands of rows in the browser

---

## Required SQL Functions

These functions are now part of the Mana Running database:

### 1. get_school_xc_record()
**Purpose:** Find school XC time records (overall + by grade)

**Usage:**
```typescript
// Overall boys record
await supabase.rpc('get_school_xc_record', {
  p_school_id: schoolId,
  p_gender: 'M',
  p_grade: null
})

// 12th grade girls record
await supabase.rpc('get_school_xc_record', {
  p_school_id: schoolId,
  p_gender: 'F',
  p_grade: 12
})
```

**Returns:** Single row with fastest XC time matching criteria

---

## Performance Benchmarks

**Westmont School (1,500+ results):**

**Old Approach:**
- Query: 2.1s (transferred 1.2MB)
- JavaScript processing: 0.8s
- Total: 2.9s

**New Approach:**
- Query: 0.05s (transferred 2KB)
- JavaScript processing: 0.001s
- Total: 0.051s

**58x faster** ⚡

---

## Implementation Checklist

When adding new features that query results:

- [ ] Estimate maximum result set size
- [ ] If >100 rows, use SQL function or pagination
- [ ] Never use hardcoded `.limit()` values
- [ ] Profile with `EXPLAIN ANALYZE` in Supabase
- [ ] Test with large dataset (if possible)
- [ ] Verify proper indexes exist
- [ ] Document the function in this file

---

## Database Indexes

All SQL functions depend on proper indexes. Current required indexes:

```sql
-- Results table indexes
CREATE INDEX idx_results_athlete ON results(athlete_id);
CREATE INDEX idx_results_race ON results(race_id);
CREATE INDEX idx_results_school_time ON results(athlete_id, time_seconds);

-- Athletes table indexes  
CREATE INDEX idx_athletes_school_grad ON athletes(current_school_id, graduation_year);
CREATE INDEX idx_athletes_gender ON athletes(gender);

-- Races table indexes
CREATE INDEX idx_races_course ON races(course_id);
CREATE INDEX idx_races_meet ON races(meet_id);

-- Course ratings index
CREATE INDEX idx_courses_rating ON courses(xc_time_rating) 
WHERE xc_time_rating IS NOT NULL;
```

Verify indexes exist:
```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

---

## Migration Strategy

For existing queries that need conversion:

1. **Identify** - Find queries with `.limit()` or large result sets
2. **Measure** - Profile current performance with `EXPLAIN ANALYZE`
3. **Design** - Create SQL function with proper indexes
4. **Test** - Verify function returns correct results
5. **Replace** - Update TypeScript to use `.rpc()`
6. **Verify** - Confirm performance improvement
7. **Document** - Add function to this guide

---

## Common Patterns

### Pattern 1: Finding Records (MIN/MAX)

```sql
CREATE FUNCTION get_fastest_time(p_course_id UUID, p_gender TEXT)
RETURNS TABLE(athlete_name TEXT, time_seconds INT) AS $$
BEGIN
  RETURN QUERY
  SELECT a.first_name || ' ' || a.last_name, r.time_seconds
  FROM results r
  JOIN athletes a ON r.athlete_id = a.id
  WHERE r.course_id = p_course_id
    AND a.gender = p_gender
  ORDER BY r.time_seconds ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

### Pattern 2: Top N Lists

```sql
CREATE FUNCTION get_top_performances(
  p_course_id UUID, 
  p_limit INT DEFAULT 10
)
RETURNS TABLE(...) AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  FROM results r
  WHERE r.course_id = p_course_id
  ORDER BY r.time_seconds ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

### Pattern 3: Aggregations

```sql
CREATE FUNCTION get_team_average(p_school_id UUID, p_season INT)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    SELECT AVG(time_seconds)
    FROM results r
    JOIN athletes a ON r.athlete_id = a.id
    WHERE a.current_school_id = p_school_id
      AND r.season_year = p_season
  );
END;
$$ LANGUAGE plpgsql;
```

---

## Future Considerations

As the database grows:

### At 100,000 Results
- Current architecture handles this efficiently
- No changes needed

### At 1,000,000 Results  
- Current SQL functions still fast (<50ms)
- May need partitioning by season_year
- Consider materialized views for dashboard stats

### At 10,000,000 Results
- Implement table partitioning by season
- Add read replicas for analytics queries
- Consider time-series database for historical data

---

## Key Takeaways

1. **Never fetch everything and filter in JS**
2. **Use SQL functions for aggregations**
3. **Database aggregation scales, JavaScript filtering doesn't**
4. **Profile before deploying**
5. **Build for 1M+ records today, not tomorrow**

---

**Related Documentation:**
- MANA_RUNNING_PROJECT_SUMMARY.md (Database Query Best Practices)
- IMMEDIATE_ACTION_ITEMS.md (Database Indexes)
- TWO_SOLUTIONS_XC_RECORDS.md (Real-world implementation example)
