"use client";

import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/server/app/result";

/*
  For the REAL settings pages: run a server action, show its plain-language error (never a stack
  trace: src/server/app/result.ts), and a confirmation when it worked. The action revalidates the
  page itself, so the screen shows the saved state afterwards.
*/
export async function perform<T>(run: Promise<ActionResult<T>>, success?: string | ((data: T) => string)): Promise<T | null> {
  let r: ActionResult<T>;
  try {
    r = await run;
  } catch {
    toast({ title: "Something went wrong", description: "Check your connection and try again.", tone: "danger" });
    return null;
  }
  if (!r.ok) {
    toast({ title: "Not done", description: r.error.message, tone: "danger" });
    return null;
  }
  if (success) toast({ title: typeof success === "function" ? success(r.data) : success, tone: "success" });
  return r.data;
}
