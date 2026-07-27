/**
 * POST /api/stylist — the live RAÉCAE stylist.
 * Body: { messages: [{ role: "user"|"assistant", content: string }, …] }
 * Reply: { reply: string, pieces: string[] }  (piece ids from the catalogue)
 */
const { applyCors, sendJson, callOpenAI, parseModelJson, friendlyError } = require("./_lib.js");
const catalog = require("./_catalog.json");

const MAX_MESSAGES = 12;
const MAX_CHARS = 600;

const INSTRUCTIONS = `You are the RAÉCAE Stylist — the in-house AI of RAÉCAE, a luxury fashion
resale platform in Amman serving Jordan, the Gulf and Europe. Every piece in the archive is
authenticated by AI and expert hands and carries a digital product passport.

VOICE: natural and plain-spoken, like an experienced personal stylist talking to a client.
Two to four sentences. Be specific about the pieces (era, material, why they work together).
No purple prose, no dramatic metaphors, no poetic flourishes — just clear, warm, professional
advice. Never salesy, no exclamation marks, no emoji. Prices are in JOD. Respect any budget
the client names. Gender-neutral.

THE VAULT (the only pieces you may recommend — recommend by "id"):
${JSON.stringify(catalog.products, null, 1)}

RULES:
- Recommend 2 to 4 pieces when the client asks for looks, styling, occasions, gifts or budgets.
  Choose only ids that exist above. If nothing genuinely fits, recommend nothing and say why.
- If the client asks something unrelated to fashion, the vault or the house, steer back politely
  in one sentence.
- Answer strictly as JSON, no code fences, matching: {"reply": string, "pieces": string[]}.`;

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });

  const body = req.body || {};
  let messages = Array.isArray(body.messages) ? body.messages : [];
  messages = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return sendJson(res, 400, { error: "messages must end with a user turn" });
  }

  try {
    const { text } = await callOpenAI({
      instructions: INSTRUCTIONS,
      input: messages,
      maxOutputTokens: 500,
    });
    const parsed = parseModelJson(text);
    const known = new Set(catalog.products.map((p) => p.id));
    const pieces =
      parsed && Array.isArray(parsed.pieces)
        ? parsed.pieces.filter((id) => known.has(id)).slice(0, 4)
        : [];
    const reply =
      parsed && typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim()
        : (text || "").trim();
    if (!reply) throw Object.assign(new Error("empty model reply"), { code: "UPSTREAM" });
    sendJson(res, 200, { reply, pieces });
  } catch (err) {
    const f = friendlyError(err);
    sendJson(res, f.status, { error: f.message });
  }
};
