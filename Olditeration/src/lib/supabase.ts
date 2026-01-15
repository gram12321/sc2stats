import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ruseplseifwuonpbqakh.supabase.co"
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1c2VwbHNlaWZ3dW9ucGJxYWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MDU2MTEsImV4cCI6MjA3MjM4MTYxMX0.M8zYJcE8JwvcsCn8wXHzgwZMhPTJ1QoqEmePQMLbmLw"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
