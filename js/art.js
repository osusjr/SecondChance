/* ============================================================
   RAÉCAE — Archive Plates
   Hand-drawn SVG line art for every piece in the archive.
   Each plate sits inside a museum "niche" arch — the visual
   motif of the RAÉCAE archive.
   ============================================================ */

(function () {
  const LINE = "rgba(243,237,228,0.82)";
  const LINE_SOFT = "rgba(243,237,228,0.4)";
  const GOLD = "#c9a227";
  const ARCH = "rgba(201,162,39,0.22)";

  /* The arch niche drawn behind every piece */
  const arch = `
    <path d="M92 462 L92 200 C92 128 140 76 200 76 C260 76 308 128 308 200 L308 462"
      fill="none" stroke="${ARCH}" stroke-width="1.4"/>
    <path d="M104 462 L104 204 C104 136 148 88 200 88 C252 88 296 136 296 204 L296 462"
      fill="none" stroke="rgba(201,162,39,0.1)" stroke-width="1"/>
    <line x1="70" y1="462" x2="330" y2="462" stroke="${ARCH}" stroke-width="1.4"/>`;

  const ART = {

    /* Structured top-handle bag (Kelly-style) */
    handbag: {
      lines: `
        <path d="M126 272 L274 272 L286 396 C286 402 282 406 276 406 L124 406 C118 406 114 402 114 396 Z"/>
        <path d="M126 272 L274 272 L277 314 L123 314 Z"/>
        <path d="M164 272 C164 216 236 216 236 272"/>
        <path d="M172 272 C172 224 228 224 228 272"/>
        <path d="M123 314 L114 396 M277 314 L286 396" stroke="${LINE_SOFT}"/>`,
      accents: `
        <rect x="188" y="306" width="24" height="14" rx="2"/>
        <line x1="200" y1="320" x2="200" y2="334"/>
        <circle cx="150" cy="293" r="3.2"/>
        <circle cx="250" cy="293" r="3.2"/>`
    },

    /* Quilted chain shoulder bag */
    shoulderbag: {
      lines: `
        <rect x="128" y="266" width="144" height="118" rx="10"/>
        <path d="M128 316 C160 306 240 306 272 316"/>
        <path d="M146 316 L188 384 M188 316 L146 384 M188 316 L230 384 M230 316 L188 384 M230 316 L268 378 M268 320 L230 384" stroke="${LINE_SOFT}"/>
        <path d="M142 266 C142 196 176 168 200 168 C224 168 258 196 258 266" stroke-dasharray="1 9" stroke-width="3.4" stroke-linecap="round"/>`,
      accents: `
        <circle cx="188" cy="341" r="10" fill="none"/>
        <circle cx="212" cy="341" r="10" fill="none"/>`
    },

    /* Heritage trench on hanger */
    trench: {
      lines: `
        <path d="M200 96 C214 96 218 108 210 114 C204 118 200 120 200 128"/>
        <path d="M136 138 C150 128 250 128 264 138"/>
        <path d="M136 138 L120 176 L134 420 C134 428 140 432 148 432 L252 432 C260 432 266 428 266 420 L280 176 L264 138"/>
        <path d="M182 138 L200 176 L218 138"/>
        <path d="M182 138 L164 244 M218 138 L236 244"/>
        <path d="M200 176 L196 300 M200 176 L206 300" stroke="${LINE_SOFT}"/>
        <rect x="146" y="286" width="108" height="16" rx="3"/>
        <path d="M156 138 L150 158 M244 138 L250 158" stroke="${LINE_SOFT}"/>`,
      accents: `
        <rect x="188" y="288" width="24" height="12" rx="2" fill="none"/>
        <circle cx="186" cy="216" r="3"/>
        <circle cx="214" cy="216" r="3"/>
        <circle cx="184" cy="252" r="3"/>
        <circle cx="216" cy="252" r="3"/>`
    },

    /* Tailored blazer */
    blazer: {
      lines: `
        <path d="M144 150 C162 138 238 138 256 150 L282 190 L272 262 L258 254 L262 416 C262 424 256 428 248 428 L152 428 C144 428 138 424 138 416 L142 254 L128 262 L118 190 Z"/>
        <path d="M176 146 L200 240 L188 262 L196 292"/>
        <path d="M224 146 L200 240 L212 262 L204 292"/>
        <path d="M176 146 L162 188 L184 176 Z M224 146 L238 188 L216 176 Z"/>
        <path d="M142 254 L138 416 M258 254 L262 416" stroke="${LINE_SOFT}"/>
        <path d="M154 332 L184 332 M216 332 L246 332"/>`,
      accents: `
        <circle cx="200" cy="308" r="4.5"/>
        <path d="M162 340 L180 340 M220 340 L238 340" fill="none"/>`
    },

    /* Tank-style watch */
    watch: {
      lines: `
        <path d="M168 96 L232 96 L226 176 L174 176 Z"/>
        <path d="M174 324 L226 324 L232 404 L168 404 Z"/>
        <rect x="150" y="176" width="100" height="148" rx="14"/>
        <rect x="164" y="190" width="72" height="120" rx="8"/>
        <path d="M182 112 L218 112 M180 136 L220 136 M178 158 L222 158" stroke="${LINE_SOFT}"/>
        <path d="M182 356 L218 356 M180 378 L220 378" stroke="${LINE_SOFT}"/>
        <circle cx="190" cy="368" r="2.4" stroke="${LINE_SOFT}"/>
        <circle cx="210" cy="368" r="2.4" stroke="${LINE_SOFT}"/>`,
      accents: `
        <path d="M200 250 L200 214 M200 250 L222 262" stroke-width="2.6"/>
        <circle cx="200" cy="250" r="3.4"/>
        <rect x="250" y="240" width="10" height="18" rx="3" fill="none"/>
        <path d="M172 198 L172 206 M200 194 L200 202 M228 198 L228 206 M172 294 L172 302 M200 298 L200 306 M228 294 L228 302" stroke-width="1.6"/>`
    },

    /* Horsebit loafer, side profile */
    loafers: {
      lines: `
        <path d="M104 348 C104 314 122 280 168 264 C210 250 238 258 268 276 C296 292 310 314 312 334 L312 344 C312 354 304 358 292 358 L118 358 C108 358 104 355 104 348 Z"/>
        <path d="M124 306 C150 290 196 282 224 292"/>
        <path d="M158 296 C166 314 186 326 214 326"/>
        <path d="M104 358 L104 372 C104 378 110 382 118 382 L292 382 C304 382 312 378 312 370 L312 358" stroke="${LINE_SOFT}"/>
        <path d="M240 300 C258 306 276 318 286 332" stroke="${LINE_SOFT}"/>`,
      accents: `
        <circle cx="186" cy="306" r="7" fill="none"/>
        <circle cx="214" cy="308" r="7" fill="none"/>
        <line x1="193" y1="307" x2="207" y2="308"/>`
    },

    /* Silk carré, draped */
    scarf: {
      lines: `
        <path d="M124 130 C104 190 130 224 172 244 C226 268 258 296 244 356 C234 398 190 420 150 408"/>
        <path d="M156 122 C140 178 164 208 206 228 C260 252 292 284 278 348 C266 402 216 428 168 416"/>
        <path d="M140 126 C124 184 148 216 190 236 C244 260 274 290 260 352 C250 400 204 424 158 412" stroke="${LINE_SOFT}"/>
        <path d="M124 130 C134 118 148 116 156 122 M150 408 C154 418 162 420 168 416"/>`,
      accents: `
        <path d="M172 176 L180 184 M198 194 L206 202 M226 254 L234 262 M244 292 L252 300 M240 330 L248 338" stroke-width="1.6"/>
        <path d="M130 158 C136 152 144 152 148 156" fill="none" stroke-width="1.6"/>`
    },

    /* Bias-cut slip dress on hanger */
    dress: {
      lines: `
        <path d="M200 92 C214 92 218 104 210 110 C204 114 200 116 200 124"/>
        <path d="M148 134 C162 126 238 126 252 134"/>
        <path d="M158 134 L172 208 M242 134 L228 208" stroke-width="1.6"/>
        <path d="M172 208 C186 220 214 220 228 208"/>
        <path d="M172 208 L164 264 C150 330 142 380 150 432 C170 442 230 442 254 430 C258 374 248 322 236 264 L228 208"/>
        <path d="M188 224 L184 300 M212 224 L218 310 M200 226 L200 340" stroke="${LINE_SOFT}"/>
        <path d="M150 432 C170 424 230 424 254 430" stroke="${LINE_SOFT}"/>`,
      accents: `
        <path d="M172 208 C186 198 214 198 228 208" fill="none" stroke-width="1.6"/>
        <circle cx="200" cy="92" r="0.1"/>`
    },

    /* Oversized acetate sunglasses */
    sunglasses: {
      lines: `
        <path d="M96 226 C96 210 108 202 128 202 L172 202 C188 202 196 212 196 228 L192 268 C190 288 176 300 152 300 C120 300 98 284 96 254 Z"/>
        <path d="M304 226 C304 210 292 202 272 202 L228 202 C212 202 204 212 204 228 L208 268 C210 288 224 300 248 300 C280 300 302 284 304 254 Z"/>
        <path d="M196 226 C198 218 202 218 204 226"/>
        <path d="M96 220 L64 212 M304 220 L336 212"/>
        <path d="M112 214 C126 208 158 208 176 212" stroke="${LINE_SOFT}"/>
        <path d="M288 214 C274 208 242 208 224 212" stroke="${LINE_SOFT}"/>`,
      accents: `
        <circle cx="98" cy="222" r="3"/>
        <circle cx="302" cy="222" r="3"/>`
    },

    /* Ankle boot, side profile */
    boots: {
      lines: `
        <path d="M152 128 L152 306 C152 322 158 332 174 336 L272 344 C296 348 310 340 308 322 C306 306 290 296 266 292 L224 284 C212 281 208 274 208 262 L208 128 C208 120 202 116 194 116 L166 116 C158 116 152 120 152 128 Z"/>
        <path d="M152 336 L152 372 C152 380 158 384 166 384 L188 384 C196 384 200 380 200 372 L200 344" />
        <path d="M200 384 L296 384 C308 384 312 378 310 368 C309 360 302 352 290 348" stroke="${LINE_SOFT}"/>
        <path d="M160 128 C174 122 190 122 200 128" stroke="${LINE_SOFT}"/>
        <path d="M226 292 C240 302 262 308 284 310" stroke="${LINE_SOFT}"/>`,
      accents: `
        <path d="M164 140 L164 320" stroke-dasharray="2 7" stroke-width="1.8"/>
        <circle cx="164" cy="132" r="2.6"/>`
    },

    /* Double pearl strand */
    necklace: {
      lines: `
        <path d="M128 152 C140 260 170 322 200 322 C230 322 260 260 272 152" stroke-dasharray="0.5 14" stroke-width="10" stroke-linecap="round"/>
        <path d="M144 150 C154 234 176 284 200 284 C224 284 246 234 256 150" stroke-dasharray="0.5 12.5" stroke-width="8.4" stroke-linecap="round" stroke="${LINE_SOFT}"/>`,
      accents: `
        <circle cx="128" cy="142" r="5" fill="none"/>
        <circle cx="272" cy="142" r="5" fill="none"/>
        <path d="M128 137 L128 128 M272 137 L272 128" stroke-width="1.6"/>`
    },

    /* Vintage biker jacket */
    jacket: {
      lines: `
        <path d="M148 152 C166 140 234 140 252 152 L284 188 L296 372 C296 380 290 386 282 386 L268 386 L262 300 L258 396 C258 404 252 408 244 408 L156 408 C148 408 142 404 142 396 L138 300 L132 386 L118 386 C110 386 104 380 104 372 L116 188 Z"/>
        <path d="M176 148 L200 196 L152 178 Z"/>
        <path d="M224 148 L200 196 L248 178 Z"/>
        <path d="M200 196 L206 408" />
        <path d="M206 220 L238 220 M206 260 L234 260" stroke="${LINE_SOFT}"/>
        <path d="M154 250 L182 262 M218 366 L248 366"/>
        <path d="M138 300 L142 396 M262 300 L258 396" stroke="${LINE_SOFT}"/>`,
      accents: `
        <path d="M206 212 L206 400" stroke-dasharray="2 6" stroke-width="1.8"/>
        <path d="M154 250 L182 262" stroke-dasharray="2 5" stroke-width="1.6"/>
        <circle cx="160" cy="186" r="3"/>
        <circle cx="240" cy="186" r="3"/>`
    },

    /* Coiled leather belt */
    belt: {
      lines: `
        <circle cx="200" cy="270" r="104"/>
        <circle cx="200" cy="270" r="84"/>
        <circle cx="200" cy="270" r="64" stroke="${LINE_SOFT}"/>
        <path d="M200 166 C216 166 228 172 236 180" stroke="${LINE_SOFT}"/>
        <path d="M148 340 C136 328 128 310 126 292" stroke="${LINE_SOFT}"/>`,
      accents: `
        <rect x="176" y="188" width="48" height="32" rx="6" fill="none" stroke-width="2.4"/>
        <line x1="200" y1="188" x2="200" y2="220" stroke-width="2.4"/>
        <path d="M242 204 L258 204 M264 204 L272 204" stroke-width="1.6"/>`
    }
  };

  /**
   * Render an archive plate as an SVG string.
   * @param {string} kind - key of ART
   * @param {object} [opts] - { arch: boolean }
   */
  window.raecaeArt = function (kind, opts) {
    const piece = ART[kind] || ART.handbag;
    const withArch = !opts || opts.arch !== false;
    return `<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Archive plate illustration">
      ${withArch ? arch : ""}
      <g fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${piece.lines}</g>
      <g fill="${GOLD}" stroke="${GOLD}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">${piece.accents}</g>
    </svg>`;
  };

  window.RAECAE_ART_KINDS = Object.keys(ART);
})();
