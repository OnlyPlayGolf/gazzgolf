-- Session Templates: coaches can save session configurations as reusable templates
CREATE TABLE IF NOT EXISTS session_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    drills JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_session_templates_group ON session_templates(group_id);
CREATE INDEX idx_session_templates_coach ON session_templates(created_by);

-- RLS
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

-- Group members can view templates
CREATE POLICY "Group members can view templates"
    ON session_templates FOR SELECT
    USING (is_group_member(auth.uid(), group_id));

-- Coaches can create templates (using is_coach helper)
CREATE POLICY "Coaches can create templates"
    ON session_templates FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
        AND is_coach(auth.uid())
    );

-- Template creator can update
CREATE POLICY "Template creator can update"
    ON session_templates FOR UPDATE
    USING (auth.uid() = created_by);

-- Template creator can delete
CREATE POLICY "Template creator can delete"
    ON session_templates FOR DELETE
    USING (auth.uid() = created_by);

-- Session Notes: coaches can add notes to completed/closed sessions
CREATE TABLE IF NOT EXISTS session_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, coach_id)
);

-- Indexes
CREATE INDEX idx_session_notes_session ON session_notes(session_id);

-- RLS
ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;

-- Group members can view session notes (via the session's group)
CREATE POLICY "Group members can view session notes"
    ON session_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_sessions gs
            WHERE gs.id = session_notes.session_id
            AND is_group_member(auth.uid(), gs.group_id)
        )
    );

-- Coaches can create notes
CREATE POLICY "Coaches can create session notes"
    ON session_notes FOR INSERT
    WITH CHECK (
        auth.uid() = coach_id
        AND is_coach(auth.uid())
    );

-- Coach can update their own notes
CREATE POLICY "Coach can update own notes"
    ON session_notes FOR UPDATE
    USING (auth.uid() = coach_id);

-- Coach can delete their own notes
CREATE POLICY "Coach can delete own notes"
    ON session_notes FOR DELETE
    USING (auth.uid() = coach_id);

-- Add template_id column to group_sessions (optional FK to track which template was used)
ALTER TABLE group_sessions
    ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES session_templates(id) ON DELETE SET NULL;
