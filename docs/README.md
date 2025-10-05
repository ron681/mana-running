# Mana Running

**Production Cross Country Statistics Platform**

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://mana-running.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-green)](https://supabase.com/)

**Live:** https://mana-running.vercel.app/

The definitive XC statistics tool - like xcstats.com but with superior analytics and user experience.

## 🎯 Target Users

- **Coaches:** Team analysis, varsity selection, performance tracking, championship planning
- **Athletes:** Personal progress tracking, course PRs, season goals
- **Fans:** Meet results, school comparisons, historical data

## 🏗️ Tech Stack

- **Frontend:** Next.js 14, TypeScript, React Server Components
- **Backend:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS + shadcn/ui
- **Deployment:** Vercel (auto-deploy from `main`)

## 📊 Database Status

**Current:** 4,477 unique athletes (deduplicated October 2025)

**Unique Constraint Active:**
```sql
UNIQUE (first_name, last_name, current_school_id, graduation_year)
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Visit http://localhost:3000

## 📁 Project Structure

```
app/              # Next.js 14 app directory
components/       # React components
lib/              # Utilities & Supabase client
supabase/         # Database migrations
public/           # Static assets
```

## 🔧 Key Features

- Real-time race results
- Athlete performance tracking
- Team comparison analytics
- Course PR tracking
- Season progression charts
- Varsity selection tools

## 🐛 Critical Maintenance

### ⚠️ High Priority
- [ ] Migrate from deprecated Supabase auth helpers to `@supabase/ssr`
- [ ] Add database indexes for performance
- [ ] Implement duplicate athlete checks in all creation flows

### 📈 Performance
- [ ] Add indexes on `athletes`, `results`, `races`, `meets`
- [ ] Implement pagination on large datasets
- [ ] Optimize React Server Components

## 🔍 Common Queries

### Team Performance
```sql
SELECT a.first_name, a.last_name, AVG(r.finish_time) as avg_time
FROM results r
JOIN athletes a ON a.id = r.athlete_id
JOIN races ra ON ra.id = r.race_id
WHERE a.current_school_id = '<school-id>' AND ra.distance = '5K'
GROUP BY a.id
ORDER BY avg_time ASC LIMIT 7;
```

### Athlete Race History
```sql
SELECT r.finish_time, r.place, m.name, m.date
FROM results r
JOIN races ra ON ra.id = r.race_id
JOIN meets m ON m.id = r.meet_id
WHERE r.athlete_id = '<athlete-id>'
ORDER BY m.date DESC;
```

## 📝 Development Workflow

1. Create feature branch: `git checkout -b feature/name`
2. Make changes and test: `npm run dev`
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feature/name`
5. Merge to `main` → Auto-deploys to production

## 🔐 Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## 📚 Documentation

Full project summary: `/MANA_RUNNING_PROJECT_SUMMARY.md`

## 🆘 Support

- Check deployment logs: [Vercel Dashboard](https://vercel.com)
- Database errors: [Supabase Dashboard](https://supabase.com)
- File issues: [GitHub Issues](https://github.com/ron681/mana-running/issues)

---

**Status:** Production (Active Development)  
**Last Updated:** October 2025
