/** Which Next.js runtime is executing (set by Next.js itself, not configuration). */
export const isNodeRuntime = () => process.env.NEXT_RUNTIME === "nodejs";
