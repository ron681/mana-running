'use server'

import { meetCRUD, raceCRUD, resultCRUD } from '@/lib/crud-operations'
import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'


export async function deleteMeet(meetId: string) {
  const result = await meetCRUD.delete(meetId)
  revalidatePath('/meets')
  return { success: true, ...result }
}

export async function deleteRace(raceId: string, meetId: string) {
  const result = await raceCRUD.delete(raceId)
  revalidatePath(`/meets/${meetId}`)
  return { success: true, ...result }
}

export async function deleteResult(resultId: string, raceId: string) {
  await resultCRUD.delete(resultId)
  revalidatePath(`/races/${raceId}`)
  return { success: true }
}

export async function deleteAllRaceResults(raceId: string) {
  const { data: results } = await supabase
    .from('results')
    .select('id')
    .eq('race_id', raceId)
  
  if (results && results.length > 0) {
    const resultIds = results.map(r => r.id)
    await resultCRUD.deleteMultiple(resultIds)
  }
  
  revalidatePath(`/races/${raceId}`)
  return { success: true, deletedCount: results?.length || 0 }
}

export async function deleteAllMeetResults(meetId: string) {
  const { data: races } = await supabase
    .from('races')
    .select('id')
    .eq('meet_id', meetId)
  
  if (!races || races.length === 0) {
    return { success: true, deletedCount: 0 }
  }
  
  const raceIds = races.map(r => r.id)
  
  const { data: results } = await supabase
    .from('results')
    .select('id')
    .in('race_id', raceIds)
  
  if (results && results.length > 0) {
    const resultIds = results.map(r => r.id)
    await resultCRUD.deleteMultiple(resultIds)
  }
  
  revalidatePath(`/meets/${meetId}`)
  return { success: true, deletedCount: results?.length || 0 }
}