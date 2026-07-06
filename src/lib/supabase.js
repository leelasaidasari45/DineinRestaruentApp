import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ezpqrzhlsfxolytuuich.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cHFyemhsc2Z4b2x5dHV1aWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMzU0NTMsImV4cCI6MjA5ODcxMTQ1M30.0IHRmHYLRzHwRmDOz3hWi14LtTji4OqBBlBPF1raA3I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
