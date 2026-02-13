
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

    const seen = new Map();
    const toDelete = [];

    notifications.forEach(n => {
        const key = `${n.type}|${n.message}`;
        if (seen.has(key)) {
            // Found a duplicate (older or same time, since we ordered by created_at desc)
            // The first one we saw was the newest (due to sort), so keep that one.
            toDelete.push(n.id);
        } else {
            seen.set(key, n);
        }
    });

    if (toDelete.length > 0) {
        console.log(`Deleting ${toDelete.length} duplicate notifications...`);
        const { error: deleteError } = await supabase
            .from('admin_notifications')
            .delete()
            .in('id', toDelete);

        if (deleteError) {
            console.error('Error deleting duplicates:', deleteError);
        } else {
            console.log('Successfully deleted duplicates.');
        }
    } else {
        console.log('No duplicates found to delete.');
    }
}

main();
