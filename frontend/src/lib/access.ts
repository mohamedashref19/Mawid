// أدوات التعامل مع بيانات الانضمام للكورسات الأونلاين:
//  - accessLink    : رابط أو أكتر (كل رابط في سطر مستقل)
//  - accessDetails : تفاصيل نصية عادية (مواعيد، كلمة سر، تعليمات...)

const URL_RE = /https?:\/\/[^\s]+/gi;
// علامات ترقيم بتلزق في آخر الرابط لما حد يكتب جملة (، . ) ؛ ...)
const TRAILING_PUNCT_RE = /[)\]}>.,;:!?،؛؟'"”’»…]+$/u;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** كل روابط http(s) الموجودة في النص (من غير تكرار وبعد تنضيف علامات الترقيم) */
export function extractLinks(text: string | undefined | null): string[] {
  const found = (text ?? "").match(URL_RE) ?? [];
  const cleaned = found.map((u) => u.replace(TRAILING_PUNCT_RE, "")).filter(isHttpUrl);
  return Array.from(new Set(cleaned));
}

/** النص بعد إزالة الروابط منه */
export function stripLinks(text: string | undefined | null): string {
  return (text ?? "")
    .replace(URL_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * بيفصل بيانات الكورس لـ (روابط + تفاصيل).
 * للكورسات القديمة اللي الأدمن كتب فيها الرسالة والرابط في حقل واحد،
 * بنطلّع الروابط ونخلّي الكلام الباقي هو التفاصيل.
 */
export function parseAccess(
  accessLink: string | undefined | null,
  accessDetails: string | undefined | null,
): { links: string[]; details: string } {
  const raw = (accessLink ?? "").trim();
  const links = extractLinks(raw);
  let details = (accessDetails ?? "").trim();
  if (!details) details = stripLinks(raw);
  return { links, details };
}

/** اسم مفهوم للرابط حسب الموقع (واتساب، Zoom...) */
export function linkLabel(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "الرابط";
  }
  const is = (...domains: string[]) => domains.some((d) => host === d || host.endsWith("." + d));
  if (is("wa.me", "whatsapp.com")) return "واتساب";
  if (is("zoom.us", "zoom.com")) return "Zoom";
  if (is("meet.google.com")) return "Google Meet";
  if (is("t.me", "telegram.me", "telegram.org")) return "تيليجرام";
  if (is("youtube.com", "youtu.be")) return "يوتيوب";
  if (is("teams.microsoft.com", "teams.live.com")) return "Microsoft Teams";
  if (is("facebook.com", "fb.me", "fb.com")) return "فيسبوك";
  if (is("drive.google.com", "docs.google.com")) return "Google Drive";
  if (is("discord.gg", "discord.com")) return "ديسكورد";
  return host;
}

/** أسماء الروابط، ولو في أكتر من رابط لنفس الموقع بنرقّمهم (واتساب 1، واتساب 2) */
export function labelLinks(urls: string[]): { url: string; label: string }[] {
  const base = urls.map(linkLabel);
  return urls.map((url, i) => {
    const label = base[i] ?? "الرابط";
    const same = base.filter((l) => l === label).length;
    const nth = base.slice(0, i + 1).filter((l) => l === label).length;
    return { url, label: same > 1 ? `${label} ${nth}` : label };
  });
}

/** بيرجّع رسالة خطأ لو أي سطر في حقل الروابط مش رابط http(s) صحيح، وإلا null */
export function validateLinksText(text: string | undefined | null): string | null {
  const lines = (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const [i, line] of lines.entries()) {
    if (!/^https?:\/\/\S+$/i.test(line) || !isHttpUrl(line)) {
      return `السطر ${i + 1} في حقل الروابط مش رابط صحيح (لازم يبدأ بـ https://). ضع كل رابط في سطر مستقل، والكلام اكتبه في حقل التفاصيل.`;
    }
  }
  return null;
}

/** تنضيف حقل الروابط: سطر لكل رابط، من غير فراغات أو أسطر فاضية أو تكرار */
export function normalizeLinksText(text: string | undefined | null): string {
  const lines = (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return Array.from(new Set(lines)).join("\n");
}
