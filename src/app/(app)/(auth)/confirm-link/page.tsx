import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/app/auth/auth-card";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Confirm" };

/*
  The page an emailed link opens (src/app/auth/callback/route.ts). Work email scanners open
  every link in a message; if opening the link used up the one-time token, the person would
  find it expired. So the link only shows this page, and the token is used when someone
  presses the button, which posts it to /auth/callback. A plain form: works without JavaScript.
*/
const COPY = {
  signup: { title: "Confirm your", accent: "email.", button: "Confirm my email" },
  recovery: { title: "Reset your", accent: "password.", button: "Continue to reset my password" },
  email_change: { title: "Confirm your new", accent: "email.", button: "Confirm my new email" },
  other: { title: "Almost", accent: "there.", button: "Continue" },
} as const;

async function Content({ searchParams }: PageProps<"/confirm-link">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const tokenHash = one(q.token_hash);
  const type = one(q.type);
  const flowParam = one(q.flow);
  const flow = flowParam === "signup" || flowParam === "recovery" || flowParam === "email_change" ? flowParam : "other";
  const next = one(q.next);
  const copy = COPY[flow];

  if (!tokenHash || !type) {
    return (
      <AuthCard title="This link is" accent="incomplete." intro="Part of the link is missing. Open it again from the email, or copy the whole link into your browser." footer={<SignInLink />}>
        {null}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={copy.title}
      accent={copy.accent}
      intro="Press the button to continue. This extra step stops email security scanners from using up your link before you do."
      footer={<SignInLink />}
    >
      <form method="post" action={withBasePath("/auth/callback")} className="flex flex-col gap-4">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="flow" value={flow} />
        {next ? <input type="hidden" name="next" value={safeNextPath(next)} /> : null}
        <Button type="submit" variant="primary" size="lg">
          {copy.button}
        </Button>
      </form>
    </AuthCard>
  );
}

function SignInLink() {
  return (
    <>
      Already done this? <Link href="/sign-in" className="font-medium text-link underline-offset-4 hover:underline">Sign in</Link>
    </>
  );
}

export default function Page(props: PageProps<"/confirm-link">) {
  return (
    <Suspense fallback={null}>
      <Content {...props} />
    </Suspense>
  );
}
