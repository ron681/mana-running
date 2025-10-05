# MANA RUNNING - IMMEDIATE ACTION ITEMS

## ✅ COMPLETED (October 2025)

### Database Cleanup
- [x] Identified 1,328 duplicate athlete records
- [x] Merged duplicates (5,805 → 4,477 athletes)
- [x] Updated all foreign key references (results, school_transfers)
- [x] Added unique constraint: `(first_name, last_name, current_school_id, graduation_year)`
- [x] Verified data integrity (0 orphaned records)

---

## 🔴 CRITICAL - DO IMMEDIATELY

### 1. Prevent Future Duplicates in Application Code
**Priority:** CRITICAL  
**Time:** 30 minutes

Add duplicate check before every athlete creation:

**Files to Update:**
- Any import/upload scripts
- Admin athlete creation forms
- API endpoints that create athletes
- Meet result processors

**Code to Add:**
```typescript
// Before inserting athlete
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

// Create new only if not found
```

**Where to add this:**
- [ ] Meet import function
- [ ] Manual athlete creation form
- [ ] CSV upload processor
- [ ] Any other athlete creation points

### 2. Add Database Indexes
**Priority:** HIGH  
**Time:** 5 minutes

Massive performance improvement with these indexes:

```sql
-- Run in Supabase SQL Editor

-- Speed up athlete lookups
CREATE INDEX idx_athletes_school_grad 
ON athletes(current_school_id, graduation_year);

-- Speed up results queries
CREATE INDEX idx_results_athlete ON results(athlete_id);
CREATE INDEX idx_results_race ON results(race_id);
CREATE INDEX idx_results_meet ON results(meet_id);

-- Speed up meet searches
CREATE INDEX idx_meets_date ON meets(date DESC);

-- Speed up race queries
CREATE INDEX idx_races_meet ON races(meet_id);
```

**Action:**
- [ ] Copy SQL above
- [ ] Run in Supabase Dashboard → SQL Editor
- [ ] Verify with: `\di` to list indexes

### 3. Migrate Supabase Auth
**Priority:** HIGH  
**Time:** 1-2 hours

Current auth helpers are deprecated.

**Step 1: Install new package**
```bash
npm install @supabase/ssr
npm uninstall @supabase/auth-helpers-nextjs
```

**Step 2: Update client creation**

Find all files using:
```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
```

Replace with:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**Files likely to update:**
- [ ] `/lib/supabase/client.ts`
- [ ] `/lib/supabase/server.ts`
- [ ] Any auth middleware
- [ ] Login/signup pages

**Step 3: Test**
- [ ] Login flow
- [ ] Logout flow
- [ ] Protected routes
- [ ] Session persistence

---

## 🟡 IMPORTANT - DO THIS WEEK

### 4. Add Data Validation
**Priority:** MEDIUM  
**Time:** 1 hour

Prevent bad data entry:

```typescript
// Graduation year validation
if (gradYear < 2024 || gradYear > 2030) {
  throw new Error('Invalid graduation year');
}

// Race time validation (5K in seconds: 5:00 to 40:00)
if (finishTime < 300 || finishTime > 2400) {
  throw new Error('Invalid finish time');
}

// Meet date validation
if (meetDate > new Date()) {
  throw new Error('Meet date cannot be in future');
}
```

**Add to:**
- [ ] Athlete creation forms
- [ ] Result upload processing
- [ ] Meet creation forms
- [ ] API validation middleware

### 5. Update Project Documentation
**Priority:** MEDIUM  
**Time:** 15 minutes

- [ ] Add `README.md` to root of GitHub repo
- [ ] Add `MANA_RUNNING_PROJECT_SUMMARY.md` to repo `/docs` folder
- [ ] Update `.env.example` with all required variables
- [ ] Add `/docs` folder structure:
  ```
  docs/
  ├── MANA_RUNNING_PROJECT_SUMMARY.md
  ├── DATABASE_SCHEMA.md
  ├── API_DOCUMENTATION.md
  └── DEPLOYMENT_GUIDE.md
  ```

### 6. Set Up Error Monitoring
**Priority:** MEDIUM  
**Time:** 30 minutes

Add Sentry or similar:

```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

Configure in `sentry.client.config.ts`:
```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

---

## 🟢 NICE TO HAVE - DO THIS MONTH

### 7. Performance Optimization
- [ ] Implement React Server Components for data fetching
- [ ] Add pagination to large result sets
- [ ] Optimize image loading with Next.js Image
- [ ] Enable Vercel Analytics
- [ ] Set up edge caching for static pages

### 8. Testing Infrastructure
- [ ] Add Vitest for unit tests
- [ ] Add Playwright for E2E tests
- [ ] Set up GitHub Actions CI/CD
- [ ] Add test coverage reporting

### 9. User Features
- [ ] Athlete dashboard (personal stats)
- [ ] Team comparison tool
- [ ] Course PR tracker
- [ ] Season progression charts
- [ ] Championship meet predictor

---

## 📋 VERIFICATION CHECKLIST

After completing critical items, verify:

### Database Health
```sql
-- No duplicates (should return 0)
SELECT COUNT(*) FROM (
  SELECT first_name, last_name, current_school_id, graduation_year
  FROM athletes
  GROUP BY first_name, last_name, current_school_id, graduation_year
  HAVING COUNT(*) > 1
) as dupes;

-- All indexes exist (should return 6+)
SELECT COUNT(*) FROM pg_indexes 
WHERE schemaname = 'public';

-- No orphaned results (should return 0)
SELECT COUNT(*) FROM results r
LEFT JOIN athletes a ON a.id = r.athlete_id
WHERE a.id IS NULL;
```

### Application Health
- [ ] All pages load without errors
- [ ] Authentication works (login/logout)
- [ ] Data displays correctly
- [ ] Forms validate input
- [ ] No console errors in browser
- [ ] Mobile responsive design works

### Performance
- [ ] Page load < 2 seconds
- [ ] Query execution < 500ms
- [ ] Lighthouse score > 90
- [ ] No memory leaks (check DevTools)

---

## 🔄 RECURRING TASKS

### Daily
- Check Vercel deployment status
- Review error logs in Supabase
- Monitor database size

### Weekly
- Review new athlete additions for duplicates
- Check query performance
- Update documentation if needed

### Monthly
- Database backup verification
- Security updates (`npm audit fix`)
- Performance review
- Feature planning

---

## 📞 QUICK CONTACTS

### When Things Break
1. **Deployment Issues:** Check Vercel Dashboard
2. **Database Issues:** Check Supabase Dashboard → Logs
3. **Auth Issues:** Verify environment variables
4. **Performance Issues:** Check database indexes exist

### Useful Commands
```bash
# Check for duplicates
npm run check-duplicates

# Run migrations
supabase db push

# Deploy to production
git push origin main  # Auto-deploys

# Check logs
vercel logs [deployment-url]
```

---

**Priority Guide:**
- 🔴 CRITICAL = Do today (data integrity, security)
- 🟡 IMPORTANT = Do this week (performance, UX)
- 🟢 NICE TO HAVE = Do this month (features, optimization)

**Next Review:** 1 week from today
