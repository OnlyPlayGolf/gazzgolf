-- Set Ludde's (player_3) mulligan on hole 7 for the specific game
UPDATE public.copenhagen_holes 
SET player_3_mulligan = true 
WHERE game_id = '2ede7824-ce93-4911-aa40-fbd9c9eff7e1' 
AND hole_number = 7;