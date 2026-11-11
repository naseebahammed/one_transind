import { openAiConfig } from "@/lib/server-config";

if (typeof window !== "undefined") {
  throw new Error("lib/ask-ai.ts is server-only and must never run in the browser.");
}

export function hasOpenAiKey(): boolean {
  return Boolean(openAiConfig().apiKey);
}

export async function askAnalyst(
  data: string,
  question: string,
): Promise<{ answer: string } | { error: string; status: number }> {
  const { apiKey, model } = openAiConfig();
  if (!apiKey) return { error: "Ask AI is not configured.", status: 503 };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are the analyst for One Transind's sales dashboard. Answer concisely using only the data below; if it does not cover the question, say so. Amounts are in QAR.\n\nDATA:\n" +
            data,
        },
        { role: "user", content: question },
      ],
    }),
  }).catch(() => null);

  if (!res) return { error: "OpenAI did not answer in time", status: 504 };
  if (!res.ok) return { error: `OpenAI error ${res.status}`, status: 502 };
  const body = await res.json().catch(() => null);
  if (!body) return { error: "OpenAI sent an unreadable reply", status: 502 };
  return { answer: body.choices?.[0]?.message?.content ?? "" };
}

