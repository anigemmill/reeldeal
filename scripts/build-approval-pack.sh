#!/usr/bin/env bash
# Builds docs/review/migration-approval-pack.md from its hand-written head plus the SQL files,
# verbatim, so the pack can never drift from what would be applied. Usage: bash scripts/build-approval-pack.sh
set -euo pipefail
cd "$(dirname "$0")/.."
out=docs/review/migration-approval-pack.md
{
  cat docs/review/migration-approval-pack.md.head
  for f in supabase/migrations/20261117000001_restricted_runtime_roles.sql supabase/migrations/20261118000001_teams_workspace_onboarding.sql supabase/migrations/20261119000001_credit_rollover.sql \
           supabase/rollback/20261117000001_restricted_runtime_roles.down.sql supabase/rollback/20261118000001_teams_workspace_onboarding.down.sql supabase/rollback/20261119000001_credit_rollover.down.sql; do
    printf '\n### `%s`\n\nSHA-256 `%s`\n\n```sql\n' "$f" "$(sha256sum "$f" | cut -c1-16)"
    cat "$f"
    printf '```\n'
  done
} > "$out"
echo "wrote $out"
