/**
 * Supabase Client Configuration
 * Connects to Supabase PostgreSQL database for persistent ranking storage
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.'
  );
}

// Create Supabase client with service role key for server-side operations
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper function to check database connection
export async function checkConnection() {
  try {
    const { data, error } = await supabase.from('tournaments').select('count');
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error);
    return false;
  }
}
