// src/components/TeamSelectionTable.tsx
'use client'

import React, { useState } from 'react'
import { formatTime } from '@/lib/utils'
import { ChevronUpIcon, ChevronDownIcon, ChevronRightIcon, ChevronDownIcon as ChevronDownExpandIcon } from 'lucide-react'

interface AthleteRanking {
  athlete_id: string
  athlete_name: string
  gender: string
  graduation_year: number
  season_pr: number | null
  top_3_average: number | null
  last_3_average: number | null
  race_count: number
  recent_races: { time: number; date: string; meet_name: string }[]
}

interface TeamSelectionTableProps {
  title: string
  athletes: AthleteRanking[]
  gender: string
}

type SortField = 'name' | 'grad_year' | 'season_pr' | 'top_3_average' | 'last_3_average' | 'race_count'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  field: SortField
  direction: SortDirection
}

export default function TeamSelectionTable({ title, athletes, gender }: TeamSelectionTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'season_pr',
    direction: 'asc'
  })
  const [expandedAthlete, setExpandedAthlete] = useState<string | null>(null)

  const sortAthletes = (athletes: AthleteRanking[], sortConfig: SortConfig): AthleteRanking[] => {
    return [...athletes].sort((a, b) => {
      let aVal: any = sortConfig.field === 'name' ? a.athlete_name : 
                     sortConfig.field === 'grad_year' ? a.graduation_year :
                     a[sortConfig.field]
      let bVal: any = sortConfig.field === 'name' ? b.athlete_name :
                     sortConfig.field === 'grad_year' ? b.graduation_year :
                     b[sortConfig.field]
      
      // Handle null values for time fields
      if (sortConfig.field !== 'name' && sortConfig.field !== 'race_count' && sortConfig.field !== 'grad_year') {
        if (aVal === null && bVal === null) return 0
        if (aVal === null) return 1
        if (bVal === null) return -1
      }
      
      if (sortConfig.field === 'name') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }
      
      let comparison = 0
      if (aVal < bVal) comparison = -1
      if (aVal > bVal) comparison = 1
      
      return sortConfig.direction === 'desc' ? -comparison : comparison
    })
  }

  const handleSort = (field: SortField) => {
    const newDirection = sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    setSortConfig({ field, direction: newDirection })
  }

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <div className="w-4 h-4" />
    }
    
    return sortConfig.direction === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4" />
    ) : (
      <ChevronDownIcon className="w-4 h-4" />
    )
  }

  const toggleExpanded = (athleteId: string) => {
    setExpandedAthlete(expandedAthlete === athleteId ? null : athleteId)
  }

  const sortedAthletes = sortAthletes(athletes, sortConfig)

  const getClassYear = (gradYear: number) => {
    if (!gradYear) return 'N/A'
    return gradYear.toString()
  }

  const getPerformanceTrend = (athlete: AthleteRanking) => {
    if (!athlete.season_pr || !athlete.last_3_average) return null
    
    const improvement = athlete.season_pr - athlete.last_3_average
    if (Math.abs(improvement) < 10) return 'stable'
    return improvement > 0 ? 'declining' : 'improving'
  }

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'improving':
        return <span className="text-green-600 text-xs">↗ Improving</span>
      case 'declining':
        return <span className="text-red-600 text-xs">↘ Declining</span>
      case 'stable':
        return <span className="text-gray-600 text-xs">→ Stable</span>
      default:
        return null
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">
          {athletes.length} athlete{athletes.length !== 1 ? 's' : ''} with race data
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b text-left bg-gray-50">
              <th className="py-3 px-4 font-bold text-black w-12">#</th>
              <th className="py-3 px-4 font-bold text-black w-8"></th>
              <th className="py-3 px-4 font-bold text-black">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 hover:text-gray-700"
                >
                  Athlete Name
                  {getSortIcon('name')}
                </button>
              </th>
              <th className="py-3 px-4 font-bold text-black">
                <button
                  onClick={() => handleSort('grad_year')}
                  className="flex items-center gap-1 hover:text-gray-700"
                >
                  Class
                  {getSortIcon('grad_year')}
                </button>
              </th>
              <th className="py-3 px-4 font-bold text-black">
                <button
                  onClick={() => handleSort('season_pr')}
                  className="flex items-center gap-1 hover:text-gray-700"
                >
                  Season PR
                  {getSortIcon('season_pr')}
                </button>
              </th>
              <th className="py-3 px-4 font-bold text-black">
                <button
                  onClick={() => handleSort('top_3_average')}
                  className="flex items-center gap-1 hover:text-gray-700"
                >
                  Top 3 Avg
                  {getSortIcon('top_3_average')}
                </button>
              </th>
              <th className="py-3 px-4 font-bold text-black">
                <button
                  onClick={() => handleSort('last_3_average')}
                  className="flex items-center gap-1 hover:text-gray-700"
                >
                  Last 3 Avg
                  {getSortIcon('last_3_average')}
                </button>
              </th>
              <th className="py-3 px-4 font-bold text-black">
                <button
                  onClick={() => handleSort('race_count')}
                  className="flex items-center gap-1 hover:text-gray-700"
                >
                  Races
                  {getSortIcon('race_count')}
                </button>
              </th>
              <th className="py-3 px-4 font-bold text-black">Trend</th>
            </tr>
          </thead>
          <tbody>
            {athletes.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-500">
                  No athletes found with race data for this season
                </td>
              </tr>
            ) : (
              sortedAthletes.map((athlete, index) => (
                <React.Fragment key={athlete.athlete_id}>
                  <tr className={`border-b hover:bg-gray-50 ${index < 7 ? 'bg-blue-50' : ''}`}>
                    <td className="py-3 px-4 font-medium text-gray-500">
                      {index + 1}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleExpanded(athlete.athlete_id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {expandedAthlete === athlete.athlete_id ? (
                          <ChevronDownExpandIcon className="w-4 h-4" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <a
                        href={`/athletes/${athlete.athlete_id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {athlete.athlete_name}
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                        {getClassYear(athlete.graduation_year)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">
                      {athlete.season_pr ? formatTime(athlete.season_pr) : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {athlete.top_3_average ? formatTime(athlete.top_3_average) : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {athlete.last_3_average ? formatTime(athlete.last_3_average) : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {athlete.race_count}
                    </td>
                    <td className="py-3 px-4">
                      {getTrendIcon(getPerformanceTrend(athlete))}
                    </td>
                  </tr>
                  
                  {expandedAthlete === athlete.athlete_id && (
                    <tr className="bg-gray-50">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="ml-8">
                          <h4 className="font-medium text-gray-900 mb-2">Recent Races</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {athlete.recent_races.slice(0, 6).map((race, raceIndex) => (
                              <div key={raceIndex} className="bg-white border rounded p-3">
                                <div className="font-mono font-semibold text-lg text-blue-600">
                                  {formatTime(race.time)}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {race.meet_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(race.date).toLocaleDateString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {athletes.length >= 7 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span>Top 7 runners highlighted (varsity team + alternates)</span>
          </div>
        </div>
      )}
    </div>
  )
}