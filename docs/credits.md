# Video credits: allocation, rollover and expiry

The promise in `config/pricing.json` and `docs/pricing-source.md` section 6 is unchanged:

- video credits roll over for **one** billing cycle
- rollover is capped at **one month's allocation**
- the **oldest credits are used first**
- Free's one-off allowance never rolls over or expires

Until migration `20261119000001_credit_rollover` (applied to the live project 2026-11-18; see `docs/review/migration-execution-record-2026-11-18.md`), the ledger only
counted the current month. Rollover was promised but not delivered.

## How it works

All rows stay append-only in `credit_transactions`. Nothing is ever edited or deleted.

| Event | Rows |
|---|---|
| A month begins (first visit, render quote or workspace creation) | Every finished month not yet closed is closed, oldest first. Then this month's `grant` is written, if missing |
| Closing month Q | Left over L = sum of Q. **Carried** = min(L, Q's own grant, the current plan's allocation). **Expired** = L − carried. In Q: `rollover −carried` and `expiry −expired`, so Q nets to 0. In Q+1: `rollover +carried`. One row in `credit_period_closes` |
| Render | `hold` (this month). On success, `release` + `charge`; on failure, `release` (both in the month the render finishes) |

**Why min(L, own grant):** carried credits are spent first. So whatever is left at the end of the
month is that month's own credits first, and only those can carry. Credits carried in that weren't
used expire. They never roll twice.

**Plan changes:** the cap uses the plan at the time of closing. A downgrade from Creator to Starter
carries at most 5 credits.

**Months with no activity:** grants are created when the workspace is used. A month in which nobody
opened the app has no grant, so anything carried into it expires. When Stripe arrives, grants
should be written when an invoice is paid (decision D-B2), so this case goes away.

**Balances** (`availableVideoCredits`) are the sum of the current month, carry-in included.
`getUsage` adds:

- `carried_over`
- `carries_forward_if_unused`
- `expires_at_period_end`
- holds still open from any month (the earlier figure went negative when a render crossed midnight
  at the end of a month)

**No double counting:**

- Closing runs under the workspace's credit lock, the same lock renders take.
- Unique indexes allow one grant, one expiry, one carry out and one carry in per workspace, wallet
  and month.
- `credit_period_closes` has one row per closed month.

All of this is tested, including six simultaneous requests at a month boundary.

**Periods** are calendar months (UTC) until Stripe billing dates exist (D-B2).

**Known edge:** a release written by a render worker in the last instant of a month, after that month
has already been closed, lands in a closed month and isn't carried. The window is milliseconds, and
the credits only go back to a month that no longer counts. Accepted and recorded.

## Tests (`src/server/services/credit-rollover.test.ts`, 12)

- month and year boundary
- carry with zero-sum closed month
- oldest first and expiry after one cycle
- cap on downgrade
- skipped month
- repeated and concurrent processing (plus a database-level duplicate refusal)
- overspent month
- a hold crossing a month
- forward and expiring figures
- insufficient balance
- Free never rolls
- members read only their own close history; clients can't write ledger rows

## Live balances

Nothing changes until the migration is approved and applied. Every live table is empty today, so
no live balance changes. On first use after applying, each workspace's earlier months are closed
once.

## Decisions needed

- **D-B2:** billing cycle = Stripe subscription period (recommended) instead of calendar month, with
  grants written on paid invoices.
- **D-B3:** top-up credits (proposed 90-day expiry in `pricing-source.md`) need their own expiry
  rows. Not built, because top-ups aren't sold yet.
- **AI generation wallet:** the same closing function supports `ai_generation`, but nothing is
  metered yet.
