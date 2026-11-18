import type { Instrumentation } from "next";
import { isNodeRuntime } from "./env/runtime";

/*
  Server errors (pages, server actions, route handlers) go to Sentry when SENTRY_DSN is set
  (src/server/monitoring/sentry.ts). Only the route pattern, method and error are sent: never the
  query string, headers, cookies or action arguments.
*/
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (!isNodeRuntime()) return;
  const { monitoringEnabled, reportError } = await import("./server/monitoring");
  if (!monitoringEnabled()) return;
  const { safePath } = await import("./server/monitoring/sentry");
  await reportError(err, {
    service: request.path.startsWith("/api/mcp") ? "mcp" : "web",
    tags: { route: context.routePath, route_type: context.routeType, method: request.method },
    extra: { route: safePath(request.path) },
  });
};
