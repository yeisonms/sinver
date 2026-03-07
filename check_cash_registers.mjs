import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pcpdwmmhjcxffdjwnwwv.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjcGR3bW1oamN4ZmZkandud3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTU3NjgsImV4cCI6MjA4NjY3MTc2OH0.TAH_xnQ1bd5ECpc9s-nOtmiQ_kqDEK5ssFN7NYomYKI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCashRegisters() {
    const { data: testRegister, error } = await supabase
        .from("cash_registers")
        .insert({
            start_amount: 0,
            status: "open",
            total_sold: 0,
            total_withdrawn: 0,
            opened_at: new Date().toISOString(),
        })
        .select();

    console.log("Cash Register Insert Result:", { testRegister, error });
}

checkCashRegisters();
