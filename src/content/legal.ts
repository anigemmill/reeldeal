/*
  Terms of Service and Privacy Policy: STRUCTURE ONLY. Every section body is a bracketed
  placeholder for text the owner's legal adviser supplies. Nothing here is legal wording,
  and the pages say so on screen and are excluded from search engines until replaced.
  Section headings are the topics such documents usually cover for a SaaS product; the
  adviser may add, remove or rename them.
*/
export type LegalDoc = {
  slug: "terms" | "privacy";
  title: string;
  accent: string;
  summary: string;
  sections: { id: string; heading: string; placeholder: string }[];
};

const todo = (what: string) => `[${what}: TEXT TO BE SUPPLIED BY THE OWNER'S LEGAL ADVISER]`;

export const LEGAL_STATUS = {
  label: "Draft: placeholders only",
  note: "This page is a layout placeholder. It is not Reeldeal's published policy and has no legal effect. The final text will replace every bracketed section before launch.",
  effectiveDate: "[EFFECTIVE DATE]",
  entity: "[LEGAL ENTITY NAME AND REGISTERED ADDRESS]",
  contact: "[CONTACT EMAIL FOR LEGAL AND PRIVACY QUESTIONS]",
};

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of",
  accent: "Service.",
  summary: "[ONE-PARAGRAPH PLAIN-LANGUAGE SUMMARY OF THE TERMS]",
  sections: [
    { id: "agreement", heading: "The agreement", placeholder: todo("Who the agreement is between and when it applies") },
    { id: "accounts", heading: "Accounts and workspaces", placeholder: todo("Account eligibility, workspace owners, administrators and members") },
    { id: "plans", heading: "Plans, credits and billing", placeholder: todo("Plans, credits, renewals, refunds and taxes") },
    { id: "content", heading: "Your content and footage", placeholder: todo("Ownership of uploaded footage, brand assets and generated videos; licence needed to provide the service") },
    { id: "ai", heading: "AI features", placeholder: todo("How AI-generated output may be used; customer review responsibilities") },
    { id: "acceptable-use", heading: "Acceptable use", placeholder: todo("Prohibited content and conduct") },
    { id: "third-parties", heading: "Third-party services", placeholder: todo("Services Reeldeal relies on and integrations") },
    { id: "availability", heading: "Availability and changes", placeholder: todo("Service availability, changes to the service and to these terms") },
    { id: "liability", heading: "Liability", placeholder: todo("Warranties, limitation of liability and indemnities") },
    { id: "termination", heading: "Ending the agreement", placeholder: todo("Cancellation, suspension, termination and data export") },
    { id: "law", heading: "Governing law", placeholder: todo("Governing law and disputes") },
    { id: "contact", heading: "Contact", placeholder: todo("How to contact Reeldeal about these terms") },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy",
  accent: "Policy.",
  summary: "[ONE-PARAGRAPH PLAIN-LANGUAGE SUMMARY OF THE PRIVACY POLICY]",
  sections: [
    { id: "who", heading: "Who we are", placeholder: todo("The organisation responsible for personal information") },
    { id: "collect", heading: "Information we collect", placeholder: todo("Account details, workspace and brand information, footage and media, usage and device information") },
    { id: "use", heading: "How we use it", placeholder: todo("Purposes, including providing the service, AI analysis with workspace consent, support and security") },
    { id: "ai", heading: "AI processing", placeholder: todo("What is sent to AI providers, when, and the workspace consent setting") },
    { id: "sharing", heading: "Service providers and sharing", placeholder: todo("Processors and sub-processors (hosting, database, storage, email, AI) and their locations") },
    { id: "storage", heading: "Where data is stored and for how long", placeholder: todo("Storage locations, cross-border transfers and retention periods") },
    { id: "security", heading: "Security", placeholder: todo("How information is protected") },
    { id: "rights", heading: "Your rights and choices", placeholder: todo("Access, correction, export and deletion; how to make a request") },
    { id: "cookies", heading: "Cookies", placeholder: todo("Cookies used (sign-in session, workspace choice, appearance) and analytics, if any") },
    { id: "changes", heading: "Changes to this policy", placeholder: todo("How changes are notified") },
    { id: "contact", heading: "Contact and complaints", placeholder: todo("Privacy contact and complaint process") },
  ],
};
