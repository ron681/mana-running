'use client';

import { useState } from 'react';
import { formatTime } from '@/lib/utils';

interface CombinedResult {
  id: string
  place: number
  athlete_id: string
  athlete_name: string
  athlete_grade: string | null
  school_id: string
  team_name: string
  time_seconds: number // In centiseconds
  xc_time: number // In centiseconds
  race_name: string
  race_category: string
  race_gender: string
  overallPlace: number
  scoringPlace: number
}

interface TeamScore {
  schoolId: string
  schoolName: string
  place: number
  totalTime: number // In centiseconds
  teamScore: number // Sum of top 5 scoring places
  runners: {
    athleteId: string
    athleteName: string
    athleteGrade: string | null
    time: number // In centiseconds
    xcTime: number // In centiseconds
    overallPlace: number
    teamPlace: number
    status: 'counting' | 'displacer' | 'non-counting'
    resultId: string
  }[]
}

export default function ResultsTable({ boysResults, girlsResults, boysTeamScores, girlsTeamScores }: { boysResults: CombinedResult[], girlsResults: CombinedResult[], boysTeamScores: TeamScore[], girlsTeamScores: TeamScore[] }) {
  const [boysSortConfig, setBoysSortConfig] = useState<{ key: keyof CombinedResult; direction: 'asc' | 'desc' } | null>(null);
  const [girlsSortConfig, setGirlsSortConfig] = useState<{ key: keyof CombinedResult; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (gender: 'boys' | 'girls', key: keyof CombinedResult) => {
    const setSort = gender === 'boys' ? setBoysSortConfig : setGirlsSortConfig;
    setSort(prev => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
    });
  };

  const sortResults = (results: CombinedResult[], sortConfig: { key: keyof CombinedResult; direction: 'asc' | 'desc' } | null) => {
    if (!sortConfig) return [...results];

    return [...results].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      // Handle null/undefined values: treat as lowest for asc, highest for desc
      if (aVal === null || aVal === undefined) return sortConfig.direction === 'asc' ? -1 : 1;
      if (bVal === null || bVal === undefined) return sortConfig.direction === 'asc' ? 1 : -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0; // Default case if types don't match
    });
  };

  const sortedBoysResults = sortResults(boysResults, boysSortConfig);
  const sortedGirlsResults = sortResults(girlsResults, girlsSortConfig);

  return (
    <div id="combined-individual" className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Projected Combined Race Results</h2>
      </div>
      <div className="space-y-8">
        <div>
          <h3 className="px-6 py-2 text-lg font-semibold text-gray-900 bg-blue-50">Boys' Race</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('boys', 'overallPlace')}>
                    Overall Place {boysSortConfig?.key === 'overallPlace' && (boysSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('boys', 'athlete_name')}>
                    Name {boysSortConfig?.key === 'athlete_name' && (boysSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('boys', 'team_name')}>
                    School {boysSortConfig?.key === 'team_name' && (boysSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('boys', 'xc_time')}>
                    XC Time {boysSortConfig?.key === 'xc_time' && (boysSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('boys', 'scoringPlace')}>
                    Team Points {boysSortConfig?.key === 'scoringPlace' && (boysSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedBoysResults.map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{result.overallPlace}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{result.athlete_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.athlete_grade || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.team_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{formatTime(result.xc_time / 100)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{result.scoringPlace > 0 ? result.scoringPlace : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="px-6 py-2 text-lg font-semibold text-gray-900 bg-pink-50">Girls' Race</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('girls', 'overallPlace')}>
                    Overall Place {girlsSortConfig?.key === 'overallPlace' && (girlsSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('girls', 'athlete_name')}>
                    Name {girlsSortConfig?.key === 'athlete_name' && (girlsSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('girls', 'team_name')}>
                    School {girlsSortConfig?.key === 'team_name' && (girlsSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('girls', 'xc_time')}>
                    XC Time {girlsSortConfig?.key === 'xc_time' && (girlsSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('girls', 'scoringPlace')}>
                    Team Points {girlsSortConfig?.key === 'scoringPlace' && (girlsSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedGirlsResults.map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{result.overallPlace}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{result.athlete_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.athlete_grade || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.team_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{formatTime(result.xc_time / 100)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{result.scoringPlace > 0 ? result.scoringPlace : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}