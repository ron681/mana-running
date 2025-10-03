'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')

  const handleImport = async () => {
    if (!file) {
      alert('Please select a file first')
      return
    }

    setImporting(true)
    setMessage('Import functionality coming soon. This feature is being rebuilt.')
    
    setTimeout(() => {
      setImporting(false)
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Import Data</h1>
          <p className="text-gray-600">Upload CSV files to import race results</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={importing}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {message && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-800">{message}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Processing...' : 'Import'}
            </button>
            
            <Link 
              href="/admin"
              className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
            >
              Back to Admin
            </Link>
          </div>
        </div>

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-2xl">
          <h3 className="font-bold text-yellow-800 mb-2">Note</h3>
          <p className="text-yellow-700 text-sm">
            The import functionality is being rebuilt with better validation and error handling. 
            For now, data can be added manually through the database or individual forms.
          </p>
        </div>
      </div>
    </div>
  )
}