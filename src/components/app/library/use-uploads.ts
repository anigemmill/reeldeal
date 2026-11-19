"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cancelUpload, finishUpload, startUpload } from "@/app/(app)/_actions/media";

/*
  Browser uploads straight to private storage through signed URLs: one PUT for
  small files, parallel multipart parts for large ones (each part retried up to 3
  times). File bytes never pass through the Next.js server. The server validates
  type and size when the upload starts and checks the stored object when it finishes.
*/

export const ACCEPT: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export const ACCEPT_ATTR = [...new Set(Object.values(ACCEPT))].join(",") + ",.mov,.mp4,.webm,.jpg,.jpeg,.png,.webp";

export type UploadPhase = "queued" | "preparing" | "uploading" | "finishing" | "done" | "failed" | "cancelled";
export type UploadItem = {
  id: string;
  file: File;
  mediaId?: string;
  phase: UploadPhase;
  loaded: number;
  error?: string;
  note?: string;
};

type Part = { part_number: number; url: string; byte_start: number; byte_end_inclusive: number };
type Plan = { method: "PUT"; url: string; headers: Record<string, string> } | { method: "multipart"; parts: Part[] };

const typeOf = (f: File) => (f.type && Object.values(ACCEPT).includes(f.type) ? f.type : ACCEPT[f.name.split(".").pop()?.toLowerCase() ?? ""]);

function put(url: string, body: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 412 ? "This file was already uploaded" : `Storage refused the upload (HTTP ${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.onabort = () => reject(new DOMException("cancelled", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

async function withRetry<T>(fn: () => Promise<T>, signal: AbortSignal, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (signal.aborted || i >= tries || (e as Error).message.includes("already uploaded")) throw e;
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
}

export function useUploads(onSettled: () => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const controllers = useRef(new Map<string, AbortController>());
  const plans = useRef(new Map<string, Plan>());
  const running = useRef(0);
  const queue = useRef<string[]>([]);

  const patch = useCallback((id: string, p: Partial<UploadItem>) => setItems((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x))), []);

  const sendParts = useCallback(
    async (item: UploadItem, parts: Part[], signal: AbortSignal, already = 0) => {
      const loaded = new Map<number, number>();
      const report = () => patch(item.id, { loaded: already + [...loaded.values()].reduce((a, b) => a + b, 0) });
      let next = 0;
      const worker = async () => {
        while (next < parts.length) {
          const part = parts[next++]!;
          const blob = item.file.slice(part.byte_start, part.byte_end_inclusive + 1);
          await withRetry(() => put(part.url, blob, {}, (l) => (loaded.set(part.part_number, l), report()), signal), signal);
          loaded.set(part.part_number, blob.size);
          report();
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, parts.length) }, worker));
    },
    [patch],
  );

  const finish = useCallback(
    async (item: UploadItem, mediaId: string, signal: AbortSignal) => {
      for (let round = 0; round < 3; round++) {
        patch(item.id, { phase: "finishing" });
        const r = await finishUpload(mediaId);
        if (!r.ok) throw new Error(r.error.message);
        const d = r.data as { status: string; missing_parts?: Part[]; analysis: { queued: boolean; reason?: string } | null };
        if (d.status === "uploaded") {
          patch(item.id, { phase: "done", loaded: item.file.size, note: d.analysis ? (d.analysis.queued ? "Analysing" : `Uploaded · analysis not started: ${d.analysis.reason}`) : "Uploaded" });
          return;
        }
        if (!d.missing_parts?.length) throw new Error("The upload could not be completed");
        patch(item.id, { phase: "uploading" });
        const missingBytes = d.missing_parts.reduce((a, p) => a + p.byte_end_inclusive - p.byte_start + 1, 0);
        await sendParts(item, d.missing_parts, signal, item.file.size - missingBytes);
      }
      throw new Error("Some parts could not be uploaded");
    },
    [patch, sendParts],
  );

  const run = useCallback(
    async (item: UploadItem) => {
      const ctl = new AbortController();
      controllers.current.set(item.id, ctl);
      try {
        let mediaId = item.mediaId;
        let plan = plans.current.get(item.id);
        if (!mediaId || !plan) {
          patch(item.id, { phase: "preparing", error: undefined });
          const type = typeOf(item.file)!;
          const r = await startUpload({ title: item.file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || item.file.name, filename: item.file.name, content_type: type, size_bytes: item.file.size });
          if (!r.ok) throw new Error(r.error.message);
          mediaId = r.data.media_id as string;
          plan = r.data.upload as Plan;
          plans.current.set(item.id, plan);
          patch(item.id, { mediaId });
        }
        if (ctl.signal.aborted) return;
        if (item.mediaId && plan.method === "multipart") {
          // Retry of a multipart upload: the server lists what arrived and re-signs only the missing parts.
          await finish(item, mediaId, ctl.signal);
          return;
        }
        patch(item.id, { phase: "uploading", loaded: 0 });
        if (plan.method === "PUT") await withRetry(() => put(plan.url, item.file, plan.headers, (l) => patch(item.id, { loaded: l }), ctl.signal), ctl.signal);
        else await sendParts(item, plan.parts, ctl.signal);
        await finish(item, mediaId, ctl.signal);
      } catch (e) {
        if ((e as Error).name === "AbortError" || ctl.signal.aborted) return;
        patch(item.id, { phase: "failed", error: (e as Error).message });
      } finally {
        controllers.current.delete(item.id);
        running.current--;
        pump();
        onSettled();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pump is stable via refs
    [patch, sendParts, finish, onSettled],
  );

  const pump = useCallback(() => {
    while (running.current < 2 && queue.current.length) {
      const id = queue.current.shift()!;
      const item = itemsRef.current.find((x) => x.id === id);
      if (!item) continue;
      running.current++;
      void run(item);
    }
  }, [run]);

  const add = useCallback(
    (files: FileList | File[]) => {
      const added: UploadItem[] = [];
      for (const file of Array.from(files)) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (!typeOf(file)) added.push({ id, file, phase: "failed", loaded: 0, error: "This file type isn't supported. Use MP4, MOV, WebM, JPEG, PNG or WebP." });
        else if (file.size === 0) added.push({ id, file, phase: "failed", loaded: 0, error: "This file is empty." });
        else {
          added.push({ id, file, phase: "queued", loaded: 0 });
          queue.current.push(id);
        }
      }
      setItems((list) => [...added, ...list]);
      setTimeout(pump, 0);
    },
    [pump],
  );

  const cancel = useCallback(
    async (id: string) => {
      controllers.current.get(id)?.abort();
      queue.current = queue.current.filter((q) => q !== id);
      const item = items.find((x) => x.id === id);
      patch(id, { phase: "cancelled", error: undefined });
      if (item?.mediaId) await cancelUpload(item.mediaId);
      onSettled();
    },
    [items, patch, onSettled],
  );

  const retry = useCallback(
    async (id: string) => {
      const item = items.find((x) => x.id === id);
      if (!item) return;
      // A single-PUT link may have expired: start that file afresh (the old record is cancelled).
      if (item.mediaId && plans.current.get(id)?.method === "PUT") {
        await cancelUpload(item.mediaId);
        plans.current.delete(id);
        patch(id, { mediaId: undefined });
        item.mediaId = undefined;
      }
      patch(id, { phase: "queued", error: undefined });
      queue.current.push(id);
      setTimeout(pump, 0);
    },
    [items, patch, pump],
  );

  const clearFinished = useCallback(() => setItems((list) => list.filter((x) => !["done", "cancelled"].includes(x.phase))), []);
  const active = items.some((x) => ["queued", "preparing", "uploading", "finishing"].includes(x.phase));
  return { items, add, cancel, retry, clearFinished, active };
}

/**
 * One small file (a logo or a guidelines PDF: always a single signed PUT, under the multipart
 * threshold). Returns the media id once the server has checked the stored object.
 */
export async function uploadSmallFile(file: File, contentType: string, opts: { title?: string; onProgress?: (loaded: number) => void; signal?: AbortSignal } = {}): Promise<string> {
  const signal = opts.signal ?? new AbortController().signal;
  const r = await startUpload({ title: opts.title ?? (file.name.replace(/\.[^.]+$/, "") || file.name), filename: file.name, content_type: contentType, size_bytes: file.size });
  if (!r.ok) throw new Error(r.error.message);
  const plan = r.data.upload as Plan;
  const mediaId = r.data.media_id as string;
  if (plan.method !== "PUT") {
    await cancelUpload(mediaId);
    throw new Error("This file is too large here. Upload it from the Library instead.");
  }
  try {
    await withRetry(() => put(plan.url, file, plan.headers, opts.onProgress ?? (() => {}), signal), signal);
  } catch (e) {
    await cancelUpload(mediaId).catch(() => {});
    throw e;
  }
  const done = await finishUpload(mediaId);
  if (!done.ok) throw new Error(done.error.message);
  return mediaId;
}
