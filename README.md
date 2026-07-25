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

No build step, no dependencies, no backend. Everything is hand-written HTML/CSS/vanilla JS and every product illustration is inline SVG line art — the site is fully self-contained.

```bash
# open directly
open index.html

# or serve locally
python3 -m http.server 8000
```

Web fonts (Cormorant Garamond, Jost) load from Google Fonts when online; elegant serif/sans fallbacks apply offline.

## Structure

```
css/main.css   — the design system (tokens, components, layout)
js/art.js      — SVG "archive plate" illustrations for every piece
js/data.js     — the demonstration catalogue (12 authenticated pieces)
js/main.js     — shared behaviour: nav/footer injection, reveal animations, product cards
*.html         — the seven pages
```

The catalogue, stories, passports and authentication data are demonstration content for concept purposes.
