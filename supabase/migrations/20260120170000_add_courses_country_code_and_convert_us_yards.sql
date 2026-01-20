-- Persist country_code for courses and convert US course hole distances from yards to meters.
-- Assumption: US course_holes distances were imported as yards; Swedish/other courses are already meters.
-- Conversion: meters = yards / 1.09361

alter table public.courses
add column if not exists country_code text;

-- Backfill US courses based on location text (best-effort)
update public.courses
set country_code = 'US'
where country_code is null
  and location is not null
  and (
    location ilike '%usa%'
    or location ilike '%united states%'
    or upper(trim(split_part(location, ',', array_length(string_to_array(location, ','), 1)))) in (
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
      'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
      'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
      'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
    )
  );

-- Convert tee distances for US courses from yards to meters (rounded to integer meters)
update public.course_holes ch
set
  black_distance  = case when black_distance  is not null and black_distance  > 0 then round(black_distance  / 1.09361)::int else black_distance  end,
  blue_distance   = case when blue_distance   is not null and blue_distance   > 0 then round(blue_distance   / 1.09361)::int else blue_distance   end,
  white_distance  = case when white_distance  is not null and white_distance  > 0 then round(white_distance  / 1.09361)::int else white_distance  end,
  silver_distance = case when silver_distance is not null and silver_distance > 0 then round(silver_distance / 1.09361)::int else silver_distance end,
  gold_distance   = case when gold_distance   is not null and gold_distance   > 0 then round(gold_distance   / 1.09361)::int else gold_distance   end,
  yellow_distance = case when yellow_distance is not null and yellow_distance > 0 then round(yellow_distance / 1.09361)::int else yellow_distance end,
  red_distance    = case when red_distance    is not null and red_distance    > 0 then round(red_distance    / 1.09361)::int else red_distance    end,
  orange_distance = case when orange_distance is not null and orange_distance > 0 then round(orange_distance / 1.09361)::int else orange_distance end
where ch.course_id in (
  select id from public.courses where country_code = 'US'
);

