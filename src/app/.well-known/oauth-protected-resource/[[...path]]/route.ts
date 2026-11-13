import { nextProtectedResourceMetadata } from "@/mcp/next";

/* OAuth 2.0 Protected Resource Metadata (RFC 9728) for the MCP endpoint. */
export const GET = (req: Request) => nextProtectedResourceMetadata(req);
