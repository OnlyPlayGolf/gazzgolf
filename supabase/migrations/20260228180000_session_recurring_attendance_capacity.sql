-- Phase 3: Recurring sessions, max participants, attendance tracking, reminders

-- Add capacity and recurrence fields to group_sessions
ALTER TABLE group_sessions
    ADD COLUMN IF NOT EXISTS max_participants INT,
    ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT,         -- null, 'weekly', 'biweekly', 'monthly'
    ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES group_sessions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Index for recurring session lookups
CREATE INDEX IF NOT EXISTS idx_group_sessions_parent ON group_sessions(parent_session_id) WHERE parent_session_id IS NOT NULL;

-- Session Attendance: coach marks who actually attended
CREATE TABLE IF NOT EXISTS session_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    attended BOOLEAN NOT NULL DEFAULT true,
    marked_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, user_id)
);

CREATE INDEX idx_session_attendance_session ON session_attendance(session_id);
CREATE INDEX idx_session_attendance_user ON session_attendance(user_id);

-- RLS for session_attendance
ALTER TABLE session_attendance ENABLE ROW LEVEL SECURITY;

-- Group members can view attendance
CREATE POLICY "Group members can view attendance"
    ON session_attendance FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_sessions gs
            WHERE gs.id = session_attendance.session_id
            AND is_group_member(auth.uid(), gs.group_id)
        )
    );

-- Coaches can mark attendance
CREATE POLICY "Coaches can mark attendance"
    ON session_attendance FOR INSERT
    WITH CHECK (
        auth.uid() = marked_by
        AND is_coach(auth.uid())
    );

-- Coaches can update attendance they marked
CREATE POLICY "Coaches can update attendance"
    ON session_attendance FOR UPDATE
    USING (auth.uid() = marked_by);

-- Coaches can delete attendance records
CREATE POLICY "Coaches can delete attendance"
    ON session_attendance FOR DELETE
    USING (auth.uid() = marked_by);

-- Add 'waitlisted' as a valid response status (the check is application-level, not DB constraint)
-- The session_responses table already accepts any string in response_status,
-- so we just need the iOS app to handle 'waitlisted' status.
