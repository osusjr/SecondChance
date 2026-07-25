# RAÉCAE — The Intelligent Fashion Archive

A concept website for **RAÉCAE**, an AI-powered fashion intelligence platform for luxury resale — combining artificial intelligence, authentication and storytelling to transform how the region buys and sells fashion. Connecting Jordan, the Gulf and Europe.

> *Where fashion history meets artificial intelligence.*

## The experience

Dark luxury · minimal · cinematic · modern · premium · gender-neutral.

Palette: black `#0A0A0B`, charcoal `#17171A`, ivory `#F3EDE4`, deep burgundy `#6D2E46`, silver `#A9A9A9`, subtle gold `#C9A227`.

## Pages

| Page | What it shows |
|---|---|
| `index.html` | The house — hero, the four AI pillars, featured archive pieces, storytelling, authentication, vision |
| `archive.html` | The vault — filterable, sortable authenticated collection |
| `product.html` | A piece — its story, digital product passport, AI confidence score, verification trail |
| `sell.html` | AI Listing Assistant — interactive demo that drafts a complete premium listing from "photographs" |
| `stylist.html` | AI Style Recommendations — a chat consultation with the archive ("Find me a quiet luxury outfit") |
| `authentication.html` | Human + AI authentication — process, checkpoints, confidence tiers, the passport |
| `about.html` | The Maison — manifesto, design philosophy, vision and contact |

## Running it

No build step, no dependencies. Everything is hand-written HTML/CSS/vanilla JS and every product illustration is inline SVG line art.

```bash
# open directly (concept-demo mode — the AI features play scripted demonstrations)
open index.html

# or serve locally
python3 -m http.server 8000
```

Web fonts (Cormorant Garamond, Jost) load from Google Fonts when online; elegant serif/sans fallbacks apply offline.

## Going live — GPT‑5.6 Sol

The AI Stylist chat and the Listing Atelier can run against OpenAI's **GPT‑5.6 Sol** model
(`gpt-5.6-sol`, Responses API) through the serverless functions in `/api`. The API key lives
only in a server-side environment variable — it is never shipped to the browser. When the API
is absent (opening the files directly, or no key configured), both pages automatically fall
back to their built-in scripted demonstrations.

### Deploy (Vercel, free tier works)

1. Push this repository to GitHub and import it at [vercel.com/new](https://vercel.com/new)
   — zero configuration, the static site and `/api` functions deploy together.
2. In the Vercel project → **Settings → Environment Variables**, add:
   - `OPENAI_API_KEY` — your key from platform.openai.com (**required**)
   - `OPENAI_MODEL` — optional, defaults to `gpt-5.6-sol`
     (set `gpt-5.6-terra` or `gpt-5.6-luna` to cut cost)
   - `ALLOWED_ORIGIN` — optional CORS lock, e.g. `https://raecae.com`
3. Redeploy. The stylist header switches to **Live**, and the Listing Atelier reveals
   "Or your own piece" — real photograph upload, real AI drafting.

### Billing (pay-as-you-go, prepaid)

The OpenAI API platform bills exactly the way requested: **you load credit onto the account,
and every API call is deducted from that balance.**

1. [platform.openai.com](https://platform.openai.com) → **Settings → Billing → Add credit balance**.
2. Optional: enable auto-recharge (e.g. top up $20 when the balance falls below $5).
3. Optional but recommended: **Settings → Limits** — set a monthly budget cap and an email alert.

GPT‑5.6 Sol pricing is $5 per million input tokens and $30 per million output tokens.
In practice for this site: a stylist message costs roughly **1–2 US cents**; a listing drafted
from four photographs roughly **3–6 US cents**. A $20 credit covers on the order of a thousand
stylist consultations.

### After editing the catalogue

The serverless stylist answers from `api/_catalog.json`. Regenerate it whenever
`js/data.js` changes:

```bash
node scripts/build-catalog.js
```

## Structure

```
css/main.css     — the design system (tokens, components, layout)
js/art.js        — SVG "archive plate" illustrations for every piece
js/data.js       — the demonstration catalogue (12 authenticated pieces)
js/main.js       — shared behaviour: nav/footer injection, reveal animations, product cards
js/config.js     — live-intelligence bridge (API detection + graceful fallback)
api/             — serverless functions: health, stylist chat, listing drafting
scripts/         — build-catalog.js (syncs api/_catalog.json from js/data.js)
*.html           — the seven pages
```

The catalogue, stories, passports and authentication data are demonstration content for concept purposes.
