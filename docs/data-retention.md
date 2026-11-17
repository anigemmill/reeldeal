# Workspace deletion and data retention: recommendation

Status: **recommendation only. Nothing is built that deletes data**, and nothing in this document has
been applied. The decisions in section 6 need your approval, and the retention periods need your
legal and accounting advice (New Zealand Privacy Act 2020, the Tax Administration Act's seven-year
record keeping, and the Australian Privacy Act for Australian customers).

## 1. Principles

1. **Deactivate first, delete later.** A deletion request removes access straight away and
   deletes content only after a recovery period. A mistaken or malicious deletion (for example, a
   compromised owner account) can then be undone.
2. **Content and records are different.** Customer content (footage, brands, projects, exports) is
   deleted. Financial and security records (invoices, the credit ledger, the audit log) are kept for
   their legal period, with personal details minimised.
3. **Deletion is a job, not a request.** It runs in the worker, in batches, is resumable, and logs
   what it removed (counts, never content).
4. **Nobody but the owner can ask.** The owner types the workspace name and re-enters their
   password, as for ownership transfer.

## 2. Recommended lifecycle

| Stage | When | What happens | Reversible? |
|---|---|---|---|
| **Requested** | Owner confirms deletion | `organisations.deletion_requested_at` and `_by` set. Every member, token and invitation loses access at once (membership checks refuse a workspace in deletion). Renders and analysis in progress are cancelled, and holds released. Billing set to cancel at period end (Stripe stage). Every member gets an email | Yes |
| **Recovery period** | **30 days** (recommended; the design says 14 days [TO CONFIRM]) | Content stays in storage, unreachable. The owner can sign in and cancel from a single "This workspace is scheduled for deletion" page | Yes: the owner cancels |
| **Content deleted** | Day 30 | Worker job: R2 objects under `org/{orgId}/` (originals, proxies, thumbnails, exports), then rows in `media_*`, `projects`, `storyboards`, `video_*`, `brand_*`, `exports`, `jobs`, `api_tokens`, `invitations`, `memberships`, `user_preferences` | No |
| **Records retained** | Day 30 to 7 years | The `organisations` row is reduced to id, legal name, deletion dates and plan. `credit_transactions`, `billing_accounts` and invoices (in Stripe) are kept. `audit_events` are kept for **2 years**, with emails replaced by user ids | n/a |
| **Purged** | After the retention period | Remaining rows deleted by a scheduled job | No |

## 3. Backups

- Supabase daily backups (and PITR, if enabled) keep deleted rows until the backup ages out:
  **7 days** on Pro by default, up to 28 with PITR. R2 has no automatic versioning on
  `reeldeal-dev-media`, so deleted objects are gone at once.
- Say this in the privacy policy: "Deleted data may remain in encrypted backups for up to N days and
  is then overwritten." Backups are never restored selectively to bring deleted customer data back,
  except to recover from our own mistake.
- If a backup is restored for disaster recovery, re-run the deletion jobs for every workspace whose
  deletion date has passed. Keep `deletion_requested_at` on the reduced organisation row so this is
  possible.

## 4. Other cases

| Case | Recommendation |
|---|---|
| A member leaves or is removed | Already built: access removed at once, their tokens revoked. Their uploads stay (they belong to the workspace). Audit events keep their user id |
| Account deletion (person, not workspace) | Not built (S12). Refused while they own a workspace (transfer or delete it first). Otherwise remove their memberships, tokens, profile and preferences, then delete the Auth user. Audit rows keep the id and lose the email |
| Unpaid subscription | Not deletion: read-only after a grace period (Stripe stage). Deletion only on request, or after 12 months unpaid with three emails (decision) |
| Free workspaces inactive for a long time | Optional: email at 11 months of no sign-in; deletion request at 12 months with the same 30-day recovery (decision) |
| Permanent deletion on request (privacy request) | The same flow with no recovery period, after verifying identity. Records the law requires are still kept and listed in the reply |
| Data export before deletion | Owner downloads exports from the Exports page. Bulk export of originals is a later feature (decision: needed before deletion launches?) |

## 5. What it needs (not built)

- Migration: `organisations.deletion_requested_at`, `deletion_requested_by`, `deleted_at`, and
  membership checks that refuse a workspace in deletion (`private.is_org_member`).
- `requestWorkspaceDeletion` / `cancelWorkspaceDeletion` services (owner only, typed name and
  password).
- A deletion worker job with per-step progress and retries. R2 deletion uses the object-scoped
  token's DeleteObject on the `org/{orgId}/` prefix.
- Emails (Resend): to all members on request, and to the owner 3 days before content deletion.
- Tests: access removed at once; cancel restores everything; the job is idempotent and resumable;
  another workspace's data is never touched; records are kept.

## 6. Decisions needing your approval

- **D-W1** Recovery period: **30 days** (recommended) or 14 (current design text).
- **D-W2** Retention: invoices and ledger 7 years (accounting advice); audit log 2 years.
- **D-W3** Backup window stated in the privacy policy (depends on the Supabase plan and PITR).
- **D-W4** Inactive Free workspaces: delete after 12 months, or keep.
- **D-W5** Unpaid paid workspaces: read-only, then delete after 12 months, or keep read-only.
- **D-W6** Whether bulk export of originals is required before deletion launches.

Until these are decided, the workspace page's deletion button stays preview-only and says so (U9).
