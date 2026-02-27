import { createClient } from '@supabase/supabase-js';

// Extracted from integration client context
const supabaseUrl = 'https://pcpdwmmhjcxffdjwnwwv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjcGR3bW1oamN4ZmZkandud3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTU3NjgsImV4cCI6MjA4NjY3MTc2OH0.TAH_xnQ1bd5ECpc9s-nOtmiQ_kqDEK5ssFN7NYomYKI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPendingOrders() {
    const { data, error, count } = await supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('status', 'pendiente_online');

    if (error) {
        console.error('Error fetching:', error);
    } else {
        console.log(`Found ${count} stuck orders:`);
        console.log(JSON.stringify(data, null, 2));
    }
}

checkPendingOrders();
