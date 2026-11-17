# Team permissions

Roles: **Owner**, **Administrator**, **Editor**, **Viewer**. They're the existing `member_role`
enum, ordered viewer < editor < admin < owner. The rules below are enforced in the database by
migration `20261118000001` (prepared, not yet applied live). They're tested in
`src/server/services/team.test.ts`, which runs as real users on PGlite and on Supabase's Postgres
image.

## Who can do what

| Action | Viewer | Editor | Admin | Owner |
|---|---|---|---|---|
| View library, projects, exports; download | ✓ | ✓ | ✓ | ✓ |
| Upload, edit brands and projects, generate, render (spends credits) | | ✓ | ✓ | ✓ |
| Delete content; AI keyframe consent; edit workspace details | | | ✓ | ✓ |
| Invite editors and viewers; change their roles; remove them | | | ✓ | ✓ |
| Invite, promote, demote or remove administrators | | | | ✓ |
| Transfer ownership; billing; delete workspace | | | | ✓ |
| Leave the workspace | ✓ | ✓ | ✓ | Transfer first |
| Create access tokens | Read only | ✓ | ✓ | ✓ |

## The rules, and where each is enforced

| Rule | Enforcement | Test |
|---|---|---|
| One owner per workspace | Unique partial index `memberships_one_owner`; the transfer function demotes before promoting | "the database itself forbids a second owner" |
| Nobody changes their own role | `change_member_role` refuses `p_user = auth.uid()` | "nobody changes their own role, including the owner" |
| Users can't elevate themselves by any route | No insert/update/delete grant on `memberships`; changes only through functions | "users cannot elevate themselves by writing memberships directly" |
| Administrators can't take ownership | `transfer_ownership` requires the caller to be owner; `change_member_role` refuses owner as a target role | "administrators can't take ownership…" |
| Ownership transfer needs secure confirmation | The app checks the owner's password (Supabase Auth) and the exact workspace name; the database checks owner, target role (admin/editor) and target confirmed email | "needs the owner's password and the exact workspace name", "the new owner must be…" |
| Removed members lose access immediately | Membership row deleted; their tokens for that workspace are deleted by the existing foreign key; every request re-reads memberships | "removed members lose access immediately: session, tokens and data" |
| Invitations bound to the right organisation | Created only by that workspace's admins/owner; accepting adds a membership to the invitation's own organisation only | "cannot invite into another organisation" |
| Only the invited address can accept | Caller's **confirmed** Supabase Auth email must equal the invitation's; the same error for every mismatch | "only the matching, confirmed account can accept…" |
| Expired and revoked invitations don't work; links are single-use | Checked in `accept_invitation` under a row lock | "expired and revoked invitations don't work…", single-use assertions |
| Seats from the plan | Members plus open unexpired invitations ≤ `users` in `config/pricing.json` | "…enforces the plan's seats" |
| The app's idea of your role doesn't matter | Every function reads the caller's real role from `memberships` | tests pass a forged role in the context |
| Everything is audited | `audit_events` written in the same transaction; administrators can read | "transfers: … all audited" |

## Invitation links

- Format: `/invite/rdl_inv_<43 characters>` (256-bit random).
- Only the SHA-256 is stored. The link is shown once to the admin (or emailed by Resend, when set
  up) and never logged.
- Inviting the same address again revokes the earlier link.
- Links expire after 7 days.
