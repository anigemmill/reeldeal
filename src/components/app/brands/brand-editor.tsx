"use client";

import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveBrand } from "@/app/(app)/_actions/brands";
import { finishUpload, startUpload } from "@/app/(app)/_actions/media";
import { Thumb } from "@/components/app/media/thumb";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { COLOUR_PICKER_FALLBACK_HEX, NEW_BRAND_COLOUR_HEX } from "@/content/brand-defaults";
import { relativeTime } from "@/lib/format";

/*
  Brand profile editor over the shared brand service. Every save creates a new
  brand version (kept by the database); storyboards record the version they used,
  so editing a brand never changes what an existing project was based on.
  Only what the customer enters is stored: nothing is invented.
*/
export type BrandData = {
  id?: string;
  name?: string;
  industry?: string;
  website?: string;
  description?: string;
  brand_voice?: string;
  target_audiences?: string[];
  colours?: { name: string; hex: string; role?: string }[];
  typography?: { headings?: string; body?: string; notes?: string };
  guidelines?: string;
  restrictions?: string[];
  logo_media_id?: string;
  version?: number;
  updated_at?: string | null;
};

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function BrandEditor({ brand, canEdit, logoUrl, versions, assets }: { brand: BrandData; canEdit: boolean; logoUrl: string | null; versions: { version: number; name: string; saved_at: string | null }[]; assets: { id: string; title: string; kind: string; thumbnail: string | null }[] }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: brand.name ?? "",
    industry: brand.industry ?? "",
    website: brand.website ?? "",
    description: brand.description ?? "",
    voice: brand.brand_voice ?? "",
    audiences: (brand.target_audiences ?? []).join("\n"),
    headings: brand.typography?.headings ?? "",
    body: brand.typography?.body ?? "",
    guidelines: brand.guidelines ?? "",
    restrictions: (brand.restrictions ?? []).join("\n"),
  });
  const [colours, setColours] = useState(brand.colours ?? []);
  const [logo, setLogo] = useState<{ id: string | null; url: string | null }>({ id: brand.logo_media_id ?? null, url: logoUrl });
  const [busy, setBusy] = useState<"save" | "logo" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    setBusy("save");
    setErrors({});
    const r = await saveBrand(brand.id ?? null, {
      name: f.name,
      industry: f.industry || undefined,
      website: f.website,
      description: f.description || undefined,
      voice: f.voice || undefined,
      audiences: lines(f.audiences),
      colours: colours.filter((c) => c.name && c.hex),
      typography: { headings: f.headings || undefined, body: f.body || undefined },
      guidelines: f.guidelines || undefined,
      restrictions: lines(f.restrictions),
      logo_media_id: logo.id,
    });
    setBusy(null);
    if (!r.ok) {
      const issues = (r.error.details?.issues ?? []) as { field: string; message: string }[];
      setErrors(Object.fromEntries(issues.map((i) => [i.field.split(".")[0]!, i.message])));
      return toast({ title: "Not saved", description: issues.length ? "Check the highlighted fields." : r.error.message, tone: "danger" });
    }
    toast({ title: brand.id ? `Saved as version ${(r.data as { version: number }).version}` : "Brand created", tone: "success" });
    if (!brand.id) router.push(`/brands/${(r.data as { id: string }).id}`);
    else router.refresh();
  };

  const uploadLogo = async (file: File) => {
    const type = file.type;
    if (!["image/png", "image/jpeg", "image/webp"].includes(type)) return toast({ title: "Use a PNG, JPEG or WebP image", tone: "warning" });
    setBusy("logo");
    try {
      const r = await startUpload({ title: `${f.name || "Brand"} logo`, filename: file.name, content_type: type, size_bytes: file.size, tags: ["logo"] });
      if (!r.ok) throw new Error(r.error.message);
      const up = r.data.upload as { method: string; url: string; headers: Record<string, string> };
      const put = await fetch(up.url, { method: "PUT", headers: up.headers, body: file });
      if (!put.ok) throw new Error(`Upload refused (HTTP ${put.status})`);
      const done = await finishUpload(r.data.media_id as string);
      if (!done.ok) throw new Error(done.error.message);
      setLogo({ id: r.data.media_id as string, url: URL.createObjectURL(file) });
      toast({ title: "Logo uploaded", description: "Save the brand to use it.", tone: "success" });
    } catch (e) {
      toast({ title: "Logo not uploaded", description: (e as Error).message, tone: "danger" });
    }
    setBusy(null);
  };

  return (
    <form
      noValidate
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand name" error={errors.name}>
            <Input value={f.name} onChange={set("name")} maxLength={120} required />
          </Field>
          <Field label="Industry" error={errors.industry}>
            <Input value={f.industry} onChange={set("industry")} maxLength={120} />
          </Field>
        </div>
        <Field label="Website" error={errors.website}>
          <Input value={f.website} onChange={set("website")} inputMode="url" placeholder="yourbusiness.co.nz" maxLength={300} />
        </Field>
        <Field label="What you do" hint="A sentence or two in your own words." error={errors.description}>
          <Textarea rows={3} value={f.description} onChange={set("description")} maxLength={2000} />
        </Field>
        <Field label="Brand voice" hint="How you sound, e.g. warm, plain-spoken, never salesy." error={errors.voice}>
          <Textarea rows={2} value={f.voice} onChange={set("voice")} maxLength={1000} />
        </Field>
        <Field label="Target audiences" hint="One per line." error={errors.audiences}>
          <Textarea rows={3} value={f.audiences} onChange={set("audiences")} />
        </Field>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 text-sm font-medium">Colours</legend>
          {colours.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="color" aria-label={`Colour ${i + 1} picker`} value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : COLOUR_PICKER_FALLBACK_HEX} onChange={(e) => setColours((cs) => cs.map((x, k) => (k === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))} className="size-11 shrink-0 cursor-pointer rounded-md border border-line bg-surface" />
              <Input aria-label={`Colour ${i + 1} name`} value={c.name} placeholder="Name, e.g. Lake blue" onChange={(e) => setColours((cs) => cs.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              <Input aria-label={`Colour ${i + 1} hex`} value={c.hex} className="w-28 font-mono" onChange={(e) => setColours((cs) => cs.map((x, k) => (k === i ? { ...x, hex: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove colour ${i + 1}`} onClick={() => setColours((cs) => cs.filter((_, k) => k !== i))}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          {errors.colours ? <p className="text-xs text-danger">Use #RRGGBB for every colour.</p> : null}
          <Button type="button" variant="secondary" size="sm" className="w-fit" disabled={colours.length >= 12} onClick={() => setColours((cs) => [...cs, { name: "", hex: NEW_BRAND_COLOUR_HEX }])}>
            <Plus aria-hidden /> Add colour
          </Button>
          <p className="text-xs text-ink-muted">The renderer uses your first colour for text cards.</p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Heading font" hint="The font name, as used on your website.">
            <Input value={f.headings} onChange={set("headings")} maxLength={80} />
          </Field>
          <Field label="Body font">
            <Input value={f.body} onChange={set("body")} maxLength={80} />
          </Field>
        </div>
        <Field label="Guidelines" hint="Anything a video editor should follow." error={errors.guidelines}>
          <Textarea rows={4} value={f.guidelines} onChange={set("guidelines")} maxLength={10000} />
        </Field>
        <Field label="Restrictions" hint="Things never to say or show. One per line." error={errors.restrictions}>
          <Textarea rows={3} value={f.restrictions} onChange={set("restrictions")} />
        </Field>
        {canEdit ? (
          <Button type="submit" variant="primary" size="lg" className="w-fit" loading={busy === "save"}>
            {brand.id ? "Save changes" : "Create brand"}
          </Button>
        ) : (
          <p className="text-sm text-ink-muted">Your role can view this brand but not change it.</p>
        )}
      </fieldset>

      <aside className="flex flex-col gap-5">
        <section aria-labelledby="logo-h" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <h2 id="logo-h" className="font-semibold">
            Logo
          </h2>
          <Thumb src={logo.url} alt="Brand logo" kind="image" ratio="16:9" className="bg-surface-muted [&_img]:object-contain" />
          {canEdit ? (
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-line-strong px-3 py-2 text-sm hover:bg-surface-muted">
              <ImagePlus className="size-4" aria-hidden /> {busy === "logo" ? "Uploading…" : logo.id ? "Replace logo" : "Upload logo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy === "logo"} onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])} />
            </label>
          ) : null}
          <p className="text-xs text-ink-muted">Stored in your private library. Logo end cards in renders are not available yet.</p>
        </section>
        {brand.id ? (
          <section aria-labelledby="versions-h" className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <h2 id="versions-h" className="font-semibold">
              Versions
            </h2>
            <ol className="flex flex-col gap-1 text-sm">
              {versions.slice(0, 8).map((v) => (
                <li key={v.version} className="flex justify-between gap-2">
                  <span>
                    v{v.version} · {v.name}
                  </span>
                  <span className="text-ink-muted">{relativeTime(v.saved_at)}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-ink-muted">Existing storyboards keep the version they were made with.</p>
          </section>
        ) : null}
        {assets.length ? (
          <section aria-labelledby="assets-h" className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <h2 id="assets-h" className="font-semibold">
              Brand assets
            </h2>
            <ul className="grid grid-cols-3 gap-2">
              {assets.map((a) => (
                <li key={a.id} title={a.title}>
                  <Thumb src={a.thumbnail} alt={a.title} kind={a.kind} ratio="1:1" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
    </form>
  );
}
