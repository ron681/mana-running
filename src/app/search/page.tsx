'use client'

import SearchFilters from '@/components/SearchFilters'

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black text-white p-6">
        <div className="container mx-auto">
          <h1 className="text-4xl font-bold mb-2">Mana Running Search</h1>
          <p className="text-gray-200">Advanced search and analytics for cross country results</p>
        </div>
      </header>

      {/* Search Component */}
      <div className="container mx-auto px-6 py-8">
        <SearchFilters />
      </div>
    </div>
  )
}