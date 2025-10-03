'use client'

import { useEffect, useState } from 'react'
import { 
  athleteCRUD, 
  schoolCRUD, 
  meetCRUD, 
  courseCRUD, 
  resultCRUD 
} from '@/lib/crud-operations'

interface Stats {
  schools: number
  athletes: number
  courses: number
  meets: number
  results: number
}

interface BulkOperation {
  type: 'delete_race_results' | 'edit_athlete' | 'edit_meet'
  target?: string
  data?: any
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({
    schools: 0,
    athletes: 0,
    courses: 0,
    meets: 0,
    results: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'overview' |  'bulk-edit'>('overview')
  
  // Bulk delete states
  const [meets, setMeets] = useState<any[]>([])

  
  // Bulk edit states
  const [athletes, setAthletes] = useState<any[]>([])
  const [selectedAthlete, setSelectedAthlete] = useState('')
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    graduation_year: '',
    gender: ''
  })
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    loadAdminData()
  }, [])

  const loadAdminData = async () => {
    try {
      setLoading(true)
      
      const [schools, athletes, courses, meets, totalResults] = await Promise.all([
        schoolCRUD.getAll(),
        athleteCRUD.getAll(),
        courseCRUD.getAll(),
        meetCRUD.getAll(),
        resultCRUD.getTotalCount()
      ])
      
      setStats({
        schools: schools?.length || 0,
        athletes: athletes?.length || 0,
        courses: courses?.length || 0,
        meets: meets?.length || 0,
        results: totalResults || 0
      })

      setMeets(meets || [])
      setAthletes(athletes || [])
      
    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }



  const handleEditAthlete = async () => {
    if (!selectedAthlete) {
      alert('Please select an athlete to edit')
      return
    }

    try {
      setIsEditing(true)
      
      // Update athlete data
      await athleteCRUD.update(selectedAthlete, {
        first_name: editForm.first_name || undefined,
        last_name: editForm.last_name || undefined,
        graduation_year: editForm.graduation_year ? parseInt(editForm.graduation_year) : undefined,
        gender: editForm.gender || undefined
      })
      
      alert('Athlete updated successfully')
      setSelectedAthlete('')
      setEditForm({ first_name: '', last_name: '', graduation_year: '', gender: '' })
      
      // Reload data
      await loadAdminData()
      
    } catch (error) {
      console.error('Error updating athlete:', error)
      alert('Error updating athlete: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsEditing(false)
    }
  }

  const loadAthleteForEdit = (athleteId: string) => {
    const athlete = athletes.find(a => a.id === athleteId)
    if (athlete) {
      setEditForm({
        first_name: athlete.first_name || '',
        last_name: athlete.last_name || '',
        graduation_year: athlete.graduation_year?.toString() || '',
        gender: athlete.gender || ''
      })
    }
  }

  useEffect(() => {
    if (selectedAthlete) {
      loadAthleteForEdit(selectedAthlete)
    }
  }, [selectedAthlete])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Admin Dashboard...</div>
          <div className="text-gray-600">Getting system data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage your cross country database with bulk operations and editing tools</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setSelectedTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === 'overview'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                System Overview
              </button>

            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {selectedTab === 'overview' && (
              <div>
                <h3 className="text-xl font-bold text-black mb-6">Database Overview</h3>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                  <div className="text-center p-6 bg-white border border-gray-200 rounded-lg shadow">
                    <div className="text-3xl font-bold text-black">{stats.schools}</div>
                    <div className="text-sm text-gray-600">Schools</div>
                  </div>
                  <div className="text-center p-6 bg-red-50 border border-red-200 rounded-lg shadow">
                    <div className="text-3xl font-bold text-red-600">{stats.athletes}</div>
                    <div className="text-sm text-gray-600">Athletes</div>
                  </div>
                  <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg shadow">
                    <div className="text-3xl font-bold text-green-600">{stats.courses}</div>
                    <div className="text-sm text-gray-600">Courses</div>
                  </div>
                  <div className="text-center p-6 bg-blue-50 border border-blue-200 rounded-lg shadow">
                    <div className="text-3xl font-bold text-blue-600">{stats.meets}</div>
                    <div className="text-sm text-gray-600">Meets</div>
                  </div>
                  <div className="text-center p-6 bg-yellow-50 border border-yellow-200 rounded-lg shadow">
                    <div className="text-3xl font-bold text-yellow-600">{stats.results}</div>
                    <div className="text-sm text-gray-600">Results</div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="font-bold text-black mb-2">Data Import</h4>
                    <p className="text-sm text-gray-600 mb-4">Import race results and athlete data from CSV files</p>
                    <a href="/import" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                      Import Data
                    </a>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="font-bold text-black mb-2">Search Tools</h4>
                    <p className="text-sm text-gray-600 mb-4">Advanced search and filtering across all data</p>
                    <a href="/search" className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                      Advanced Search
                    </a>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="font-bold text-black mb-2">System Health</h4>
                    <p className="text-sm text-gray-600 mb-4">Check data integrity and system performance</p>
                    <button className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700" disabled>
                      Coming Soon
                    </button>
                  </div>
                </div>
              </div>
            )}



            {selectedTab === 'bulk-edit' && (
              <div>
                <h3 className="text-xl font-bold text-black mb-6">Bulk Edit Operations</h3>
                
                <div className="space-y-6">
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h4 className="font-bold text-black mb-4">Edit Athlete Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Athlete to Edit
                        </label>
                        <select
                          value={selectedAthlete}
                          onChange={(e) => setSelectedAthlete(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                        >
                          <option value="">Choose an athlete...</option>
                          {athletes.map(athlete => (
                            <option key={athlete.id} value={athlete.id}>
                              {athlete.first_name} {athlete.last_name} ({athlete.graduation_year})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {selectedAthlete && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              First Name
                            </label>
                            <input
                              type="text"
                              value={editForm.first_name}
                              onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Last Name
                            </label>
                            <input
                              type="text"
                              value={editForm.last_name}
                              onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Graduation Year
                            </label>
                            <input
                              type="number"
                              value={editForm.graduation_year}
                              onChange={(e) => setEditForm({...editForm, graduation_year: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Gender
                            </label>
                            <select
                              value={editForm.gender}
                              onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                            >
                              <option value="">Select gender...</option>
                              <option value="M">Male</option>
                              <option value="F">Female</option>
                              <option value="Boys">Boys</option>
                              <option value="Girls">Girls</option>
                            </select>
                          </div>
                          <button
                            onClick={handleEditAthlete}
                            disabled={isEditing}
                            className="w-full bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50"
                          >
                            {isEditing ? 'Updating...' : 'Update Athlete'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6">
          <a 
            href="/"
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
} 