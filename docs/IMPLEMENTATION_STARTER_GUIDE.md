# SCHOOLS PAGE - IMPLEMENTATION STARTER GUIDE

## Phase 1: Athletes Section - First Steps

This guide will walk you through implementing the Athletes section as your first task.

---

## Step 1: Create File Structure

Create these new files in your project:

```
src/app/schools/[id]/
├── page.tsx (already exists - Overview)
├── athletes/
│   ├── page.tsx (NEW - Athletes list)
│   └── [athleteId]/
│       └── page.tsx (NEW - Individual athlete page)
├── records/
│   └── page.tsx (NEW - School records)
└── seasons/
    └── page.tsx (NEW - Season history)
```

---

## Step 2: Add Navigation Tabs

**File:** `src/app/schools/[id]/layout.tsx` (create if doesn't exist)

```typescript
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const pathname = usePathname()
  
  const tabs = [
    { name: 'Overview', href: `/schools/${params.id}` },
    { name: 'Athletes', href: `/schools/${params.id}/athletes` },
    { name: 'School Records', href: `/schools/${params.id}/records` },
    { name: 'Season History', href: `/schools/${params.id}/seasons` },
  ]

  return (
    <div>
      <nav className="border-b border-gray-200 mb-6">
        <div className="flex space-x-4">
          {tabs.map((tab) => (
            <Link
              key={tab.name}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                pathname === tab.href
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.name}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  )
}
```

---

## Step 3: Create Athletes List Page

**File:** `src/app/schools/[id]/athletes/page.tsx`

```typescript
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AthletesPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createServerClient()

  // Get school info
  const { data: school } = await supabase
    .from('schools')
    .select('id, name')
    .eq('id', params.id)
    .single()

  if (!school) {
    notFound()
  }

  // Get all athletes for this school
  const { data: athletes } = await supabase
    .from('athletes')
    .select(`
      id,
      first_name,
      last_name,
      gender,
      graduation_year,
      results (count)
    `)
    .eq('current_school_id', params.id)
    .order('last_name')

  // Separate by gender
  const boysAthletes = athletes?.filter(a => a.gender === 'M') || []
  const girlsAthletes = athletes?.filter(a => a.gender === 'F') || []

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">{school.name}</h1>
      <h2 className="text-xl text-gray-600 mb-6">Athletes</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Boys Athletes */}
        <div>
          <h3 className="text-xl font-bold mb-4 text-blue-600">
            Boys ({boysAthletes.length})
          </h3>
          <div className="space-y-2">
            {boysAthletes.map((athlete) => (
              <Link
                key={athlete.id}
                href={`/schools/${params.id}/athletes/${athlete.id}`}
                className="block p-4 border rounded-lg hover:bg-blue-50 transition"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">
                      {athlete.first_name} {athlete.last_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Class of {athlete.graduation_year}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {athlete.results?.[0]?.count || 0} races
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Girls Athletes */}
        <div>
          <h3 className="text-xl font-bold mb-4 text-pink-600">
            Girls ({girlsAthletes.length})
          </h3>
          <div className="space-y-2">
            {girlsAthletes.map((athlete) => (
              <Link
                key={athlete.id}
                href={`/schools/${params.id}/athletes/${athlete.id}`}
                className="block p-4 border rounded-lg hover:bg-pink-50 transition"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">
                      {athlete.first_name} {athlete.last_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Class of {athlete.graduation_year}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {athlete.results?.[0]?.count || 0} races
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Step 4: Create Individual Athlete Page (Basic)

**File:** `src/app/schools/[id]/athletes/[athleteId]/page.tsx`

```typescript
import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatTime } from '@/lib/timeConverter'

export default async function AthletePage({
  params,
}: {
  params: { id: string; athleteId: string }
}) {
  const supabase = createServerClient()

  // Get athlete info
  const { data: athlete } = await supabase
    .from('athletes')
    .select(`
      id,
      first_name,
      last_name,
      gender,
      graduation_year,
      current_school_id,
      schools (name)
    `)
    .eq('id', params.athleteId)
    .single()

  if (!athlete) {
    notFound()
  }

  // Get all results for this athlete
  const { data: results } = await supabase
    .from('results')
    .select(`
      id,
      time_seconds,
      place_overall,
      season_year,
      race_id,
      races!inner (
        id,
        meet_id,
        course_id,
        meets (
          name,
          meet_date
        ),
        courses (
          name,
          distance_meters,
          xc_time_rating
        )
      )
    `)
    .eq('athlete_id', params.athleteId)
    .order('races.meets.meet_date', { ascending: false })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {athlete.first_name} {athlete.last_name}
        </h1>
        <div className="flex gap-4 text-gray-600 mt-2">
          <span>Class of {athlete.graduation_year}</span>
          <span>•</span>
          <span>{athlete.gender === 'M' ? 'Boys' : 'Girls'}</span>
          <span>•</span>
          <span>{athlete.schools.name}</span>
        </div>
      </div>

      {/* TODO: Add progression chart here */}

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Race Results</h2>
        <div className="space-y-2">
          {results?.map((result) => {
            const meet = result.races.meets
            const course = result.races.courses
            const xcTime = result.time_seconds * course.xc_time_rating

            return (
              <div
                key={result.id}
                className="p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{meet.name}</div>
                    <div className="text-sm text-gray-600">{course.name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(meet.meet_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {formatTime(result.time_seconds)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Place: {result.place_overall}
                    </div>
                    <div className="text-xs text-gray-500">
                      XC Time: {formatTime(xcTime)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

---

## Step 5: Test the Basic Structure

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to a school page:**
   ```
   http://localhost:3000/schools/[some-school-id]
   ```

3. **Verify:**
   - [ ] Navigation tabs appear
   - [ ] Can click "Athletes" tab
   - [ ] Athletes list loads (boys and girls separate)
   - [ ] Can click an athlete name
   - [ ] Individual athlete page loads with race results

---

## Step 6: Add Progression Chart (Next Step)

After basic structure works, add Recharts for visualization:

```bash
npm install recharts
```

Then add the line chart component (see SCHOOLS_PAGE_ROADMAP.md for details).

---

## Common Issues & Solutions

### Issue: "Cannot find module '@/lib/supabase/server'"
**Solution:** Make sure this file exists. If not, create it:

```typescript
// src/lib/supabase/server.ts
import { createServerClient as createClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createServerClient = () => {
  const cookieStore = cookies()

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

### Issue: "formatTime is not defined"
**Solution:** Import from your time converter utility or create it:

```typescript
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(2).padStart(5, '0')}`
}
```

### Issue: Navigation tabs not showing
**Solution:** Make sure `layout.tsx` is in the correct folder and uses the right pathname.

---

## What This Gives You

After completing these steps, you'll have:

✅ Navigation tabs on school pages  
✅ Athletes list page (separated by gender)  
✅ Individual athlete pages with race history  
✅ Clickable links between pages  
✅ Foundation for adding charts and PRs

---

## Next Steps After Basic Structure Works

1. Add progression chart (Recharts)
2. Add Course PRs section
3. Add improvement metrics
4. Add season filters
5. Polish the UI

See `/docs/SCHOOLS_PAGE_ROADMAP.md` for complete details on each feature.

---

**Start Here:** Create the file structure and navigation  
**Then:** Add the Athletes list page  
**Finally:** Test before moving to charts and PRs  

Take it step by step. Get the basic structure working first, then add the fancy features.
