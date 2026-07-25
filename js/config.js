/* ============================================================
   RAÉCAE — live intelligence bridge
   Detects the serverless API (deployed alongside the site) and
   exposes it to the pages. When the API is absent — opening the
   files directly, or no key configured — every page falls back
   to its built-in concept demonstration. No API key ever appears
   in client code.
   ============================================================ */

window.RAECAE_CONFIG = window.RAECAE_CONFIG || {
  /* Same-origin by default. Point at another deployment if the
     functions are hosted separately, e.g. "https://raecae.vercel.app/api". */
  apiBase: "/api"
};

window.RAECAE_AI = (function () {
  var base = window.RAECAE_CONFIG.apiBase.replace(/\/$/, "");
  var probePromise = null;
  var live = false;
  var model = "";

  function probe() {
    if (probePromise) return probePromise;
    if (window.location.protocol === "file:") {
      probePromise = Promise.resolve(false);
      return probePromise;
    }
    probePromise = fetch(base + "/health", { method: "GET" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        live = !!(j && j.ok && j.configured);
        model = (j && j.model) || "";
        return live;
      })
      .catch(function () { live = false; return false; });
    return probePromise;
  }

  function post(path, body, timeoutMs) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl && window.setTimeout(function () { ctrl.abort(); }, timeoutMs || 45000);
    return fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error((j && j.error) || "Request failed (" + r.status + ")");
          return j;
        });
      })
      .finally(function () { if (timer) window.clearTimeout(timer); });
  }

  return {
    probe: probe,
    isLive: function () { return live; },
    modelName: function () { return model; },
    /** messages: [{role:"user"|"assistant", content}] → {reply, pieces[]} */
    stylist: function (messages) { return post("/stylist", { messages: messages }, 45000); },
    /** photos: [dataURL], notes → structured listing */
    listing: function (photos, notes) { return post("/listing", { photos: photos, notes: notes }, 60000); },

    /** Downscale an image File to a JPEG data URL (max edge px). */
    fileToDataUrl: function (file, maxEdge) {
      maxEdge = maxEdge || 1024;
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          try {
            var scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
            var w = Math.max(1, Math.round(img.width * scale));
            var h = Math.max(1, Math.round(img.height * scale));
            var canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
          } catch (e) { reject(e); }
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Unreadable image")); };
        img.src = url;
      });
    }
  };
})();
