"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { exportDownload } from "@/app/(app)/_actions/render";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/* Downloads an export through a signed link minted at click time. */
export function ExportDownload({ exportId, label = "Download", size = "sm", variant = "secondary" }: { exportId: string; label?: string; size?: "sm" | "md" | "lg"; variant?: "primary" | "secondary" | "action" | "ghost" }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const r = await exportDownload(exportId);
        setBusy(false);
        if (!r.ok) return toast({ title: "Download unavailable", description: r.error.message, tone: "danger" });
        window.location.assign(r.data.url);
      }}
    >
      <Download aria-hidden />
      {label}
    </Button>
  );
}
