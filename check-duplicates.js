
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bddytwamsqzulbbkblym.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZHl0d2Ftc3F6dWxiYmtibHltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU1ODIyMywiZXhwIjoyMDg2MTM0MjIzfQ.U_J6pLqhrrLr-C-2jFrYvVtvTOuP5a6P8iKNGkrqXOM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: notifications, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching notifications:', error);
        return;
    }

    console.log(`Total notifications: ${notifications.length}`);

    // Check for duplicates based on message and created_at (within a small window)
    const seen = new Map();
    const duplicates = [];

    notifications.forEach(n => {
        // Create a key based on message and type. 
        // We'll inspect if multiple exist.
        const key = `${n.type}|${n.message}`;
        if (seen.has(key)) {
            duplicates.push({ original: seen.get(key), duplicate: n });
        } else {
            seen.set(key, n);
        }
    });

    if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} likely duplicates (same type and message):`);
        duplicates.slice(0, 5).forEach(d => {
            console.log('--- Duplicate ---');
            console.log('Original ID:', d.original.id, 'Time:', d.original.created_at);
            console.log('Config:    ', d.duplicate.id, 'Time:', d.duplicate.created_at);
            console.log('Message:', d.duplicate.message);
        });
    } else {
        console.log('No obvious duplicates found (same type/message).');
    }
}

main();
