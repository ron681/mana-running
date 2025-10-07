'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatTime } from '@/lib/utils';
import { DeleteResultButton } from '@/components/race-delete-buttons';

interface RaceResult {
  id: string
  place: number
  athlete_id: string
  athlete_name: string
  athlete_grade: string | null
  team_name: string
  school_id: string
  time_seconds: number | null
  scoringPlace: number | null
}

interface IndividualResultsTableProps {
  timedResults: RaceResult[]
  untimedResults: RaceResult[]
  raceId: string
  isAdmin: boolean
}

export default function IndividualResultsTable({ 
  timedResults, 
  untimedResults, 
  raceId, 
  isAdmin 
}: IndividualResultsTableProps) {
  const [sortConfig, setSortConfig] = useState<{ 
    key: keyof RaceResult; 
    direction: 'asc' | 'desc' 
  } | null>(null);

  const handleSort = (key: keyof RaceResult) => {
    setSortConfig(prev => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
    });
  };

  const sortResults = (results: RaceResult[]) => {
    if (!sortConfig) return results;

    return [...results].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
  };

  const sortedResults = sortResults(timedResults);

  const getSortIcon = (key: keyof RaceResult) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Individual Results</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('place')}
              >
                Place {getSortIcon('place')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('athlete_name')}
              >
                Name {getSortIcon('athlete_name')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('team_name')}
              >
                Team {getSortIcon('team_name')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('time_seconds')}
              >
                Time {getSortIcon('time_seconds')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('scoringPlace')}
              >
                Team Points {getSortIcon('scoringPlace')}
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedResults.map((result, index) => {
              // Determine if this is a podium position based on original place
              const isPodium = result.place <= 3;
              const podiumIndex = result.place - 1;
              
              return (
                <tr 
                  key={result.id} 
                  className={`hover:bg-gray-50 ${isPodium ? 'bg-yellow-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium ${
                        podiumIndex === 0 ? 'text-yellow-600' : 
                        podiumIndex === 1 ? 'text-gray-600' : 
                        podiumIndex === 2 ? 'text-orange-600' : 
                        'text-gray-900'
                      }`}>
                        {result.place}
                      </span>
                      {isPodium && (
                        <span className="ml-2 text-lg">
                          {podiumIndex === 0 ? '🥇' : podiumIndex === 1 ? '🥈' : '🥉'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      <Link 
                        href={`/athletes/${result.athlete_id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {result.athlete_name}
                      </Link>
                    </div>
                    {result.athlete_grade && (
                      <div className="text-sm text-gray-500">
                        Grade {result.athlete_grade}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {result.team_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {result.time_seconds ? formatTime(result.time_seconds) : 'DNF'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {result.scoringPlace ? (
                      <span className="font-semibold text-green-700">{result.scoringPlace}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <DeleteResultButton resultId={result.id} raceId={raceId} />
                    </td>
                  )}
                </tr>
              );
            })}
            
            {/* Non-timed results (DNF, DNS, etc.) */}
            {untimedResults.map((result) => (
              <tr key={result.id} className="hover:bg-gray-50 bg-gray-25">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {result.place || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    <Link 
                      href={`/athletes/${result.athlete_id}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {result.athlete_name}
                    </Link>
                  </div>
                  {result.athlete_grade && (
                    <div className="text-sm text-gray-400">
                      Grade {result.athlete_grade}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {result.team_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  DNF
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  -
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <DeleteResultButton resultId={result.id} raceId={raceId} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
