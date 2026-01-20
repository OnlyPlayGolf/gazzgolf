-- Add stable cross-round identity for tournament rounds (event-linked stroke play)
-- Used to aggregate totals across multiple rounds, including guest players.

alter table public.round_players
add column if not exists event_player_id uuid;

create index if not exists round_players_event_player_id_idx
on public.round_players (event_player_id);

