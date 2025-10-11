# Mana Running - Product Roadmap

**Last Updated:** October 6, 2025

## Current Issues / Backlog

### HIGH PRIORITY - Course Page Enhancements

#### Top 5 Team Performances (IN PROGRESS - BLOCKED)
**Status:** Code implemented but not displaying data  
**Feature:** Display top 5 team performances (sum of top 5 runners) for each gender on course detail pages

**Current State:**
- Code committed and deployed (commit: 5330a6ae6709dbb25d6b3297646ec259747752f6)
- Location: `/app/courses/[id]/page.tsx`
- Functions: `loadTopTeamPerformances()` and rendering section (lines 702-815)
- **Issue:** Section not appearing on live site

**Known Problems:**
1. May not be finding teams with 5+ runners at same race
2. Gender filtering might not match data correctly
3. Grouping changed from meet+school to race+school but still not working

**Technical Details:**
```typescript
// Grouping key (fixed):
const key = `${result.race.id}_${result.athlete.school.id}`

// Conditions for display:
- Need 5+ runners from same school in same race
- Conditional render: {(boysTeams.length > 0 || girlsTeams.length > 0) && ...}
```

**Diagnostic Steps Needed:**
1. Add console logging to verify data is being fetched:
   ```typescript
   console.log('Processed results:', processedResults.length)
   console.log('Boys results:', boysResults.length)
   console.log('Boys team map size:', boysTeamMap.size)
   console.log('Boys performances:', boysTeamPerformances)
   ```

2. Check if ANY course has 5+ runners from one school in a single race
3. Verify race.gender field contains 'Boys'/'Girls' (not 'M'/'F')
4. Check browser console for JavaScript errors
5. Verify Supabase query returns expected data structure

**Next Steps:**
- [ ] Add diagnostic logging to production
- [ ] Query database directly to verify test case exists
- [ ] Consider showing section even with 0 results (with "No data" message)
- [ ] Add data validation and error handling
- [ ] Test with known course that has complete team results

---

## Medium Priority

### Database & Performance
- [ ] Add database indexes for performance
- [ ] Implement duplicate prevention in application code
- [ ] Complete Supabase Auth migration from deprecated helpers

### Course Features
- [ ] Course comparison tool
- [ ] Historical trends for course difficulty ratings
- [ ] Course maps integration

### Team/Coach Features
- [ ] Team selection optimization tool (already in progress)
- [ ] Championship projection calculator
- [ ] Season performance tracking dashboard

---

## Low Priority

### Data Import
- [ ] Automated meet result scraping
- [ ] Bulk import validation improvements
- [ ] Historical data backfill

### Analytics
- [ ] Advanced performance metrics
- [ ] Predictive race time modeling
- [ ] Cross-course time conversions

---

## Completed Features

✅ Individual course records by grade (9-12 + Overall)  
✅ Course difficulty ratings (mile_difficulty, xc_time_rating)  
✅ Meet listing with pagination  
✅ Athlete profile pages  
✅ School profile pages  
✅ Admin panel with delete functionality  
✅ Duplicate athlete cleanup (1,328 duplicates removed)  
✅ Unique constraint: (first_name, last_name, current_school_id, graduation_year)  
✅ Scalable database architecture (SQL functions for aggregation, no hard limits)  
✅ School XC records page with proper database-level queries

---

## Technical Debt

1. **Authentication Migration** - Update from deprecated Supabase auth helpers
2. **Error Handling** - Improve error messages and user feedback
3. **Loading States** - Better loading indicators throughout app
4. **Type Safety** - Reduce use of `any` types
5. **Code Organization** - Extract reusable components from large page files
6. **Query Scalability Audit** - Review all queries for .limit() usage and replace with SQL functions where needed

---

## Notes

### Team Performance Feature - Why It's Not Working
Despite multiple attempts to fix:
- Grouping logic changed from meet-based to race-based ✓
- Gender filtering logic in place ✓
- UI components properly structured ✓
- Build succeeds with no errors ✓

Likely causes:
- **Data availability:** May not have races with 5+ runners from same school
- **Data structure mismatch:** Gender field format or race relationships
- **Silent failure:** No error logging to diagnose issue

**Recommendation:** Add comprehensive logging first, then revisit after confirming test data exists.
