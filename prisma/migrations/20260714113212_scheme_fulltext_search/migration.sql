-- Full-text search over the scheme catalog.
-- Maintained by Postgres itself (GENERATED ALWAYS ... STORED) so it can never
-- drift from the row. Weights encode what actually matters: a title match beats
-- a summary match, which beats category/benefits.
ALTER TABLE "Scheme" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')),    'A') ||
    setweight(to_tsvector('english', coalesce("summary", '')),  'B') ||
    setweight(to_tsvector('english', coalesce("category", '')), 'C') ||
    setweight(to_tsvector('english', coalesce("ministry", '')), 'C') ||
    setweight(to_tsvector('english', coalesce("benefits", '')), 'D')
  ) STORED;

CREATE INDEX "Scheme_searchVector_idx" ON "Scheme" USING GIN ("searchVector");
