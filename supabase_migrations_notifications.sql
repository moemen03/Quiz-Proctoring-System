
-- Create Admin Notifications Table
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL, -- e.g. 'schedule_warning'
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    ta_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all notifications" 
ON admin_notifications FOR SELECT 
TO authenticated 
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "System/TAs can insert notifications" 
ON admin_notifications FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Admins can update (mark read)" 
ON admin_notifications FOR UPDATE
TO authenticated 
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);
