// lib/crud-operations.ts - Updated for new rating system

import { supabase } from './supabase';


// ==================== ATHLETE CRUD OPERATIONS ====================

export const athleteCRUD = {
  // GET: Fetch all athletes with school information
  async getAll() {
    const { data, error } = await supabase
      .from('athletes')
      .select(`
        *,
        school:schools(id, name)
      `)
      .order('last_name');
    
    if (error) throw error;
    return data;
  },

  // GET: Fetch athlete by ID with full details
  async getById(id: string) {
    const { data, error } = await supabase
      .from('athletes')
      .select(`
        *,
        school:schools(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

// GET: Count total athletes without loading data
async getTotalCount() {
  const { count, error } = await supabase
    .from('athletes')
    .select('*', { count: 'exact', head: true });
  
  if (error) throw error;
  return count;
},



  // POST: Create new athlete
  async create(athleteData: {
    first_name: string;
    last_name: string;
    graduation_year?: number;
    current_school_id?: string;
    gender?: 'M' | 'F';
  }) {
    const { data, error } = await supabase
      .from('athletes')
      .insert(athleteData)
      .select(`
        *,
        school:schools(name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<{
    first_name: string;
    last_name: string;
    graduation_year: number;
    gender: string;
    current_school_id: string;
  }>) {
    const { data, error } = await supabase
      .from('athletes')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        school:schools(name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }
};

// ==================== SCHOOL CRUD OPERATIONS ====================

export const schoolCRUD = {
  // GET: Fetch all schools with athlete count
  async getAll() {
    const { data, error } = await supabase
      .from('schools')
      .select(`*`)
      .order('name');
    
    if (error) throw error;
    return data;
  },
};

// ==================== MEET CRUD OPERATIONS ====================

export const meetCRUD = {
  // GET: Fetch all meets with races (no direct course relationship)
  async getAll() {
    const { data, error } = await supabase
      .from('meets')
      .select(`
        *,
        races(
          id,
          name,
          category,
          gender,
          total_participants,
          course:courses(name)
        )
      `)
      .order('meet_date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // GET: Fetch meet by ID with all results (through races)
  async getById(id: string) {
    const { data, error } = await supabase
      .from('meets')
      .select(`
        *,
        races(
          *,
          course:courses(*),
          results(
            *,
            athlete:athletes(
              *,
              school:schools(name)
            )
          )
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

// POST: Create new meet
async create(meetData: {
  name: string;
  date: string;
  meet_type: string;
  weather_conditions?: string;
}) {
  // Map the date field to meet_date for database
  const dbData = {
    name: meetData.name,
    meet_date: meetData.date,
    meet_type: meetData.meet_type,
    weather_conditions: meetData.weather_conditions
  };

  const { data, error } = await supabase
    .from('meets')
    .insert(dbData)
    .select('*')
    .single();
  
  if (error) throw error;
  return data;
},

  // PUT: Update meet
  async update(id: string, updates: Partial<{
    name: string;
    date: string;
    meet_type: string;
    weather_conditions: string;
  }>) {
    const { data, error } = await supabase
      .from('meets')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  },

// DELETE: Delete meet and all related data (ADMIN ONLY)
async delete(id: string) {
  // Get races for this meet
  const { data: races } = await supabase
    .from('races')
    .select('id')
    .eq('meet_id', id);

  // Delete all results for all races in this meet
  if (races && races.length > 0) {
    const raceIds = races.map(race => race.id);
    await supabase
      .from('results')
      .delete()
      .in('race_id', raceIds);
    
    // Delete all races
    await supabase
      .from('races')
      .delete()
      .eq('meet_id', id);
  }

  // Delete meet
  const { error } = await supabase
    .from('meets')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { deletedRacesCount: races?.length || 0 };
}
};

// ==================== COURSE CRUD OPERATIONS ====================

export const courseCRUD = {
  // GET: Fetch all courses with NEW rating system columns
  async getAll() {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        id,
        created_at,
        name,
        distance_meters,
        distance_miles,
        mile_difficulty,
        xc_time_rating,
        rating_confidence,
        rating_last_updated,
        total_results_count,
        races(count)
      `)
      .order('name');
    
    if (error) throw error;
    
    return data?.map(course => ({
      ...course,
      races_count: course.races[0]?.count || 0
    }));
  },

  // GET: Fetch course by ID with races and meets
  async getById(id: string) {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        races(
          *,
          meet:meets(*)
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // POST: Create new course (this function looks wrong - it's creating meets, not courses)
  // This should probably be moved to meetCRUD or renamed
  async create(meetData: { 
    name: string; 
    date: string;
    meet_type: string 
  }) {
    const { data, error } = await supabase
      .from('meets')
      .insert({
        name: meetData.name,
        meet_date: meetData.date,
        meet_type: meetData.meet_type
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  // PUT: Update course with NEW rating system
  async update(id: string, updates: Partial<{
    name: string;
    distance: string;
    surface_type: string;
    mile_difficulty: number;     // NEW: How hard vs 1-mile track
    xc_time_rating: number;      // NEW: For XC time conversion
    rating_confidence: string;
  }>) {
    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // DELETE: Delete course and handle related data
  async delete(id: string) {
    // Check for related races (not meets - course_id is in races table now)
    const { data: races } = await supabase
      .from('races')
      .select('id')
      .eq('course_id', id);

    if (races && races.length > 0) {
      throw new Error(`Cannot delete course. ${races.length} races use this course. Delete races first.`);
    }

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  }
};

// ==================== RESULT CRUD OPERATIONS ====================

export const resultCRUD = {
  // GET: Fetch all results with athlete and meet info
  async getAll() {
    const { data, error } = await supabase
      .from('results')
      .select(`
        *,
        athlete:athletes(first_name, last_name, graduation_year, school:schools(name)),
        race:races(
          name,
          meet:meets(name, meet_date),
          course:courses(name)
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // GET: Fetch detailed results with all calculated fields (for your page)
  // NOTE: This will need the updated view with mile_difficulty and xc_time_rating
  async getAllWithDetails() {
    const { data, error } = await supabase
      .from('results_with_details')
      .select('*')
      .order('meet_date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // GET: Fetch results by meet ID
  async getByMeetId(meetId: string) {
    const { data, error } = await supabase
      .from('results')
      .select(`
        *,
        athlete:athletes(id, first_name, last_name, graduation_year, school:schools(name))
      `)
      .eq('meet_id', meetId)
      .order('place_overall');
    
    if (error) throw error;
    return data;
  },

  // POST: Create new result
  async create(resultData: {
    athlete_id: string;
    race_id: string;
    time_seconds: number;
    place_overall: number;
    place_team?: number;
    season_year: number;
  }) {
    const { data, error } = await supabase
      .from('results')
      .insert(resultData)
      .select(`
        *,
        athlete:athletes(first_name, last_name, school:schools(name)),
        race:races(
          name,
          meet:meets(name, meet_date)
        )
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // PUT: Update result
  async update(id: string, updates: Partial<{
    time_seconds: number;
    place_overall: number;
    place_team: number;
    season_year: number;
  }>) {
    const { data, error } = await supabase
      .from('results')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        athlete:athletes(first_name, last_name, school:schools(name)),
        race:races(
          name,
          meet:meets(name, meet_date)
        )
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

async delete(id: string) {
    const { error } = await supabase
      .from('results')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  // DELETE: Delete multiple results (ADMIN ONLY)
  async deleteMultiple(ids: string[]) {  
  const { error } = await supabase
    .from('results')
    .delete()
    .in('id', ids);
  
  if (error) throw error;
  return true;
},
  
  // GET: Search results across entire database
  async searchAllResults(searchQuery = '', limit = 5000) {
    let query = supabase
      .from('results_with_details')
      .select('*')
      .order('meet_date', { ascending: false });

    if (searchQuery) {
      query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,school_name.ilike.%${searchQuery}%,meet_name.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query.limit(limit);
    
    if (error) throw error;
    return data;
  },

  // GET: Get all results with pagination
  async getAllWithPagination(page = 1, pageSize = 1000) {
    const offset = (page - 1) * pageSize;
    
    const { data, error } = await supabase
      .from('results_with_details')
      .select('*')
      .order('meet_date', { ascending: false })
      .range(offset, offset + pageSize - 1);
    
    if (error) throw error;
    return data;
  },

  // GET: Count total results
  async getTotalCount() {
    const { count, error } = await supabase
      .from('results_with_details')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count;
  }
};

// ==================== RACE CRUD OPERATIONS ====================

export const raceCRUD = {
  // GET: Fetch all races with meet and course info
  async getAll() {
    const { data, error } = await supabase
      .from('races')
      .select(`
        *,
        meet:meets(name, meet_date),
        course:courses(name, distance_miles),
        results(count)
      `)
      .order('meet_id')
      .order('category')
      .order('gender');
    
    if (error) throw error;
    return data?.map(race => ({
      ...race,
      participants_count: race.results[0]?.count || 0
    }));
  },

  // GET: Fetch race by ID with full details
  async getById(id: string) {
    const { data, error } = await supabase
      .from('races')
      .select(`
        *,
        meet:meets(*),
        course:courses(*),
        results(
          *,
          athlete:athletes(
            *,
            school:schools(name)
          )
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // GET: Fetch races by meet ID
  async getByMeetId(meetId: string) {
    const { data, error } = await supabase
      .from('races')
      .select(`
        *,
        course:courses(name, distance_miles),
        results(count)
      `)
      .eq('meet_id', meetId)
      .order('category')
      .order('gender');
    
    if (error) throw error;
    return data?.map(race => ({
      ...race,
      participants_count: race.results[0]?.count || 0
    }));
  },

  // POST: Create new race
  async create(raceData: {
    meet_id: string;
    name: string;
    category: string;
    gender: string;
    course_id?: string;
    total_participants?: number;
  }) {
    const { data, error } = await supabase
      .from('races')
      .insert(raceData)
      .select(`
        *,
        meet:meets(name),
        course:courses(name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // PUT: Update race
  async update(id: string, updates: Partial<{
    name: string;
    category: string;
    gender: string;
    course_id: string;
    total_participants: number;
    results_finalized: boolean;
  }>) {
    const { data, error } = await supabase
      .from('races')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        meet:meets(name),
        course:courses(name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

// DELETE: Delete race and all results (ADMIN ONLY)
async delete(id: string) {
  // Get result count for confirmation
  const { data: results } = await supabase
    .from('results')
    .select('id')
    .eq('race_id', id);

  // Delete all results for this race
  if (results && results.length > 0) {
    await supabase
      .from('results')
      .delete()
      .eq('race_id', id);
  }

  // Delete race
  const { error } = await supabase
    .from('races')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { deletedResultsCount: results?.length || 0 };
}
};