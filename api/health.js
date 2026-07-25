/**
 * GET /api/health — lets the front end discover whether the live
 * intelligence is configured. Never exposes the key itself.
 */
const { MODEL, applyCors, sendJson } = require("./_lib.js");

module.exports = (req, res) => {
  if (applyCors(req, res)) return;
  sendJson(res, 200, {
    ok: true,
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: MODEL,
  });
};
