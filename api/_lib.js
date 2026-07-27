/**
 * RAÉCAE — shared serverless helpers.
 * Files prefixed with "_" in /api are not exposed as endpoints.
 *
 * The OpenAI API key lives ONLY in the OPENAI_API_KEY environment
 * variable on the deployment platform — never in client code.
 */

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-sol";
const OPENAI_URL = "https://api.openai.com/v1/responses";

function applyCors(req, res) {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * Call the OpenAI Responses API and return the model's output text.
 * @param {object} opts { instructions, input, maxOutputTokens }
 */
async function callOpenAI(opts) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const err = new Error("OPENAI_API_KEY is not configured");
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  const resp = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: opts.instructions,
      input: opts.input,
      max_output_tokens: opts.maxOutputTokens || 700,
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(
      (data && data.error && data.error.message) || `OpenAI API error (${resp.status})`
    );
    err.code = resp.status === 401 ? "BAD_KEY" : resp.status === 429 ? "RATE_OR_FUNDS" : "UPSTREAM";
    err.status = resp.status;
    throw err;
  }
  return { text: extractText(data), usage: data.usage || null };
}

/** Walk a Responses API payload for the assistant's output text. */
function extractText(data) {
  if (typeof data.output_text === "string" && data.output_text.length) return data.output_text;
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if ((c.type === "output_text" || c.type === "text") && typeof c.text === "string") {
            return c.text;
          }
        }
      }
    }
  }
  return "";
}

/** Parse a strict-JSON model reply, tolerating code fences and prose margins. */
function parseModelJson(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch (_) {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

function friendlyError(err) {
  switch (err.code) {
    case "NOT_CONFIGURED":
      return { status: 503, message: "The live AI is not configured yet." };
    case "BAD_KEY":
      return { status: 502, message: "The house cannot reach its intelligence — the API key was refused." };
    case "RATE_OR_FUNDS":
      return { status: 502, message: "The intelligence is momentarily unavailable — rate limit or credit balance reached." };
    default:
      return { status: 502, message: "The intelligence is momentarily unavailable. Please try again." };
  }
}

module.exports = { MODEL, applyCors, sendJson, callOpenAI, parseModelJson, friendlyError };
