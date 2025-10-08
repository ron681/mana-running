## 2025-10-07
- **IDENTIFIED ISSUE**: `races.total_participants` field contains incorrect/stale values
  - Field exists but is not automatically maintained
  - No trigger exists to update count when results are inserted/updated/deleted
  - Historical data has accumulated inconsistencies
  - Solution: Create trigger to auto-maintain count + one-time data fix (see IMMEDIATE_ACTION_ITEMS.md #1)

- **DOCUMENTED**: Course-Race relationship structure
  - `courses.id` is primary key
  - `races.course_id` is foreign key to courses (nullable)
  - One course can have many races
  - Critical for course PRs, difficulty ratings, and performance tracking

- **RECOMMENDED**: Add missing database indexes for performance
  - `idx_races_course` on `races(course_id)` - for course-specific queries
  - Multiple other indexes documented in IMMEDIATE_ACTION_ITEMS.md #3

## 2025-10-02
- Migrated to @supabase/ssr for Supabase client in meets/[meetId]/page.tsx and races/[raceId]/page.tsx.
- Added meet deletion button to individual meet page with cascading deletion of races and results.