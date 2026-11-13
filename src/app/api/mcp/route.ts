import { handleNextMcp } from "@/mcp/next";

/* Remote MCP endpoint (Streamable HTTP). Authentication: Bearer token on every request. See docs/mcp.md. */
export const POST = (req: Request) => handleNextMcp(req);
export const GET = (req: Request) => handleNextMcp(req);
export const DELETE = (req: Request) => handleNextMcp(req);
