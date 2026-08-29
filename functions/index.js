/**
 * BetamaxTV Cloud Functions
 * ---------------------------------------------------------
 * chatReply
 *   Called from the client (App.jsx -> requestAiReply) whenever a real
 *   user sends a Live Chat message. Generates a short, casual, in-character
 *   reply from a "fellow viewer" persona using the Gemini API, so the chat
 *   reacts instead of only ever posting scripted lines.
 *
 *   The Gemini API key is stored as a Firebase secret (GEMINI_API_KEY) and
 *   is only ever read here, server-side — it is never sent to the client.
 * ---------------------------------------------------------
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// Use a fast/cheap model — this only needs to produce a one-line chat
// reply, not deep reasoning. Swap this if your free-tier model changes.
const GEMINI_MODEL = "gemini-3-flash-preview";

// Reuse a persona name pool similar to the client's FAKE_NAMES so AI
// replies blend in with the scripted fake chatter instead of standing out.
const PERSONA_NAMES = [
  "Marielle", "Jhun", "Soo-jin", "Kenji", "Amara", "Théo", "Divine", "Carlo",
  "Noor", "Mateo", "Priya", "Elowen", "Bea", "Sam", "Yuki", "Farid",
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

exports.chatReply = onCall(
  {
    secrets: [GEMINI_API_KEY],
    region: "us-central1",
    // Keep this cheap and hard to abuse: short timeout, low memory, and a
    // per-instance concurrency cap is unnecessary at this volume.
    timeoutSeconds: 20,
    memory: "256MiB",
  },
  async (request) => {
    const userText = (request.data && request.data.message ? String(request.data.message) : "").trim().slice(0, 500);
    const title = request.data && request.data.title ? String(request.data.title).slice(0, 120) : null;

    if (!userText) {
      throw new HttpsError("invalid-argument", "message is required");
    }

    const persona = randomFrom(PERSONA_NAMES);

    const systemPrompt = [
      "You are one casual viewer chatting in the live chat box on a streaming site called BetamaxTV.",
      "Reply to the other viewer's message the way a real fan would: short (under 20 words), casual, lowercase-leaning, no emojis unless it feels natural, no greetings, no AI disclaimers, and never mention being an AI or a bot.",
      title ? `Everyone currently in this chat room is watching "${title}".` : "",
      "Just reply with the chat message itself — no name prefix, no quotation marks.",
    ]
      .filter(Boolean)
      .join(" ");

    const body = {
      contents: [{ role: "user", parts: [{ text: userText }] }],
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: 60, temperature: 0.9 },
    };

    let resp;
    try {
      resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY.value()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
    } catch (err) {
      console.error("Gemini request failed:", err);
      throw new HttpsError("unavailable", "Could not reach the AI service");
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("Gemini API error:", resp.status, errText);
      throw new HttpsError("internal", "AI reply failed");
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      throw new HttpsError("internal", "No reply generated");
    }

    return { name: persona, text: text.slice(0, 300) };
  }
);
