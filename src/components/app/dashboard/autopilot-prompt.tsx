"use client";

import { ArrowRight } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { BRIEF_SUGGESTIONS } from "@/content/sample/dashboard";

/*
  Brief box on the dashboard. A plain GET form to /autopilot?brief=…, so the
  Autopilot screen (Checkpoint 3) receives the brief. Nothing is generated here.
*/
export function AutopilotPrompt() {
  const id = useId();
  const [brief, setBrief] = useState("");
  return (
    <form action="/autopilot" method="get" className="flex flex-col gap-3">
      <label htmlFor={id} className="sr-only">
        Describe the video you want
      </label>
      <div className="flex flex-col gap-2 rounded-[22px] bg-on-media p-2 sm:flex-row sm:items-center sm:rounded-pill">
        <input
          id={id}
          name="brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="e.g. 30s reel for summer bookings"
          className="h-11 min-w-0 flex-1 rounded-pill bg-transparent px-4 text-[15px] text-media-veil outline-none placeholder:text-media-veil/60"
        />
        <Button type="submit" variant="action" shape="pill" className="px-5">
          Create with Autopilot <ArrowRight aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Example briefs">
        {BRIEF_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setBrief(s)}
            className="rounded-pill border border-on-media/40 bg-media-veil/25 px-3 py-1.5 text-xs text-on-media backdrop-blur-sm transition-colors hover:bg-media-veil/45"
          >
            {s}
          </button>
        ))}
      </div>
    </form>
  );
}
