import "server-only";
import { formatEnvIssues, serverSchema } from "./schema";

/* Server environment. Importing this from a Client Component fails the build. */
const parsed = serverSchema.safeParse(
  Object.fromEntries(Object.keys(serverSchema.shape).map((k) => [k, process.env[k] || undefined])),
);
if (!parsed.success) throw new Error(`Invalid server environment:\n${formatEnvIssues(parsed.error)}`);

export const serverEnv = parsed.data;
