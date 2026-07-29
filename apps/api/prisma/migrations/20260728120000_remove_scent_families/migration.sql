UPDATE "SiteContent" AS content
SET "draftContent" = jsonb_set(
  content."draftContent",
  '{home,sections}',
  COALESCE(
    (
      SELECT jsonb_agg(section - 'scentLinks')
      FROM jsonb_array_elements(content."draftContent" #> '{home,sections}') AS section
      WHERE section->>'type' <> 'SCENT_FINDER'
    ),
    '[]'::jsonb
  )
)
WHERE jsonb_typeof(content."draftContent" #> '{home,sections}') = 'array';

UPDATE "SiteContent" AS content
SET "publishedContent" = jsonb_set(
  content."publishedContent",
  '{home,sections}',
  COALESCE(
    (
      SELECT jsonb_agg(section - 'scentLinks')
      FROM jsonb_array_elements(content."publishedContent" #> '{home,sections}') AS section
      WHERE section->>'type' <> 'SCENT_FINDER'
    ),
    '[]'::jsonb
  )
)
WHERE jsonb_typeof(content."publishedContent" #> '{home,sections}') = 'array';

UPDATE "SiteContentRevision" AS revision
SET "content" = jsonb_set(
  revision."content",
  '{home,sections}',
  COALESCE(
    (
      SELECT jsonb_agg(section - 'scentLinks')
      FROM jsonb_array_elements(revision."content" #> '{home,sections}') AS section
      WHERE section->>'type' <> 'SCENT_FINDER'
    ),
    '[]'::jsonb
  )
)
WHERE jsonb_typeof(revision."content" #> '{home,sections}') = 'array';

DROP TABLE IF EXISTS "ProductScentFamily";
DROP TABLE IF EXISTS "ScentFamily";
