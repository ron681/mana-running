'use client'

import { useState } from 'react'
import { importMassResults } from '@/lib/mass-results-import'

export default function MassImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (!file) return
    
    setImporting(true)
    setResult(null)
    
    try {
      const importResult = await importMassResults(file)
      setResult(importResult)
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Import failed',
        stats: null
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Mass Results Import</h1>
          <p className="text-slate-600 mb-8">Upload CSV file with meet results from multiple meets and courses</p>
          
          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={importing}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            {file && (
              <p className="mt-2 text-sm text-slate-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {importing ? 'Importing...' : 'Start Import'}
          </button>

          {/* Progress Indicator */}
          {importing && (
            <div className="mt-6">
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                <span className="text-slate-700">Processing rows... Check console for progress</span>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className={`mt-6 p-6 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <h2 className={`text-lg font-bold mb-4 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.message}
              </h2>
              
              {result.stats && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-2xl font-bold text-slate-800">{result.stats.totalRows}</div>
                    <div className="text-sm text-slate-600">Total Rows</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{result.stats.resultsCreated}</div>
                    <div className="text-sm text-slate-600">Results Created</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{result.stats.coursesCreated}</div>
                    <div className="text-sm text-slate-600">Courses Created</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{result.stats.schoolsCreated}</div>
                    <div className="text-sm text-slate-600">Schools Created</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{result.stats.athletesCreated}</div>
                    <div className="text-sm text-slate-600">Athletes Created</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-2xl font-bold text-pink-600">{result.stats.meetsCreated}</div>
                    <div className="text-sm text-slate-600">Meets Created</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-2xl font-bold text-indigo-600">{result.stats.racesCreated}</div>
                    <div className="text-sm text-slate-600">Races Created</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{result.stats.errors.length}</div>
                    <div className="text-sm text-slate-600">Errors</div>
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.stats && result.stats.errors.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold text-red-800 mb-2">Errors ({result.stats.errors.length}):</h3>
                  <div className="bg-white rounded-lg p-4 max-h-60 overflow-y-auto">
                    {result.stats.errors.slice(0, 50).map((error: string, i: number) => (
                      <div key={i} className="text-sm text-red-700 mb-1">• {error}</div>
                    ))}
                    {result.stats.errors.length > 50 && (
                      <div className="text-sm text-red-600 font-semibold mt-2">
                        ... and {result.stats.errors.length - 50} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-3">CSV Format Requirements:</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li>• <strong>meet_date:</strong> MM/DD/YY format (handles 1960s-2025)</li>
              <li>• <strong>time:</strong> MM:SS.S format</li>
              <li>• <strong>gender:</strong> M or F</li>
              <li>• <strong>distance_meters:</strong> Integer (e.g., 4747, 5000)</li>
              <li>• <strong>race_category:</strong> Use "UNK" to default to Varsity</li>
              <li>• Intelligent course matching: exact → fuzzy (±50m) → create new</li>
              <li>• Progress logged to console every 100 rows</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}