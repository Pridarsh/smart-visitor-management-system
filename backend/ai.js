// ai.js — Azure OpenAI client with safe fallback
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

// We only enable the client if the Azure vars are present.
// (v4 SDK needs an apiKey even with Azure; we pass AZURE_OPENAI_KEY)
const ready =
  process.env.AZURE_OPENAI_ENDPOINT &&
  process.env.AZURE_OPENAI_KEY &&
  process.env.AZURE_OPENAI_DEPLOYMENT;

let client = null;
if (ready) {
  client = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_KEY, // required by the SDK
    // Point baseURL to your DEPLOYMENT root; no 'model' needed in calls
    baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
    defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
    defaultQuery: {
      "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
    },
  });
} else {
  console.warn(
    "[AI] Azure OpenAI not configured — classifyPurpose will return 'OTHER'."
  );
}

export async function classifyPurpose(text) {
  // Safe fallback if not configured or during errors
  if (!client) return "OTHER";

  try {
    const resp = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a concise classifier. Return exactly one label from: MEETING, DELIVERY, INTERVIEW, OTHER.",
        },
        { role: "user", content: String(text || "") },
      ],
      temperature: 0,
    });

    const raw = resp.choices?.[0]?.message?.content?.trim()?.toUpperCase() || "";
    const label = ["MEETING", "DELIVERY", "INTERVIEW", "OTHER"].includes(raw)
      ? raw
      : "OTHER";
    return label;
  } catch (err) {
    console.error("[AI] classifyPurpose failed:", err?.message || err);
    return "OTHER";
  }
}
