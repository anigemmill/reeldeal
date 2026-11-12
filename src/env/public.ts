import { formatEnvIssues, publicSchema } from "./schema";

/*
  Public environment, safe in browser code. Each variable is referenced by its
  full name so Next.js can inline it; nothing else from process.env reaches the client.
*/
const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
});
if (!parsed.success) throw new Error(`Invalid public environment:\n${formatEnvIssues(parsed.error)}`);

export const publicEnv = parsed.data;
