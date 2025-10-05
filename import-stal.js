// import-stal.js
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'
import fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function parseTime(timeStr) {
  const parts = timeStr.split(':')
  const minutes = parseInt(parts[0])
  const seconds = parseFloat(parts[1])
  return Math.round((minutes * 60 + seconds) * 100)
}

async function importCSV() {
  const csvFile = fs.readFileSync('./2025_STAL_Combined.csv', 'utf8')
  
  Papa.parse(csvFile, {
    header: true,
    complete: async (results) => {
      console.log(`Total rows: ${results.data.length}`)
      
      let processed = 0
      let successful = 0
      let failed = 0
      
      for (const row of results.data) {
        if (!row.athlete_first_name || !row.athlete_first_name.trim()) continue
        
        try {
          // 1. Create/find course
          let { data: course } = await supabase
            .from('courses')
            .select('id')
            .eq('name', row.course_name)
            .eq('distance_meters', parseInt(row.distance_meters))
            .single()
          
          if (!course) {
            const { data: newCourse, error: insertError } = await supabase
              .from('courses')
              .insert({
                name: row.course_name,
                distance_meters: parseInt(row.distance_meters)
              })
              .select('id')
              .single()
            
            if (insertError) throw new Error(`Course insert: ${insertError.message}`)
            if (!newCourse) throw new Error('Course insert returned null')
            course = newCourse
          }
          
          // 2. Create/find meet
          let { data: meet } = await supabase
            .from('meets')
            .select('id')
            .eq('name', row.meet_name)
            .eq('meet_date', row.meet_date)
            .single()
          
          if (!meet) {
            const { data: newMeet, error: insertError } = await supabase
              .from('meets')
              .insert({
                name: row.meet_name,
                meet_date: row.meet_date
              })
              .select('id')
              .single()
            
            if (insertError) throw new Error(`Meet insert: ${insertError.message}`)
            if (!newMeet) throw new Error('Meet insert returned null')
            meet = newMeet
          }
          
          // 3. Create/find race
          let { data: race } = await supabase
            .from('races')
            .select('id')
            .eq('meet_id', meet.id)
            .eq('category', row.race_category)
            .eq('gender', row.gender)
            .single()
          
          if (!race) {
            const raceName = `${row.gender === 'M' ? 'Boys' : 'Girls'} ${row.race_category}`
            const { data: newRace, error: insertError } = await supabase
              .from('races')
              .insert({
                meet_id: meet.id,
                course_id: course.id,
                gender: row.gender,
                category: row.race_category,
                name: raceName
              })
              .select('id')
              .single()
            
            if (insertError) throw new Error(`Race insert: ${insertError.message}`)
            if (!newRace) throw new Error('Race insert returned null')
            race = newRace
          }
          
          // 4. Create/find school
          let { data: school } = await supabase
            .from('schools')
            .select('id')
            .eq('name', row.school_name)
            .single()
          
          if (!school) {
            const { data: newSchool, error: insertError } = await supabase
              .from('schools')
              .insert({ name: row.school_name })
              .select('id')
              .single()
            
            if (insertError) throw new Error(`School insert: ${insertError.message}`)
            if (!newSchool) throw new Error('School insert returned null')
            school = newSchool
          }
          
          // 5. Create/find athlete
          const graduationYear = parseInt(row.graduation_year) || null
          
          let { data: athlete } = await supabase
            .from('athletes')
            .select('id')
            .eq('first_name', row.athlete_first_name)
            .eq('last_name', row.athlete_last_name)
            .eq('current_school_id', school.id)
            .maybeSingle()
          
          if (!athlete) {
            const { data: newAthlete, error: insertError } = await supabase
              .from('athletes')
              .insert({
                first_name: row.athlete_first_name,
                last_name: row.athlete_last_name,
                current_school_id: school.id,
                gender: row.gender,
                graduation_year: graduationYear
              })
              .select('id')
              .single()
            
            if (insertError) throw new Error(`Athlete insert: ${insertError.message}`)
            if (!newAthlete) throw new Error('Athlete insert returned null')
            athlete = newAthlete
          }
          
          // 6. Create result
          const timeCentiseconds = parseTime(row.time)
          const place = parseInt(row.place) || null
          const seasonYear = parseInt(row.season) || null
          
          const { error: resultError } = await supabase
            .from('results')
            .insert({
              race_id: race.id,
              athlete_id: athlete.id,
              meet_id: meet.id,
              time_seconds: timeCentiseconds,
              place_overall: place,
              season_year: seasonYear
            })
          
          if (resultError) throw new Error(`Result insert: ${resultError.message}`)
          
          successful++
          processed++
          
          if (processed % 50 === 0) {
            console.log(`Processed: ${processed} (${successful} successful, ${failed} failed)`)
          }
          
        } catch (error) {
          failed++
          const athleteName = `${row.athlete_first_name || ''} ${row.athlete_last_name || ''}`.trim()
          console.error(`Failed on ${athleteName}:`, error.message)
        }
      }
      
      console.log('\n=== IMPORT COMPLETE ===')
      console.log(`Total: ${processed}`)
      console.log(`Successful: ${successful}`)
      console.log(`Failed: ${failed}`)
    }
  })
}

importCSV()
