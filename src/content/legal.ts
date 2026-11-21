/*
  Terms of Service and Privacy Policy: FIRST DRAFT (2026-11-21), written for a New Zealand
  business from what the product actually does. It is not legal advice and has not been
  reviewed by a lawyer: the pages say so on screen and stay out of search engines until the
  owner's adviser signs it off. Anything in [BRACKETS] is a fact still to confirm.

  Keep these facts in step with the product. If a provider, region, retention period or
  credit rule changes (config/pricing.json, docs/data-retention.md,
  docs/infrastructure-setup.md), change the text here too.
*/

/** A paragraph, or a bulleted list. */
export type LegalBlock = string | { list: string[] };

export type LegalDoc = {
  slug: "terms" | "privacy";
  title: string;
  accent: string;
  summary: string;
  sections: { id: string; heading: string; body: LegalBlock[] }[];
};

export const LEGAL_CONTACT = "anigemmill@theoutsidein.nz";

export const LEGAL_STATUS = {
  label: "Draft for legal review",
  note: "This is a first draft written before launch. It has not been reviewed by a lawyer yet and may change. Items in brackets are still being confirmed.",
  effectiveDate: "[EFFECTIVE DATE]",
  entity: "[LEGAL ENTITY NAME], trading as The Outside In, New Zealand. [NZBN AND REGISTERED ADDRESS]",
};

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of",
  accent: "Service.",
  summary:
    "Reeldeal is a business tool for turning your footage into finished videos. Your footage and your videos stay yours. You are responsible for having the rights to what you upload and for checking AI-made videos before you publish them. Plans renew until you cancel, credits follow the rules on our pricing page, and New Zealand law applies.",
  sections: [
    {
      id: "agreement",
      heading: "The agreement",
      body: [
        "These terms are an agreement between you and [LEGAL ENTITY NAME], trading as The Outside In (“we”, “us”), for the use of Reeldeal, including the website, the app and any related services.",
        "By creating an account or using Reeldeal you accept these terms. If you use Reeldeal for a business or organisation, you accept them on its behalf and confirm you have authority to do so. In that case “you” means the business.",
        "Reeldeal is built for business use. You must be at least 18 years old to create an account.",
      ],
    },
    {
      id: "accounts",
      heading: "Accounts and workspaces",
      body: [
        "Each business uses a workspace. A workspace has one owner, who is responsible for the account and for billing. The owner can invite administrators and members, and can change their roles or remove them.",
        {
          list: [
            "Keep your sign-in details secure and tell us straight away if you think someone else has used your account.",
            "You are responsible for what people you invite do in your workspace.",
            "Give us accurate details and keep them up to date.",
            "Personal access tokens act on your behalf. Treat them like passwords and revoke any you no longer use.",
          ],
        },
      ],
    },
    {
      id: "plans",
      heading: "Plans, credits and billing",
      body: [
        "Our plans, prices and allowances are set out on our pricing page. Prices are in New Zealand dollars and include GST.",
        {
          list: [
            "Paid plans renew automatically each month, or each year on annual billing, until you cancel. You can cancel at any time and the cancellation takes effect at the end of the current billing period.",
            "Credits are used when you finish a video or use certain AI features. We only take credits when a render succeeds. If a render fails because of a problem on our side, you can retry it without using more credits.",
            "Unused video and AI generation credits roll over for one more billing period, up to one month’s allowance, and then expire. Media analysis hours do not roll over. Annual plans receive their allowance monthly.",
            "Purchased top-up credits expire [90] days after purchase.",
            "Credits have no cash value and cannot be transferred or refunded, except where the law requires it.",
            "We don’t refund part-used billing periods, except where the law requires it.",
            "We will give you at least 30 days’ notice of a price change. The new price applies from your next renewal after that notice.",
          ],
        },
        "Free plans are provided as they are, and we may change or end them with reasonable notice.",
      ],
    },
    {
      id: "content",
      heading: "Your content and footage",
      body: [
        "You own the footage, photos, logos, music and other material you upload (“your content”), and the videos you make with Reeldeal. We do not claim ownership of any of it.",
        "You give us a limited licence to store, copy, process, analyse and display your content only as needed to run Reeldeal for you, to keep it secure, and to meet our legal obligations. This licence ends when your content is deleted, apart from copies kept in backups for a short time (see our Privacy Policy).",
        "We do not use your content to advertise Reeldeal, or show it in our Showcase, without your written permission.",
        "You confirm that you have every right and permission needed to upload and use your content, including consent from people who appear in your footage, location and venue permissions where needed, and licences for any music or third-party material.",
      ],
    },
    {
      id: "ai",
      heading: "AI features",
      body: [
        "Reeldeal uses AI to analyse footage, suggest edits, write captions and build videos. AI output can be wrong, incomplete or unsuitable. Check every video, caption and claim before you publish it. You are responsible for what you publish.",
        "Your workspace decides whether still frames from your footage may be sent to our AI provider for analysis. Our Privacy Policy explains what is sent and when.",
        "Don’t use AI features to make content that misleads people about who appears in it or what happened, or that imitates a real person without their permission.",
      ],
    },
    {
      id: "acceptable-use",
      heading: "Acceptable use",
      body: [
        "You must not use Reeldeal to:",
        {
          list: [
            "upload or make content that is unlawful, defamatory, harassing, hateful, sexually explicit or that exploits children;",
            "infringe anyone’s copyright, trade marks, privacy or other rights;",
            "make false or misleading advertising, including claims that breach the Fair Trading Act 1986;",
            "send spam, malware or anything designed to harm systems or people;",
            "try to get into other workspaces, get around usage limits or security controls, or overload the service;",
            "copy, resell or rebuild Reeldeal, or use it to build a competing product, without our written agreement.",
          ],
        },
        "We may remove content or suspend access that breaks these rules. Where it is reasonable, we will tell you first and give you a chance to fix the problem.",
      ],
    },
    {
      id: "third-parties",
      heading: "Third-party services",
      body: [
        "Reeldeal relies on other companies for hosting, storage, email, payments and AI. They are listed in our Privacy Policy. If you connect Reeldeal to another service, or publish to social media platforms, that service’s own terms also apply to you.",
      ],
    },
    {
      id: "availability",
      heading: "Availability and changes",
      body: [
        "We work to keep Reeldeal available and your content safe, but we can’t promise the service will always be available or free of errors. We may need to pause it for maintenance, and we will try to give notice of planned downtime.",
        "We improve Reeldeal over time and may add, change or remove features. If we remove a paid feature you rely on, we will give you reasonable notice.",
        "We may update these terms. For changes that matter, we will give at least 30 days’ notice by email or in the app. If you keep using Reeldeal after a change takes effect, the new terms apply. If you don’t agree, you can cancel before then.",
      ],
    },
    {
      id: "liability",
      heading: "Liability",
      body: [
        "Because Reeldeal is supplied for business purposes, you agree that the Consumer Guarantees Act 1993 does not apply, and that sections 9, 12A and 13 of the Fair Trading Act 1986 do not apply, to the extent the law allows. Nothing in these terms limits any right that cannot be excluded by law.",
        {
          list: [
            "To the extent the law allows, we are not liable for indirect or consequential loss, or for loss of profit, revenue, data or opportunity.",
            "To the extent the law allows, our total liability to you under or in connection with these terms is limited to the amount you paid us in the 12 months before the claim arose.",
            "You agree to cover our reasonable losses if someone makes a claim against us because of your content or because you broke these terms.",
          ],
        },
        "Keep your own copies of your original footage. Reeldeal is not a backup service.",
      ],
    },
    {
      id: "termination",
      heading: "Ending the agreement",
      body: [
        "You can stop using Reeldeal and cancel your plan at any time. The workspace owner can ask for the workspace to be deleted.",
        "We may suspend or close an account that seriously or repeatedly breaks these terms, that doesn’t pay, or where we must do so by law. Where it is reasonable, we will warn you first.",
        "When a workspace is deleted, access ends straight away and its content is permanently deleted after a [30]-day recovery period. Download any videos you want to keep before then. We keep billing records for as long as the law requires.",
      ],
    },
    {
      id: "law",
      heading: "Governing law",
      body: [
        "These terms are governed by New Zealand law, and New Zealand courts have jurisdiction. If there is a dispute, please contact us first: most problems can be sorted out by talking.",
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      body: [`Questions about these terms: ${LEGAL_CONTACT}.`],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy",
  accent: "Policy.",
  summary:
    "We collect what we need to run Reeldeal for you: your account details, your workspace, and the footage you upload. Your footage is private to your workspace. Still frames are only sent to our AI provider if your workspace turns that on, and it doesn’t use them to train its models. We don’t sell personal information or use advertising cookies. You can ask to see, correct or delete your information at any time.",
  sections: [
    {
      id: "who",
      heading: "Who we are",
      body: [
        "Reeldeal is run by [LEGAL ENTITY NAME], trading as The Outside In, in New Zealand (“we”, “us”). We are responsible for the personal information described here and follow the Privacy Act 2020.",
        "When a business uses Reeldeal, footage and other material in its workspace may include personal information about other people, such as guests or staff who appear in videos. The business decides what to upload and is responsible for having permission to use it. We handle that material on the business’s behalf, under this policy and our Terms.",
      ],
    },
    {
      id: "collect",
      heading: "Information we collect",
      body: [
        {
          list: [
            "Account details: your name, email address, password (stored only in a protected, scrambled form) and sign-in history.",
            "Workspace details: business name, team members and roles, invitations, brand profiles (logos, colours, fonts, tone of voice) and preferences.",
            "Your content: footage, photos, music and other files you upload, and the videos, captions and storyboards you make.",
            "Usage and billing: plan, credit use, renders and, when paid plans start, billing details. Card details are handled by our payment provider and never stored by us.",
            "Technical information: IP address, browser and device type, and logs of actions such as sign-ins, used to keep the service secure and working.",
            "When you contact us or book a demo: the details you give us, such as your name, email, business and message.",
          ],
        },
      ],
    },
    {
      id: "use",
      heading: "How we use it",
      body: [
        {
          list: [
            "To provide Reeldeal: storing your footage, analysing it, building and rendering videos, and sending them back to you.",
            "To run your account: signing you in, managing your workspace and team, and tracking credits and billing.",
            "To contact you about your account, such as sign-in emails, invitations, receipts and important service changes.",
            "To keep Reeldeal secure: preventing abuse, investigating problems and enforcing our Terms.",
            "To improve Reeldeal, using usage information. We don’t look at the content of your footage for this unless you ask us to, for example to help with a support request.",
            "To meet our legal obligations, such as keeping tax records.",
          ],
        },
        "We don’t sell personal information, and we don’t use your footage to advertise Reeldeal without your written permission.",
      ],
    },
    {
      id: "ai",
      heading: "AI processing",
      body: [
        "Reeldeal uses OpenAI’s API to help analyse footage and write briefs, storyboards and captions.",
        {
          list: [
            "Text you write, such as video briefs, and descriptions of your footage are sent to OpenAI to produce suggestions.",
            "Still frames from your footage are sent only if your workspace turns on AI media analysis in its settings. Whole videos are never sent.",
            "Under OpenAI’s API terms, what we send is not used to train its models. OpenAI may keep it for a limited time to monitor for abuse, and then deletes it.",
          ],
        },
        "Basic analysis that doesn’t need AI, such as finding scenes and measuring quality, runs on our own servers.",
      ],
    },
    {
      id: "sharing",
      heading: "Service providers and sharing",
      body: [
        "We use these companies to run Reeldeal. They may only use your information to provide their service to us:",
        {
          list: [
            "Supabase: database and sign-in (Sydney, Australia).",
            "Cloudflare R2: storage for footage and videos (Oceania region).",
            "Fly.io: video processing servers (Sydney, Australia).",
            "Vercel: website and app hosting (global network, based in the United States).",
            "OpenAI: AI features (United States).",
            "Resend: account and notification emails (United States).",
            "Cal.com: demo bookings, if you book a demo.",
            "Stripe: payments, when paid plans start.",
            "[Sentry: error monitoring, with personal details removed. Confirm before launch.]",
          ],
        },
        "We may also share information if the law requires it, to protect people’s safety, or as part of selling or restructuring our business, in which case this policy continues to apply.",
      ],
    },
    {
      id: "storage",
      heading: "Where data is stored and for how long",
      body: [
        "Your footage, videos and database records are stored in Australia and the Oceania region. Some providers, such as OpenAI, Vercel and Resend, are based in the United States. Where information goes overseas, we use providers whose contracts require them to protect it in ways comparable to New Zealand law.",
        {
          list: [
            "Account and workspace information: for as long as the account is active.",
            "Footage and videos: until you delete them, or until the workspace is deleted. Deleted workspaces have a [30]-day recovery period, then their content is permanently deleted.",
            "Backups: deleted information may stay in encrypted backups for up to [7] days before it is overwritten.",
            "Billing and tax records: seven years, as New Zealand tax law requires.",
            "Security logs: [12 months].",
          ],
        },
      ],
    },
    {
      id: "security",
      heading: "Security",
      body: [
        "Each workspace’s data is kept separate, and only members of that workspace can see it, according to their role. Footage is stored privately and shared only through links that expire. Information is encrypted in transit and at rest, and sign-in attempts are rate-limited.",
        "No system is perfectly secure. If a privacy breach is likely to cause serious harm, we will tell the people affected and the Office of the Privacy Commissioner as the law requires.",
      ],
    },
    {
      id: "rights",
      heading: "Your rights and choices",
      body: [
        "You can ask to see the personal information we hold about you, and ask us to correct it. You can also ask us to delete it. Email us and we will reply within 20 working days. We may need to confirm who you are first.",
        "Workspace owners can turn AI media analysis on or off at any time in the workspace settings.",
        "If you appear in a video made by a business that uses Reeldeal, please contact that business first. We will help it respond.",
      ],
    },
    {
      id: "cookies",
      heading: "Cookies",
      body: [
        "We use only the cookies Reeldeal needs to work:",
        {
          list: [
            "Sign-in cookies, which keep you signed in.",
            "A workspace cookie, which remembers which workspace you were using.",
            "An invitation cookie, which holds a team invitation while you sign in.",
          ],
        },
        "Your appearance choice (theme) is stored in your browser. We don’t use advertising or tracking cookies. If we add analytics, we will update this policy first.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      body: [
        "If we change this policy in a way that matters, we will tell account holders by email or in the app before the change takes effect. The date at the top shows when it was last updated.",
      ],
    },
    {
      id: "contact",
      heading: "Contact and complaints",
      body: [
        `For privacy questions or requests, email ${LEGAL_CONTACT}.`,
        "If you are not happy with our response, you can complain to the Office of the Privacy Commissioner at privacy.org.nz.",
      ],
    },
  ],
};
