(function () {
    const SUPABASE_URL = 'https://varuauhkbibkpemeyawh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhcnVhdWhrYmlia3BlbWV5YXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MTMyMDQsImV4cCI6MjEwMTA4OTIwNH0.85Wo4Y-Z_eBon3Q9wfwfViluASqVEYk4nE70kP4CpYc';

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('No se pudo cargar @supabase/supabase-js. Revisa tu conexión a Internet.');
    }

    window.supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );
})();
