# R2 bucket rules for reeldeal media

Apply in the Cloudflare dashboard (R2 → bucket → Settings) or with Wrangler.

- **Public access: off.** No r2.dev URL, no custom domain. Every read and write uses a signed URL.
- **CORS:** `cors.json` (add your app origin when the web upload screen exists; MCP clients and workers do not need CORS).
  `npx wrangler r2 bucket cors set <bucket> --file infra/r2/cors.json`
- **Abort incomplete multipart uploads after 7 days** (abandoned large uploads otherwise keep their parts):
  `npx wrangler r2 bucket lifecycle add <bucket> abort-incomplete --prefix org/ --abort-multipart-days 7`
- **No expiry rule on `org/*/media/*`.** Originals are kept until the customer deletes them.
- **API token:** Object Read & Write, applied to this bucket only. No admin permissions.
