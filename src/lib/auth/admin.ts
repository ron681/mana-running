import type { SupabaseClient } from '@supabase/supabase-js'

export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return false
  }
  
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  if (profileError || !profile) {
    return false
  }
  
  return profile.role === 'admin'
}