import { type NextRequest } from "next/server";

/**
 * Server-side Gemini API proxy.
 *
 * The Gemini API key is read from the server-only env var GEMINI_API_KEY
 * so it is NEVER sent to the client browser.
 */

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
  "gemini-pro-latest"
];

export async function POST(request: NextRequest) {
  let body: { prompt: string; userInstructions?: string; preferredModel?: string; customApiKey?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body", fallback: true }, { status: 400 });
  }

  const apiKey = (body.customApiKey && typeof body.customApiKey === "string" && body.customApiKey.trim())
    ? body.customApiKey.trim()
    : process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey.length < 15) {
    return Response.json(
      { error: "Gemini API key is not configured. Please enter a valid Gemini API Key from Google AI Studio.", fallback: true },
      { status: 503 }
    );
  }

  let { prompt, userInstructions, preferredModel } = body;

  if (userInstructions && typeof userInstructions === "string" && userInstructions.trim()) {
    prompt = `${prompt}\n\nCRITICAL USER CUSTOM INSTRUCTIONS & DESIGN PREFERENCES:\n${userInstructions.trim()}\n\nYou MUST strictly respect and apply the above user custom instructions while satisfying all hard constraints!`;
  }

  if (!prompt || typeof prompt !== "string" || prompt.length < 10) {
    return Response.json(
      { error: "Prompt is required and must be at least 10 characters", fallback: true },
      { status: 400 }
    );
  }

  // Cap prompt length
  if (prompt.length > 60000) {
    return Response.json(
      { error: "Prompt exceeds maximum allowed length", fallback: true },
      { status: 413 }
    );
  }

  const modelsToTry = [...GEMINI_MODELS];
  if (preferredModel && GEMINI_MODELS.includes(preferredModel)) {
    modelsToTry.splice(modelsToTry.indexOf(preferredModel), 1);
    modelsToTry.unshift(preferredModel);
  }

  let lastError = "";

  for (const modelName of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

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
            temperature: 0.2,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && (text.includes("[") || text.includes("{"))) {
          return Response.json({
            text,
            model: modelName,
            success: true,
          });
        }
      } else {
        const errJson = await resp.json().catch(() => null);
        const errMsg = errJson?.error?.message || `HTTP ${resp.status}`;
        lastError = errMsg;

        if (resp.status === 401 || resp.status === 403) {
          // Authentication/permission error from Google AI Studio
          return Response.json(
            { error: `Google Gemini API error: ${errMsg}`, fallback: true },
            { status: 403 }
          );
        }
      }
    } catch (fetchErr: any) {
      lastError = fetchErr?.message || "Request timed out";
    }
  }

  return Response.json(
    { error: `All Gemini models failed: ${lastError || "Unknown error"}`, fallback: true },
    { status: 502 }
  );
}
