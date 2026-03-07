const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.ydntowjswxeqxohudshq:Lasinver2024*@aws-0-us-east-1.pooler.supabase.com:6543/postgres' });
async function run() {
    await client.connect();
    const res = await client.query("SELECT trigger_name, event_object_table, action_statement FROM information_schema.triggers WHERE event_object_table IN ('orders', 'payments');");
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
}
run().catch(console.error);
