/* ============================================================
   RAÉCAE — Image placeholders
   Every product image slot on the site renders through
   raecaeArt(). Until the real photography is supplied, each
   slot shows a clearly marked placeholder frame.

   To swap in real photos later: either replace this function
   to return an <img> tag per piece, or drop image files in
   /assets and map product ids to them here.
   ============================================================ */

(function () {
  var FRAME = "rgba(243,237,228,0.28)";
  var TICK = "rgba(201,162,39,0.55)";
  var ICON = "rgba(243,237,228,0.4)";
  var LABEL = "rgba(243,237,228,0.6)";
  var SUB = "rgba(243,237,228,0.32)";

  /**
   * Render an image placeholder as an SVG string.
   * Signature kept identical to the previous illustration renderer,
   * so every call site works unchanged.
   * @param {string} kind - ignored (was the illustration key)
   * @param {object} [opts] - ignored
   */
  window.raecaeArt = function (kind, opts) {
    return '<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Image placeholder">' +
      /* dashed placeholder frame */
      '<rect x="26" y="26" width="348" height="448" fill="none" stroke="' + FRAME + '" stroke-width="1.5" stroke-dasharray="2 8" stroke-linecap="round"/>' +
      /* gold corner ticks */
      '<g stroke="' + TICK + '" stroke-width="1.5" fill="none">' +
        '<path d="M26 46 L26 26 L46 26"/>' +
        '<path d="M354 26 L374 26 L374 46"/>' +
        '<path d="M374 454 L374 474 L354 474"/>' +
        '<path d="M46 474 L26 474 L26 454"/>' +
      "</g>" +
      /* photograph glyph */
      '<g fill="none" stroke="' + ICON + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="164" y="196" width="72" height="58" rx="4"/>' +
        '<circle cx="186" cy="216" r="6"/>' +
        '<path d="M164 242 L188 222 L206 238 L218 228 L236 244"/>' +
      "</g>" +
      /* label */
      '<text x="200" y="298" text-anchor="middle" font-family="Jost, Futura, sans-serif" font-size="15" letter-spacing="4.5" fill="' + LABEL + '">INSERT IMAGE HERE</text>' +
      '<text x="200" y="324" text-anchor="middle" font-family="Jost, Futura, sans-serif" font-size="10.5" letter-spacing="2.5" fill="' + SUB + '">PRODUCT PHOTOGRAPHY · 4 : 5</text>' +
      "</svg>";
  };

  window.RAECAE_ART_KINDS = ["placeholder"];
})();
