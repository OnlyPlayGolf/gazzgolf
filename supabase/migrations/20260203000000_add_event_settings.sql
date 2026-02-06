-- Event settings: who can add rounds and event-level permissions
-- only_creator_can_add_rounds: when true, only the event creator can link new rounds to this event.
-- When false, any participant (user who has a round in the event) can add rounds to the event.
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS only_creator_can_add_rounds boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.events.only_creator_can_add_rounds IS 'When true, only the event creator can add/link rounds to this event. When false, participants can add rounds.';
