import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pcpdwmmhjcxffdjwnwwv.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjcGR3bW1oamN4ZmZkandud3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTU3NjgsImV4cCI6MjA4NjY3MTc2OH0.TAH_xnQ1bd5ECpc9s-nOtmiQ_kqDEK5ssFN7NYomYKI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
    const { data, error } = await supabase.rpc('get_triggers', {});
    console.log("RPC:", error);

    // Quick test: if we can't query pg_trigger from anon, we'll just insert a dummy payment and check if total_sold goes up
    // But since the user created a new project and copy-pasted schema, we can look at the actual schema SQL they attached 
    // named "esquema_completo.sql". Let's search inside it with js.
}

checkDatabase();
