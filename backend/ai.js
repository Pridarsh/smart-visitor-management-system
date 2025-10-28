// backend/ai.js
import dotenv from "dotenv";
dotenv.config();

const hasAzure =
  !!process.env.AZURE_OPENAI_KEY &&
  !!process.env.AZURE_OPENAI_ENDPOINT &&
  !!process.env.AZURE_OPENAI_DEPLOYMENT;

const ALLOWED = [
  "MEETING", "DELIVERY", "INTERVIEW", "EVENT",
  "SERVICE", "ACADEMIC", "ADMIN", "VISIT", "OTHER"
];

// ---------- helpers ----------
function fallbackClassify(text) {
  const t = String(text || "").toLowerCase();
  if (/hod|dean|principal|prof|meet|discussion|appointment/.test(t)) return { label: "MEETING", confidence: 0.7 };
  if (/deliver|courier|parcel|package|food/.test(t))               return { label: "DELIVERY", confidence: 0.7 };
  if (/interview|placement|hr/.test(t))                            return { label: "INTERVIEW", confidence: 0.75 };
  if (/event|seminar|fest|workshop|orientation/.test(t))           return { label: "EVENT", confidence: 0.7 };
  if (/repair|service|maintenance|fix|electric|plumb/.test(t))     return { label: "SERVICE", confidence: 0.7 };
  if (/exam|assignment|certificate|admission|fee|marksheet/.test(t)) return { label: "ACADEMIC", confidence: 0.7 };
  if (/admin|administration|office work/.test(t))                  return { label: "ADMIN", confidence: 0.6 };
  if (/visit|friend|parents|relative|alumni/.test(t))              return { label: "VISIT", confidence: 0.6 };
  return { label: "OTHER", confidence: 0.5 };
}

// ---------- exported APIs ----------
export async function classifyPurpose(text = "") {
  const { label, confidence } = await classifyWithConfidence(text);
  return label;
}

export async function classifyWithConfidence(text = "") {
  const cleaned = String(text || "").trim();
  if (!cleaned) return { label: "OTHER", confidence: 0.5 };

  // Try Azure
  if (hasAzure) {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_KEY,
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "")}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
        defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
        defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview" },
      });

      const sys =
        "Classify campus visitor reasons into ONE of: " +
        ALLOWED.join(", ") +
        ". Return STRICT JSON: {\"label\":\"<LABEL>\",\"confidence\":<0..1>} with no extra text.";
      const usr = `Text: "${cleaned}"`;

      const r = await client.chat.completions.create({
        temperature: 0,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: usr },
        ],
      });

      const raw = r.choices?.[0]?.message?.content || "";
      let parsed = {};
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }

      const label = String(parsed.label || "").toUpperCase();
      const conf  = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.6)));

      if (ALLOWED.includes(label)) return { label, confidence: conf };
      console.warn("Unexpected Azure label → fallback:", label);
    } catch (e) {
      console.warn("Azure classify failed → fallback:", e?.message);
    }
  }

  // Fallback
  return fallbackClassify(cleaned);
}

export async function summarizeToday(contextJson = {}) {
  const fallback =
    `Today: ${contextJson.totalToday ?? 0} visitors; ${contextJson.insideNow ?? 0} inside; ` +
    `${contextJson.pending ?? 0} pending; month total: ${contextJson.monthTotal ?? 0}.`;

  if (!hasAzure) return fallback;

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_KEY,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "")}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
      defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
      defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview" },
    });

    const r = await client.chat.completions.create({
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a concise campus operations assistant." },
        { role: "user", content: `Summarize in 3 sentences: ${JSON.stringify(contextJson)}` },
      ],
    });

    return r.choices?.[0]?.message?.content?.trim() || fallback;
  } catch (e) {
    console.warn("Azure summarize failed → fallback:", e?.message);
    return fallback;
  }
}
