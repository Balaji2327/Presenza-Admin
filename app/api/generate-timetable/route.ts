import { type NextRequest } from "next/server";

/**
 * Server-side Gemini API proxy.
 *
 * The Gemini API key is read from the non-public env var GEMINI_API_KEY
 * (without the NEXT_PUBLIC_ prefix) so it is NEVER sent to the browser.
 *
 * The client sends the prompt and optional model preference; this route
 * forwards the request to the Gemini REST API and returns the response.
 */

const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.6-pro",
  "gemini-3.5-flash",
  "gemini-1.5-pro",
];

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey.length < 20) {
    return Response.json(
      { error: "Gemini API key not configured on server" },
      { status: 503 }
    );
  }

  let body: { prompt: string; preferredModel?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { prompt, preferredModel } = body;

  if (!prompt || typeof prompt !== "string" || prompt.length < 10) {
    return Response.json(
      { error: "Prompt is required and must be at least 10 characters" },
      { status: 400 }
    );
  }

  // Cap prompt length to prevent abuse
  if (prompt.length > 50000) {
    return Response.json(
      { error: "Prompt exceeds maximum length" },
      { status: 413 }
    );
  }

  // Build model order: preferred model first (if valid), then the rest
  const modelsToTry = [...GEMINI_MODELS];
  if (preferredModel && GEMINI_MODELS.includes(preferredModel)) {
    modelsToTry.splice(modelsToTry.indexOf(preferredModel), 1);
    modelsToTry.unshift(preferredModel);
  }

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 1200));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 18000);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          }),
        });
        clearTimeout(timeoutId);

        if (resp.status === 401 || resp.status === 403) {
          // Auth error — no point trying more models
          return Response.json(
            { error: "Gemini API authorization failed", fallback: true },
            { status: 403 }
          );
        }

        if (resp.ok) {
          const data = await resp.json();
          const text =
            data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text && (text.includes("[") || text.includes("{"))) {
            return Response.json({
              text,
              model: modelName,
            });
          }
        } else {
          // Only retry on 503 (high demand)
          if (resp.status !== 503) break;
        }
      } catch {
        break;
      }
    }
  }

  // All models exhausted — signal client to use local fallback
  return Response.json(
    { error: "All Gemini models unavailable", fallback: true },
    { status: 503 }
  );
}
