# MANA RUNNING - PROJECT SUMMARY & DEVELOPER GUIDE

## 🎯 PROJECT OVERVIEW

**Mana Running** is a production cross country statistics platform designed to become the definitive XC tool - like xcstats.com but with superior analytics and user experience.

**Live URL:** https://mana-running.vercel.app/

**GitHub Repository:** ron681/mana-running (main branch)

### Target Users
1. **Coaches:** Team analysis, varsity selection, performance tracking, championship planning
2. **Athletes:** Personal progress tracking, course PRs, season goals
3. **Fans:** Meet results, school comparisons, historical data

### Scalability Requirements
**Database Design Philosophy:** Build for 1,000,000+ records from day one
- **Never fetch-and-filter** - Use database aggregation and SQL functions
- **No arbitrary limits** - Queries must work regardless of dataset size
- **Server-side processing** - Heavy computations happen in PostgreSQL, not JavaScript
- **Indexed queries** - All common queries must use proper database indexes
- **Current scale:** 4,477 athletes, ~10,000+ results
- **Target scale:** 100,000+ athletes, 1,000,000+ results

**Example:** Finding school records should use a SQL function that returns 5-10 rows, not fetching 50,000+ results and processing in JavaScript.

---

## 🏗️ TECHNICAL ARCHITECTURE

### Core Stack
- **Frontend:** Next.js 14 with TypeScript, React Server Components
- **Backend:** Supabase (PostgreSQL) with real-time features
- **Styling:** Tailwind CSS with shadcn/ui components
- **Deployment:** Vercel with automatic GitHub integration
- **Authentication:** Supabase Auth (⚠️ needs migration from deprecated helpers)

### Database Structure (Key Tables)
- `athletes` - Athlete records with unique constraint
- `schools` - High school/team data
- `courses` - Cross country courses with ratings and difficulty
- `meets` - Meet/competition information
- `races` - Individual race events within meets (FK to meets, courses)
- `results` - Performance results (FK to athletes, races, meets)
- `school_transfers` - Athlete school transfer history (FK to athletes)

### Critical Relationships
```
courses (id) <--FK-- races (course_id)
meets (id) <--FK-- races (meet_id)
races (id) <--FK-- results (race_id)
athletes (id) <--FK-- results (athlete_id)
```

### Critical Constraints
```sql
-- Prevents duplicate athletes
ALTER TABLE athletes 
ADD CONSTRAINT athletes_unique_person 
UNIQUE (first_name, last_name, current_school_id, graduation_year);
```

### Database Query Best Practices (CRITICAL)

**Rule 1: Use SQL Functions for Aggregations**
```sql
-- ✅ CORRECT: Database does the work
SELECT * FROM get_school_xc_record('school-id', 'M', NULL);
-- Returns 1 row with the fastest XC time

-- ❌ WRONG: Fetching all data to JavaScript
SELECT * FROM results WHERE school_id = '...' LIMIT 10000;
-- Returns 10,000 rows, then filters in JavaScript
```

**Rule 2: Never Use Hard Limits**
```typescript
// ❌ WRONG: Will break at scale
.limit(1000)  // Breaks when >1000 results exist

// ✅ CORRECT: Use SQL aggregation
.rpc('get_top_performances', { school_id: '...', limit: 10 })
// Only returns the top 10, regardless of total rows
```

**Rule 3: Index All Common Query Patterns**
Every query in production should use an index. See `/docs/IMMEDIATE_ACTION_ITEMS.md` for required indexes.

**Rule 4: Pagination for Lists**
```typescript
// ✅ CORRECT: Paginate large lists
.range(startIndex, endIndex)

// ❌ WRONG: Fetch everything
.select('*')  // No limit at all
```

**Rule 5: Profile Before Deploying**
Use `EXPLAIN ANALYZE` in Supabase SQL Editor to verify query performance before deploying to production.

---

## 🚨 DEVELOPER COMMUNICATION STYLE (CRITICAL)

### User Expectations - NO EXCEPTIONS
- ❌ **NO praise or flattery** ("That's a great question", "Excellent idea")
- ✅ **Direct, actionable solutions immediately**
- ✅ **Step-by-step detailed instructions with exact file paths**
- ✅ **Technical accuracy over diplomatic language**
- ✅ **Performance-first mindset**
- ✅ **Comprehensive solutions, not partial examples**
- ✅ **Skip pleasantries, get straight to implementation**
- ✅ **Beginner-friendly instructions - user has less experience**

### Response Format
1. State the solution immediately
2. Provide exact file paths
3. Include complete code (no placeholders)
4. Add verification steps
5. No unnecessary explanations

---

## 📊 DATA INTEGRITY - DUPLICATE ATHLETE CLEANUP

### Issue Resolved (October 2025)
**Problem:** Massive athlete duplication in database
- Aaron Soni: 32 duplicate records
- Adrian Ketterer: 23 duplicate records
- Total: 5,805 athletes (1,328 were duplicates)

### Solution Implemented
**Result:** 5,805 → 4,477 unique athletes

**SQL Script:** `/merge_athlete_duplicates.sql`

**What Was Done:**
1. Identified duplicates by `(first_name, last_name, current_school_id, graduation_year)`
2. Kept oldest record (by `created_at`) for each unique athlete
3. Updated all `results` table foreign keys to point to kept athlete
4. Updated all `school_transfers` table foreign keys to point to kept athlete
5. Deleted 1,328 duplicate athlete records
6. Added unique constraint to prevent future duplicates

**Verification Queries:**
```sql
-- Check no duplicates remain (should return 0 rows)
SELECT first_name, last_name, current_school_id, graduation_year, COUNT(*) as count
FROM athletes
GROUP BY first_name, last_name, current_school_id, graduation_year
HAVING COUNT(*) > 1;

-- Verify results integrity (should return 0)
SELECT COUNT(*) FROM results r
LEFT JOIN athletes a ON a.id = r.athlete_id
WHERE a.id IS NULL;

-- Verify transfers integrity (should return 0)
SELECT COUNT(*) FROM school_transfers st
LEFT JOIN athletes a ON a.id = st.athlete_id
WHERE a.id IS NULL;
```

### Preventing Future Duplicates

**Application-Level Check (Required Before Athlete Creation):**
```typescript
// Check before inserting new athlete
const { data: existing } = await supabase
  .from('athletes')
  .select('id')
  .eq('first_name', firstName)
  .eq('last_name', lastName)
  .eq('current_school_id', schoolId)
  .eq('graduation_year', gradYear)
  .single();

if (existing) {
  // Use existing athlete ID instead of creating new
  return existing.id;
}

// Only create if doesn't exist
const { data: newAthlete } = await supabase
  .from('athletes')
  .insert({
    first_name: firstName,
    last_name: lastName,
    current_school_id: schoolId,
    graduation_year: gradYear
  })
  .select()
  .single();

return newAthlete.id;
```

**Add this check to:**
- Meet result import functions
- Manual athlete creation forms
- CSV upload processors
- API endpoints that create athletes

---

## ⚠️ KNOWN ISSUES & PENDING FIXES

### 1. Race Total Participants Count (CRITICAL)
**Status:** Identified October 2025  
**Issue:** The `total_participants` field on `races` table contains incorrect/stale values. This field should match the actual count of results for each race but is not automatically maintained.

**Impact:**
- Race statistics show wrong participant counts
- Course performance metrics may be inaccurate
- Team scoring calculations could be affected

**Root Cause:**
- No trigger to auto-update `total_participants` when results are inserted/updated/deleted
- Manual imports may not update this field
- Historical data has accumulated inconsistencies

**Solution:** See IMMEDIATE_ACTION_ITEMS.md #1 for complete fix (trigger creation + data update)

**Quick Verification:**
```sql
-- Find races with count mismatches
SELECT 
  r.id, r.name,
  r.total_participants as stored,
  (SELECT COUNT(*) FROM results WHERE race_id = r.id) as actual
FROM races r
WHERE r.total_participants != (SELECT COUNT(*) FROM results WHERE race_id = r.id)
LIMIT 10;
```

### 2. Course-Race Relationship
**Status:** Working correctly  
**Note:** The `races` table has `course_id` (FK to `courses.id`). This relationship is critical for:
- Course performance tracking
- Course difficulty ratings
- Course-specific PRs
- Historical course comparisons

**Schema:**
- `courses.id` → Primary key
- `races.course_id` → Foreign key to courses
- One course can have many races
- Each race is associated with one course (nullable)

---

## 🔧 CRITICAL MAINTENANCE TASKS

### 1. Supabase Auth Migration (HIGH PRIORITY)
**Status:** Not started
**Issue:** Using deprecated Supabase auth helpers
**Action Required:**
- Migrate to `@supabase/ssr` package
- Update all auth middleware
- Test authentication flows

**Migration Guide:**
```bash
# Install new package
npm install @supabase/ssr

# Remove deprecated package
npm uninstall @supabase/auth-helpers-nextjs
```

Update auth client creation:
```typescript
// OLD (deprecated)
import { createClientComponentClient } from '@/lib/supabase/client'

// NEW
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### 2. Database Indexing (PERFORMANCE)
**Recommended Indexes:**
```sql
-- Speed up athlete lookups
CREATE INDEX IF NOT EXISTS idx_athletes_school_grad 
ON athletes(current_school_id, graduation_year);

-- Speed up results queries
CREATE INDEX IF NOT EXISTS idx_results_athlete 
ON results(athlete_id);

CREATE INDEX IF NOT EXISTS idx_results_race 
ON results(race_id);

CREATE INDEX IF NOT EXISTS idx_results_meet 
ON results(meet_id);

-- Speed up meet searches
CREATE INDEX IF NOT EXISTS idx_meets_date 
ON meets(meet_date DESC);

-- Speed up race queries
CREATE INDEX IF NOT EXISTS idx_races_meet 
ON races(meet_id);

CREATE INDEX IF NOT EXISTS idx_races_course 
ON races(course_id);
```

### 3. Data Validation Rules
**Implement these checks:**
- Graduation year must be 2024-2030 (current valid range)
- Race times must be positive and realistic (5:00 - 40:00 for 5K)
- Meet dates cannot be in future (except scheduled meets)
- School IDs must reference existing schools

---

## 📁 PROJECT STRUCTURE

```
mana-running/
├── app/                    # Next.js 14 app directory
│   ├── (auth)/            # Auth-related pages
│   ├── (dashboard)/       # Main app pages
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/
│   ├── ui/                # shadcn/ui components
│   └── custom/            # Custom components
├── lib/
│   ├── supabase/          # Supabase clients
│   ├── utils/             # Utility functions
│   └── types/             # TypeScript types
├── public/                # Static assets
└── supabase/
    ├── migrations/        # Database migrations
    └── seed.sql           # Seed data
```

---

## 🚀 DEPLOYMENT

### Automatic Deployment
- **Trigger:** Push to `main` branch in `ron681/mana-running`
- **Platform:** Vercel
- **URL:** https://mana-running.vercel.app/
- **Build Command:** `npm run build`
- **Output Directory:** `.next`

### Environment Variables (Vercel)
```bash
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Manual Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

---

## 🔍 COMMON QUERIES

### Find Athletes by School
```sql
SELECT a.*, s.name as school_name
FROM athletes a
JOIN schools s ON s.id = a.current_school_id
WHERE s.name ILIKE '%Westmont%'
ORDER BY a.last_name, a.first_name;
```

### Get Athlete's Race Results
```sql
SELECT 
  r.finish_time,
  r.place,
  m.name as meet_name,
  m.date,
  ra.distance,
  ra.gender
FROM results r
JOIN races ra ON ra.id = r.race_id
JOIN meets m ON m.id = r.meet_id
WHERE r.athlete_id = '<athlete-id>'
ORDER BY m.date DESC;
```

### Team Performance Analysis
```sql
SELECT 
  a.first_name,
  a.last_name,
  AVG(r.finish_time) as avg_time,
  COUNT(r.id) as race_count,
  MIN(r.finish_time) as pr
FROM results r
JOIN athletes a ON a.id = r.athlete_id
JOIN races ra ON ra.id = r.race_id
WHERE a.current_school_id = '<school-id>'
  AND ra.distance = '5K'
  AND ra.gender = 'M'
GROUP BY a.id, a.first_name, a.last_name
ORDER BY avg_time ASC
LIMIT 7;  -- Top 7 for varsity
```

### Find Course PRs
```sql
SELECT 
  a.first_name,
  a.last_name,
  MIN(r.finish_time) as pr,
  m.course_name
FROM results r
JOIN athletes a ON a.id = r.athlete_id
JOIN meets m ON m.id = r.meet_id
WHERE m.course_name = 'Crystal Springs'
GROUP BY a.id, a.first_name, a.last_name, m.course_name
ORDER BY pr ASC;
```

---

## 🐛 TROUBLESHOOTING

### Duplicate Athletes Appearing Again
**Check:**
1. Is unique constraint active?
   ```sql
   SELECT constraint_name FROM information_schema.table_constraints
   WHERE table_name = 'athletes' AND constraint_name = 'athletes_unique_person';
   ```
2. Are you running duplicate checks before INSERT?
3. Check import scripts for duplicate creation logic

### Performance Issues
**Quick Fixes:**
1. Check if indexes exist (see Database Indexing section)
2. Review slow queries in Supabase Dashboard → Database → Query Performance
3. Consider pagination for large result sets
4. Use React Server Components for data fetching

### Authentication Errors
**Common Issues:**
1. Deprecated auth helpers (see Migration section)
2. Missing environment variables
3. Incorrect redirect URLs in Supabase Dashboard

---

## 📈 ROADMAP & NEXT STEPS

### Immediate (Week 1-2)
- [ ] Migrate Supabase Auth to `@supabase/ssr`
- [ ] Add database indexes for performance
- [ ] Implement athlete duplicate check in all creation flows
- [ ] Add data validation on form inputs

### Short-term (Month 1)
- [ ] Build team comparison dashboard
- [ ] Add course PR tracking feature
- [ ] Create varsity selection tool
- [ ] Implement season progression charts

### Medium-term (Quarter 1)
- [ ] Advanced analytics (pace analysis, splits)
- [ ] Championship meet predictor
- [ ] Mobile app (React Native)
- [ ] Coach collaboration tools

### Long-term (Year 1)
- [ ] Historical data import (past 10 years)
- [ ] Machine learning performance predictions
- [ ] Integration with timing systems
- [ ] National rankings database

---

## 📚 DOCUMENTATION LINKS

### External Resources
- **Next.js 14:** https://nextjs.org/docs
- **Supabase Docs:** https://supabase.com/docs
- **shadcn/ui:** https://ui.shadcn.com/
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Vercel Deployment:** https://vercel.com/docs

### Internal Documentation
- Database Schema: `/supabase/migrations/`
- API Routes: `/app/api/`
- Component Library: `/components/ui/`

---

## 🔐 ACCESS & CREDENTIALS

### Repositories
- **GitHub:** https://github.com/ron681/mana-running
- **Branch:** main (auto-deploys to production)

### Services
- **Vercel Project:** mana-running.vercel.app
- **Supabase Project:** [Your Supabase project URL]

### Team Roles
- **Head Coach/Developer:** Full access to all systems
- **Assistant Coaches:** Read-only database access (future)
- **Athletes:** Limited UI access for personal stats (future)

---

## 📝 DEVELOPMENT WORKFLOW

### Making Changes
1. Create feature branch from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make changes and test locally
   ```bash
   npm run dev
   ```

3. Commit with descriptive messages
   ```bash
   git add .
   git commit -m "feat: add athlete PR tracking"
   ```

4. Push and create PR
   ```bash
   git push origin feature/your-feature-name
   ```

5. Merge to `main` → Auto-deploys to production

### Database Changes
1. Create migration file
   ```bash
   supabase migration new your_migration_name
   ```

2. Write SQL in migration file

3. Test locally
   ```bash
   supabase db reset
   ```

4. Push to remote
   ```bash
   supabase db push
   ```

---

## ⚡ QUICK REFERENCE

### Useful Commands
```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run lint            # Run ESLint

# Database
supabase start          # Start local Supabase
supabase db reset       # Reset local DB
supabase db push        # Push migrations to remote

# Deployment
vercel --prod           # Deploy to production
vercel env pull         # Pull environment variables
```

### Important File Paths
```
/app/layout.tsx                    # Root layout
/lib/supabase/client.ts           # Supabase client
/components/ui/                    # UI components
/app/api/                          # API routes
/supabase/migrations/              # DB migrations
/merge_athlete_duplicates.sql     # Duplicate cleanup script
```

### Database Connection Strings
```bash
# Local (Supabase CLI running)
postgresql://postgres:postgres@localhost:54322/postgres

# Remote (from Supabase Dashboard → Settings → Database)
[Your connection string]
```

---

## 🎓 COACHING CONTEXT

**Head Cross Country & Track Coach** - High School level
- Need quick access to athlete performance data
- Championship meet planning and varsity selection
- Performance tracking and goal setting
- Course strategy based on historical data

**Key Coaching Features Needed:**
1. Team performance comparison (my athletes vs competitors)
2. Course-specific PR tracking
3. Season progression visualization
4. Varsity lineup optimizer based on recent performance
5. Championship meet predictions

---

## 📊 SUCCESS METRICS

### Current Status (October 2025)
- ✅ 4,477 unique athletes in database
- ✅ Duplicate prevention system active
- ✅ Production deployment stable
- ⏳ Auth migration pending
- ⏳ Performance optimization pending

### Target Metrics (6 months)
- 10,000+ athletes
- 100+ schools
- <500ms average page load
- 99.9% uptime
- 50+ active coaches using platform

---

## 🆘 SUPPORT & CONTACT

### Technical Issues
1. Check this document first
2. Review Vercel deployment logs
3. Check Supabase Dashboard for errors
4. Review GitHub Issues

### Feature Requests
- Document in GitHub Issues with `enhancement` label
- Include use case and coaching context
- Priority based on coaching needs

---

**Last Updated:** October 2025
**Version:** 1.0
**Status:** Production (Active Development)
