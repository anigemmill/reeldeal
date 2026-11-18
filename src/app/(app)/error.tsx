"use client";

import { useEffect } from "react";
import { reportClientError } from "@/app/(app)/_actions/monitoring";
import { Button } from "@/components/ui/button";

/* Error boundary for the app: a plain message and a retry. The error goes to monitoring (when configured), not to the screen. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void reportClientError({ message: error.message, name: error.name, digest: error.digest, path: location.pathname }).catch(() => {});
  }, [error]);
  return (
    <div role="alert" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-display">Something went wrong</h1>
      <p className="max-w-md text-ink-muted">This page hit a problem on our side. Nothing you saved is lost. Try again, or come back in a minute.</p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
