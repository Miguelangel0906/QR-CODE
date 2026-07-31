const SUPABASE_URL = 'https://varuauhkbibkpemeyawh.supabase.co/rest/v1/'; // <-- Reemplaza con tu URL de Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhcnVhdWhrYmlia3BlbWV5YXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MTMyMDQsImV4cCI6MjEwMTA4OTIwNH0.85Wo4Y-Z_eBon3Q9wfwfViluASqVEYk4nE70kP4CpYc'; // <-- Reemplaza con tu clave anónima

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('https://varuauhkbibkpemeyawh.supabase.co/rest/v1/')) {
    alert('Error: Las credenciales de Supabase no están configuradas en js/supabase-client.js');
}

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);