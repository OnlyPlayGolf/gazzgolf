-- Delete all round-related data (child tables first due to foreign keys)

-- Round comments and related
DELETE FROM public.round_comment_replies;
DELETE FROM public.round_comment_likes;
DELETE FROM public.round_comments;

-- Holes data
DELETE FROM public.holes;

-- Round players
DELETE FROM public.round_players;

-- Game groups
DELETE FROM public.game_groups;

-- Pro stats
DELETE FROM public.pro_stats_holes;
DELETE FROM public.pro_stats_rounds;

-- Main rounds table
DELETE FROM public.rounds;

-- Copenhagen games
DELETE FROM public.copenhagen_holes;
DELETE FROM public.copenhagen_games;

-- Match play games
DELETE FROM public.match_play_holes;
DELETE FROM public.match_play_games;

-- Best ball games
DELETE FROM public.best_ball_holes;
DELETE FROM public.best_ball_games;

-- Scramble games
DELETE FROM public.scramble_holes;
DELETE FROM public.scramble_games;

-- Skins games
DELETE FROM public.skins_holes;
DELETE FROM public.skins_games;

-- Umbriago games
DELETE FROM public.umbriago_holes;
DELETE FROM public.umbriago_games;

-- Wolf games
DELETE FROM public.wolf_holes;
DELETE FROM public.wolf_games;