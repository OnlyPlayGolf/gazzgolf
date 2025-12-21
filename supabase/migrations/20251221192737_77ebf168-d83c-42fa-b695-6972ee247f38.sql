-- Update tee names for Djursholms GK
UPDATE courses 
SET tee_names = jsonb_build_object(
  'black', '58',
  'blue', '55',
  'white', '49',
  'yellow', '44',
  'red', '39'
)
WHERE name = 'Djursholms GK';