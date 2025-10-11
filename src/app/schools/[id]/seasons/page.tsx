// src/app/schools/[id]/seasons/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@/lib/supabase/client'
import { schoolCRUD } from '@/lib/crud-operations'

interface School {
  id: string
  name: string
  state?: string
}

interface SeasonSummary {
  year: number
  athlete_count: number
  race_count: number
  boys_count: number
  girls_count: number
}

interface Props {
  params: {
    id: string
  }
}

export default function SeasonsPage({ params }: Props) {
  const [school, setSchool] = useState<School | null>(null)
  const [seasons, setSeasons] = useState<SeasonSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClientComponentClient()

  useEffect(() => {
    loadData()
  }, [params.id])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load school details
      const schoolData = await schoolCRUD.getAll()
      const currentSchool = schoolData?.find(s => s.id === params.id)
      
      if (!currentSchool) {
        throw new Error('School not found')
      }
      
      setSchool(currentSchool)

      // Load season summaries
      const { data: results, error: resultsError } = await supabase
        .from('results')
        .select(`
          season_year,
          athlete_id,
          race_id,
          athletes!inner (
            current_school_id,
            gender
          )
        `)
        .eq('athletes.current_school_id', params.id)

      if (resultsError) throw resultsError

      // Group by season and calculate summaries
      const seasonMap = new Map<number, {
        athletes: Set<string>
        races: Set<string>
        boys: Set<string>
        girls: Set<string>
      }>()

      results?.forEach(result => {
        const athlete = Array.isArray(result.athletes) ? result.athletes[0] : result.athletes
        if (!result.season_year || !athlete) return

        if (!seasonMap.has(result.season_year)) {
          seasonMap.set(result.season_year, {
            athletes: new Set(),
            races: new Set(),
            boys: new Set(),
            girls: new Set()
          })
        }

        const season = seasonMap.get(result.season_year)!
        season.athletes.add(result.athlete_id)
        season.races.add(result.race_id)

        if (athlete.gender === 'M' || athlete.gender === 'Boys') {
          season.boys.add(result.athlete_id)
        } else if (athlete.gender === 'F' || athlete.gender === 'Girls') {
          season.girls.add(result.athlete_id)
        }
      })

      // Convert to array and sort by year (newest first)
      const seasonSummaries: SeasonSummary[] = Array.from(seasonMap.entries())
        .map(([year, data]) => ({
          year,
          athlete_count: data.athletes.size,
          race_count: data.races.size,
          boys_count: data.boys.size,
          girls_count: data.girls.size
        }))
        .sort((a, b) => b.year - a.year)

      setSeasons(seasonSummaries)
    } catch (err) {
      console.error('Error loading seasons:', err)
      setError('Failed to load season data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Seasons...</div>
          <div className="text-gray-600">Getting season history...</div>
        </div>
      </div>
    )
  }

  if (error || !school) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-xl font-semibold mb-2 text-red-600">Error</div>
          <div className="text-gray-600 mb-4">{error || 'School not found'}</div>
          <a 
            href="/schools"
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Back to Schools
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <nav className="text-sm text-gray-600">
            <a href="/" className="hover:text-red-600">Home</a>
            <span className="mx-2">/</span>
            <a href="/schools" className="hover:text-red-600">Schools</a>
            <span className="mx-2">/</span>
            <a href={`/schools/${school.id}`} className="hover:text-red-600">{school.name}</a>
            <span className="mx-2">/</span>
            <span className="text-black font-medium">Seasons</span>
          </nav>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h1 className="text-3xl font-bold text-black mb-2">{school.name}</h1>
          <p className="text-lg text-gray-600">Season History</p>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <a 
                href={`/schools/${school.id}`}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300"
              >
                Athletes
              </a>
              <a 
                href={`/schools/${school.id}/records`}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300"
              >
                Records & PRs
              </a>
              <div className="px-6 py-4 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                Seasons
              </div>
              <a 
                href={`/schools/${school.id}/results`}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300"
              >
                All Results
              </a>
            </nav>
          </div>
        </div>

        {/* Seasons List */}
        {seasons.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-500 mb-4">No season data available.</div>
            <div className="text-sm text-gray-400">
              Race results will appear here once they are added.
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-black">Available Seasons</h2>
              <p className="text-gray-600 mt-1">
                Click on a season to view team selection, performance analysis, and detailed results
              </p>
            </div>
            
            <div className="divide-y">
              {seasons.map((season) => (
                <a
                  key={season.year}
                  href={`/schools/${school.id}/seasons/${season.year}`}
                  className="block p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-black mb-2">
                        {season.year}-{season.year + 1} Season
                      </h3>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-semibold">{season.athlete_count}</span> athletes
                        </div>
                        <div>
                          <span className="font-semibold">{season.race_count}</span> races
                        </div>
                        {season.boys_count > 0 && (
                          <div>
                            <span className="font-semibold text-blue-600">{season.boys_count}</span> boys
                          </div>
                        )}
                        {season.girls_count > 0 && (
                          <div>
                            <span className="font-semibold text-pink-600">{season.girls_count}</span> girls
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ml-6">
                      <span className="text-red-600 font-semibold">View Season →</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-6">
          <a 
            href={`/schools/${school.id}`}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
          >
            ← Back to {school.name}
          </a>
        </div>
      </div>
    </div>
  )
}
