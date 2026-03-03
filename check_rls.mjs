import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pcpdwmmhjcxffdjwnwwv.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjcGR3bW1oamN4ZmZkandud3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTU3NjgsImV4cCI6MjA4NjY3MTc2OH0.TAH_xnQ1bd5ECpc9s-nOtmiQ_kqDEK5ssFN7NYomYKI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
    // We can't query pg_policies easily from anon key if RLS blocks it, but we can try RPC or just try a mocked insert
    const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
            client_name: "Test RLS",
            delivery_phone: "12345678",
            status: "pendiente_online",
            type: "recoger",
            total_amount: 10000,
            payment_method: "efectivo",
        })
        .select();

    console.log("Insert result:", { order, orderErr });
}

checkPolicies();
