-- Case-insensitive text type for "username".
CREATE EXTENSION IF NOT EXISTS citext;

-- AlterTable: add the columns as nullable first so existing rows can be backfilled.
ALTER TABLE "User" ADD COLUMN     "avatarPath" TEXT,
ADD COLUMN     "username" CITEXT;

-- Backfill: derive a username from the email local part, using the same rules as signup
-- (src/users/username.ts): lowercase, characters outside [a-z0-9_-] become "_", padded with
-- "_" to 3 and truncated to 30 characters. Collisions get a numeric suffix (2, 3, ...), with
-- the base truncated so the result still fits in 30 characters. Users are processed in id
-- order, so the oldest account keeps the bare name.
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN SELECT "id", "email" FROM "User" ORDER BY "id" LOOP
    base := rpad(
      left(regexp_replace(lower(split_part(r."email", '@', 1)), '[^a-z0-9_-]', '_', 'g'), 30),
      3,
      '_'
    );
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM "User" WHERE "username" = candidate::citext) LOOP
      n := n + 1;
      candidate := left(base, 30 - length(n::text)) || n::text;
    END LOOP;
    UPDATE "User" SET "username" = candidate WHERE "id" = r."id";
  END LOOP;
END $$;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
