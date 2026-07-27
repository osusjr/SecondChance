/**
 * POST /api/listing — the live AI Listing Assistant.
 * Body: { photos: ["data:image/jpeg;base64,…", …], notes?: string }
 * Reply: { brand, title, description, category, era, condition, condition_note,
 *          tags: [], keywords: [], price_low_jod, price_high_jod, confidence }
 */
const { applyCors, sendJson, callOpenAI, parseModelJson, friendlyError } = require("./_lib.js");
const catalog = require("./_catalog.json");

const MAX_PHOTOS = 4;
const MAX_NOTES = 400;
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const INSTRUCTIONS = `You are the RAÉCAE Listing Assistant — the AI that turns a seller's
photographs into a clear, professional listing for a luxury resale platform.

VOICE: natural and factual, like an experienced vintage dealer describing an item — specific
about materials, era and condition, warm but never flowery. No purple prose, no dramatic
metaphors. No emoji, no exclamation marks. Prices in JOD (Jordanian dinar).

From the photographs (and the seller's notes, if any) produce the complete listing.
Identify the house and model if you can; if uncertain, describe honestly and lower your
confidence — never invent a serial number or a provenance you cannot see.

Category must be one of: ${catalog.categories.join(" / ")}.
Era must be "Vintage" (pre-2005) or "Contemporary". Condition must be one of:
Excellent / Very Good / Good / Fair. Suggest a realistic resale price band in JOD for
the regional market (Jordan and the Gulf).

Answer strictly as JSON, no code fences, matching exactly:
{"brand": string, "title": string, "description": string (2-4 plain, specific sentences about
the piece), "category": string, "era": string, "year_estimate": string, "condition": string,
"condition_note": string (1-2 honest sentences), "tags": string[5-7],
"keywords": string[4-6], "price_low_jod": number, "price_high_jod": number,
"confidence": number (0-100, how sure you are of the identification)}`;

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });

  const body = req.body || {};
  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .filter((p) => typeof p === "string" && DATA_URL.test(p))
    .slice(0, MAX_PHOTOS);
  const notes = typeof body.notes === "string" ? body.notes.slice(0, MAX_NOTES).trim() : "";

  if (!photos.length) {
    return sendJson(res, 400, { error: "At least one photograph (jpeg/png/webp data URL) is required." });
  }

  const content = [
    {
      type: "input_text",
      text:
        "Draft the RAÉCAE listing for the piece in these photographs." +
        (notes ? ` Seller's notes: ${notes}` : ""),
    },
  ];
  for (const p of photos) content.push({ type: "input_image", image_url: p });

  try {
    const { text } = await callOpenAI({
      instructions: INSTRUCTIONS,
      input: [{ role: "user", content }],
      maxOutputTokens: 900,
    });
    const parsed = parseModelJson(text);
    if (!parsed || typeof parsed.title !== "string" || typeof parsed.description !== "string") {
      throw Object.assign(new Error("unparseable model reply"), { code: "UPSTREAM" });
    }
    const clean = {
      brand: String(parsed.brand || "").slice(0, 60),
      title: parsed.title.slice(0, 120),
      description: parsed.description.slice(0, 1200),
      category: catalog.categories.includes(parsed.category) ? parsed.category : "Accessories",
      era: parsed.era === "Vintage" ? "Vintage" : "Contemporary",
      year_estimate: String(parsed.year_estimate || "").slice(0, 24),
      condition: ["Excellent", "Very Good", "Good", "Fair"].includes(parsed.condition)
        ? parsed.condition
        : "Good",
      condition_note: String(parsed.condition_note || "").slice(0, 400),
      tags: (Array.isArray(parsed.tags) ? parsed.tags : []).map(String).slice(0, 7),
      keywords: (Array.isArray(parsed.keywords) ? parsed.keywords : []).map(String).slice(0, 6),
      price_low_jod: Math.max(0, Math.round(Number(parsed.price_low_jod) || 0)),
      price_high_jod: Math.max(0, Math.round(Number(parsed.price_high_jod) || 0)),
      confidence: Math.min(100, Math.max(0, Math.round(Number(parsed.confidence) || 0))),
    };
    sendJson(res, 200, clean);
  } catch (err) {
    const f = friendlyError(err);
    sendJson(res, f.status, { error: f.message });
  }
};
