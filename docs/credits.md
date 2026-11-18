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

Migration 1119 is applied (2026-11-18). The live tables were empty, so no balance changed. On first
use, each workspace's earlier months are closed once.

## Review (Mission 6, 2026-11-18)

The 1119 migration is live. The code was re-checked against each promise:

| Property | How it holds | Test |
|---|---|---|
| One-month rollover | Carried credits are spent first. Only the month's own unspent grant can carry, so a credit never rolls twice | `credit-rollover.test.ts` "oldest first and expiry after one cycle" |
| Cap of one month's allocation | carried = min(left over, own grant, current plan allocation) | "cap on downgrade" |
| Oldest credits first | Follows from the above: the carry-in is consumed before the month's own grant | same |
| Expiry | `expiry` row in the closed month; the month nets to 0 | "carry with zero-sum closed month" |
| Idempotent and concurrent month-end | Workspace credit lock, plus unique indexes (one grant, expiry, carry-out and carry-in per month) and `credit_period_closes` | "repeated and concurrent processing" (6 at once) |
| No duplicate allocation | `ensureGrant`: lock, then `insert … where not exists`, plus the unique index | same, plus the database-level refusal test |
| Render across month-end | The hold stays in month Q and lowers what carries. Release and charge both land in Q+1 and cancel out: charged once, from Q. A failed render's release returns the credit in Q+1 | "a hold crossing a month" |
| Restricted role | Month close and grants run as `reeldeal_web` (new in Mission 6) | `restricted-roles.test.ts` "closes finished months (rollover)" |

No code change was needed. Known edge, unchanged: a release written in the last milliseconds of a
month that has already been closed isn't carried.

Periods are **calendar months in UTC**. For New Zealand customers the month turns at 1 pm (NZDT) or
noon (NZST) on the 1st. Nothing depends on that today, but it's visible in usage history.

## Decision D-B2: should the credit period follow the Stripe billing period?

**Not decided. Recommendation below. No code or pricing promise was changed.**

### Recommendation

- **Paid subscriptions: yes.** The credit period becomes the subscription's billing period, and
  each period's grant is written when Stripe reports the invoice paid (`invoice.paid`, idempotent
  on the invoice id).
- **Free and pilot workspaces:** stay on calendar months as now.

### Why

| Situation | Calendar month (today) | Stripe period (recommended) |
|---|---|---|
| Subscription starts on the 18th | Credits renew on the 1st. The first "month" is 13 days long, but they paid for a full month | Credits renew on the 18th, the day they pay |
| Monthly renewal | Grant appears on first visit in the month, unrelated to payment | Grant appears when the payment succeeds |
| Rollover | Closes on the 1st | Closes when the period ends (same rule: one cycle, capped, oldest first) |
| Failed payment (Stripe retries over about 2 weeks) | Credits renew anyway: we give credits we may not be paid for | No grant until paid. Carried-in credits stay usable until they expire |
| Downgrade | Cap uses the plan at closing | Downgrade takes effect at period end (Stripe schedule). The next grant and the cap use the new plan |
| Upgrade mid-period | Not handled | Needs a commercial choice (below) |
| Cancellation | Credits renew until someone changes the plan | Credits usable to the end of the paid period, then no new grant |
| Annual plans | Monthly grants on calendar months | Monthly grants on the subscription's monthly anniversaries, written on schedule (the invoice is yearly) |
| Months nobody opened the app | The carry-in expires unused (documented edge) | The grant is written by the webhook, so this edge disappears |

### Choices only you can make (commercial)

1. **Mid-period upgrade:** grant the difference at once (prorated with Stripe) or only from the
   next period? Suggested: immediately, as an `adjustment` equal to the difference. **Today** (seen
   in the Mission 6 browser run): a workspace moved from Free to a paid plan during a month gets
   its new allowance only from the 1st of the next month. Free's one-off grant counts as this
   month's grant. Plans are only changed by Reeldeal today, so grant an `adjustment` by hand if
   that happens before Stripe.
2. **Cancellation:** do unused credits expire at the end of the final paid period? Suggested: yes,
   with no carry into a period that isn't paid for.
3. **Past-due:** can carried-in credits be spent while a payment is retrying? Suggested: yes, until
   the end of the period they were granted for.
4. **Top-ups (D-B3):** keep the proposed 90-day expiry, independent of the period.

### What it would take (when Stripe is built)

- A migration so a period can be a billing-period start date (`YYYY-MM-DD`), not only `YYYY-MM`. The
  `credit_period_closes.period` check allows months only today. Needs your approval when built.
- `ensureGrant` and `closeFinishedPeriods` take the period boundaries from `billing_accounts`
  (already in 1118) for subscribed workspaces, and stay on calendar months otherwise.
- The `invoice.paid` webhook writes the grant with the invoice id as the idempotency key.

## Other decisions

- **D-B3:** top-up credits (proposed 90-day expiry in `pricing-source.md`) need their own expiry
  rows. Not built, because top-ups aren't sold yet.
- **AI generation wallet:** the same closing function supports `ai_generation`, but nothing is
  metered yet.
