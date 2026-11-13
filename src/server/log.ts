/*
  Structured logs as JSON lines on stderr (stdout belongs to the STDIO MCP protocol).
  Anything that looks like a credential is redacted before it is written.
*/
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SECRET_KEY = /token|secret|password|authorization|api[-_]?key|signature|cookie/i;
const SECRET_VALUE = /\b(rdl_pat_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{16,})/g;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[…]";
  if (typeof value === "string") return value.replace(SECRET_VALUE, "[redacted]");
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) ? "[redacted]" : redact(v, depth + 1)]));
  }
  return value;
}

export type Logger = Record<Level, (msg: string, data?: Record<string, unknown>) => void> & { child(bind: Record<string, unknown>): Logger };

export function createLogger(level: Level = "info", bind: Record<string, unknown> = {}, sink: (line: string) => void = (l) => process.stderr.write(l + "\n")): Logger {
  const write = (lvl: Level) => (msg: string, data: Record<string, unknown> = {}) => {
    if (ORDER[lvl] < ORDER[level]) return;
    sink(JSON.stringify({ t: new Date().toISOString(), level: lvl, msg, ...(redact({ ...bind, ...data }) as object) }));
  };
  return {
    debug: write("debug"),
    info: write("info"),
    warn: write("warn"),
    error: write("error"),
    child: (more) => createLogger(level, { ...bind, ...more }, sink),
  };
}

export const silentLogger: Logger = createLogger("error", {}, () => {});
