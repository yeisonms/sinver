import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pcpdwmmhjcxffdjwnwwv.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjcGR3bW1oamN4ZmZkandud3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTU3NjgsImV4cCI6MjA4NjY3MTc2OH0.TAH_xnQ1bd5ECpc9s-nOtmiQ_kqDEK5ssFN7NYomYKI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOpenRegisters() {
    const { data, error } = await supabase
        .from("cash_registers")
        .select("id, status, opened_at");

    console.log("All registers:", data?.length);
    const openOnes = data?.filter(r => r.status === 'open') || [];
    console.log("Open registers:", openOnes.length);
    console.log(openOnes);
}

checkOpenRegisters();
