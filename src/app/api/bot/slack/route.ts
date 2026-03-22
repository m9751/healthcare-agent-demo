import { type NextRequest, after } from "next/server";

/* ------------------------------------------------------------------ */
/*  Slack Bot Webhook Handler                                         */
/*  Handles: URL verification, app_mention events                     */
/*  Calls /api/chat internally, posts response back to Slack          */
/* ------------------------------------------------------------------ */

export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ---------- Slack request signature verification ------------------- */

async function verifySlackSignature(
  req: NextRequest,
  rawBody: string
): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  const timestamp = req.headers.get("x-slack-request-timestamp");
  const slackSignature = req.headers.get("x-slack-signature");
  if (!timestamp || !slackSignature) return false;

  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  const sigBasestring = `v0:${timestamp}:${rawBody}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(sigBasestring)
  );
  const hex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const computed = `v0=${hex}`;

  // Timing-safe comparison
  if (computed.length !== slackSignature.length) return false;
  const a = encoder.encode(computed);
  const b = encoder.encode(slackSignature);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

/* ---------- Call internal /api/chat and collect SSE response ------- */

async function callChatAPI(
  origin: string,
  userMessage: string
): Promise<string> {
  const chatUrl = `${origin}/api/chat`;

  const res = await fetch(chatUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          parts: [{ type: "text", text: userMessage }],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Chat API returned ${res.status}: ${await res.text()}`);
  }

  // Parse AI SDK v6 UIMessage stream format
  // Format: type-prefix:json-value per line
  // Text chunks use prefix "0:" with JSON string value
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body from chat API");

  const decoder = new TextDecoder();
  const textParts: string[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // AI SDK v6 UIMessage stream: text chunks are "0:\"text\""
      if (trimmed.startsWith("0:")) {
        try {
          const text = JSON.parse(trimmed.slice(2));
          if (typeof text === "string") {
            textParts.push(text);
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  return textParts.join("") || "(No response generated)";
}

/* ---------- Post message to Slack --------------------------------- */

async function postToSlack(channel: string, text: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN not configured");

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error("Slack postMessage failed:", data.error);
  }
}

/* ---------- Route handlers ---------------------------------------- */

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify Slack signature
  const valid = await verifySlackSignature(req, rawBody);
  if (!valid) {
    return new Response("Invalid signature", {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  // Handle Slack URL verification challenge
  if (body.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: body.challenge }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  // Handle event callbacks
  if (body.type === "event_callback") {
    const event = body.event;

    // Only handle app_mention events
    if (event?.type === "app_mention") {
      // Strip the bot mention from the message text
      // Slack mentions look like <@U12345678>
      const userMessage = (event.text as string)
        .replace(/<@[A-Z0-9]+>/g, "")
        .trim();
      const channel = event.channel as string;

      // Determine origin for internal API call
      const origin =
        req.nextUrl.origin ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");

      // Use next/server after() to run work AFTER the response is sent.
      // This lets us return 200 to Slack within 3 seconds while the
      // chat API call + Slack reply happen in the background.
      after(async () => {
        try {
          const reply = await callChatAPI(origin, userMessage || "hello");
          await postToSlack(channel, reply);
        } catch (err) {
          console.error("Error processing app_mention:", err);
          await postToSlack(
            channel,
            `:warning: Sorry, I encountered an error processing your request.`
          );
        }
      });

      // Return 200 immediately to Slack
      return new Response("ok", {
        status: 200,
        headers: CORS_HEADERS,
      });
    }
  }

  // Default: acknowledge unknown events
  return new Response("ok", {
    status: 200,
    headers: CORS_HEADERS,
  });
}
