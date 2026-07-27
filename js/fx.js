/* ============================================================
   RAÉCAE — Ambient effects layer
   Particle field, scroll progress, custom cursor, text
   decode, card tilt, boot sequence, system readout.
   Self-contained: injects its own DOM, respects
   prefers-reduced-motion, and stays out of the way on touch.
   ============================================================ */

(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;

  /* ---------- Boot sequence (once per session) ---------- */
  (function boot() {
    if (reduce) return;
    var KEY = "raecae-booted";
    try { if (sessionStorage.getItem(KEY)) return; sessionStorage.setItem(KEY, "1"); }
    catch (e) { return; }

    var el = document.createElement("div");
    el.className = "fx-boot";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="fx-boot-word">RA<span class="accent">É</span>CAE</div>' +
      '<div class="fx-boot-bar"><i></i></div>' +
      '<div class="fx-boot-log"></div>';
    document.body.appendChild(el);

    var log = el.querySelector(".fx-boot-log");
    var bar = el.querySelector(".fx-boot-bar i");
    var steps = ["Opening the vault", "Verifying passports", "Archive online"];
    steps.forEach(function (s, i) {
      window.setTimeout(function () { log.textContent = s; }, 120 + i * 320);
    });
    window.setTimeout(function () { bar.style.transform = "scaleX(1)"; }, 60);
    window.setTimeout(function () { el.classList.add("done"); }, 1250);
    window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2000);
  })();

  /* ---------- Scroll progress ---------- */
  (function progress() {
    var bar = document.createElement("div");
    bar.className = "fx-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  })();

  /* ---------- Particle constellation ---------- */
  (function particles() {
    if (reduce) return;
    var canvas = document.createElement("canvas");
    canvas.id = "fx-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, pts = [], raf = null;
    var mouse = { x: -9999, y: -9999 };
    var COLORS = [
      [201, 162, 39],   /* gold */
      [125, 230, 239],  /* holo cyan */
      [143, 123, 255]   /* holo violet */
    ];

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.min(110, Math.round((W * H) / 16000));
      pts = [];
      for (var i = 0; i < count; i++) {
        pts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: 0.6 + Math.random() * 1.3,
          c: COLORS[(Math.random() * COLORS.length) | 0],
          tw: Math.random() * Math.PI * 2
        });
      }
    }

    function frame(t) {
      ctx.clearRect(0, 0, W, H);
      var i, j, p, q;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        p.x += p.vx; p.y += p.vy;
        /* gentle pull away from the pointer */
        var dx = p.x - mouse.x, dy = p.y - mouse.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 14400 && d2 > 0.01) {
          var f = 12 / d2;
          p.x += dx * f; p.y += dy * f;
        }
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;

        var a = 0.28 + 0.22 * Math.sin(t / 900 + p.tw);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = "rgba(" + p.c[0] + "," + p.c[1] + "," + p.c[2] + "," + a + ")";
        ctx.fill();
      }
      /* constellation lines */
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        for (j = i + 1; j < pts.length; j++) {
          q = pts[j];
          var ddx = p.x - q.x, ddy = p.y - q.y;
          var dist2 = ddx * ddx + ddy * ddy;
          if (dist2 < 12100) {
            var la = 0.055 * (1 - dist2 / 12100);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = "rgba(125,230,239," + la + ")";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      raf = window.requestAnimationFrame(frame);
    }

    function start() { if (raf == null) raf = window.requestAnimationFrame(frame); }
    function stop() { if (raf != null) { window.cancelAnimationFrame(raf); raf = null; } }

    window.addEventListener("resize", resize);
    if (fine) {
      window.addEventListener("mousemove", function (e) {
        mouse.x = e.clientX; mouse.y = e.clientY;
      }, { passive: true });
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
    resize();
    start();
  })();

  /* ---------- Custom cursor ---------- */
  (function cursor() {
    if (!fine || reduce) return;
    var ring = document.createElement("div");
    var dot = document.createElement("div");
    ring.className = "fx-cursor";
    dot.className = "fx-cursor-dot";
    ring.setAttribute("aria-hidden", "true");
    dot.setAttribute("aria-hidden", "true");
    ring.style.opacity = "0";
    dot.style.opacity = "0";
    document.body.appendChild(ring);
    document.body.appendChild(dot);
    document.body.classList.add("fx-cursor-on");

    var x = 0, y = 0, rx = 0, ry = 0, shown = false;
    document.addEventListener("mousemove", function (e) {
      x = e.clientX; y = e.clientY;
      if (!shown) { shown = true; ring.style.opacity = "1"; dot.style.opacity = "1"; }
      dot.style.left = x + "px"; dot.style.top = y + "px";
      var t = e.target;
      var interactive = t.closest && t.closest("a, button, input, select, textarea, label, summary, [role=button]");
      ring.classList.toggle("is-link", !!interactive);
    }, { passive: true });
    document.addEventListener("mouseleave", function () {
      shown = false; ring.style.opacity = "0"; dot.style.opacity = "0";
    });
    (function lag() {
      rx += (x - rx) * 0.16; ry += (y - ry) * 0.16;
      ring.style.left = rx + "px"; ring.style.top = ry + "px";
      window.requestAnimationFrame(lag);
    })();
  })();

  /* ---------- Text decode on reveal (kickers) ---------- */
  (function decode() {
    if (reduce || !("IntersectionObserver" in window)) return;
    var GLYPHS = "RAÉCAE·/\\<>|=+*01";
    var els = document.querySelectorAll(".kicker, [data-decode]");
    if (!els.length) return;

    function scramble(el) {
      var final = el.textContent;
      if (!final || el.getAttribute("data-decoded")) return;
      el.setAttribute("data-decoded", "1");
      var frames = 0, total = Math.min(26, 8 + final.length);
      function tick() {
        frames++;
        var reveal = Math.floor((frames / total) * final.length);
        var out = "";
        for (var i = 0; i < final.length; i++) {
          if (final[i] === " " || i < reveal) out += final[i];
          else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (frames < total) window.requestAnimationFrame(tick);
        else el.textContent = final;
      }
      tick();
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { scramble(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- 3D tilt on product cards ---------- */
  (function tilt() {
    if (!fine || reduce) return;
    var MAX = 5; /* degrees */
    document.addEventListener("mousemove", function (e) {
      var card = e.target.closest && e.target.closest(".product-card");
      if (!card) return;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform =
        "perspective(50rem) rotateX(" + (-py * MAX).toFixed(2) + "deg)" +
        " rotateY(" + (px * MAX).toFixed(2) + "deg) translateY(-6px)";
      card.style.transition = "border-color .5s, box-shadow .5s";
    }, { passive: true });
    document.addEventListener("mouseout", function (e) {
      var card = e.target.closest && e.target.closest(".product-card");
      if (!card) return;
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      card.style.transform = "";
      card.style.transition = "";
    }, { passive: true });
  })();

  /* ---------- System readout in the footer ---------- */
  (function sys() {
    function mount() {
      var bottom = document.querySelector(".footer-bottom");
      if (!bottom) return;
      var el = document.createElement("span");
      el.className = "fx-sys";
      bottom.appendChild(el);
      function tick() {
        var d = new Date();
        function pad(n) { return (n < 10 ? "0" : "") + n; }
        el.textContent =
          "Archive online · Amman 31.95°N 35.93°E · " +
          pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
      }
      tick();
      window.setInterval(tick, 1000);
    }
    /* main.js has already injected the footer by the time fx.js runs,
       but wait for DOM readiness when scripts are reordered. */
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount);
    } else {
      mount();
    }
  })();
})();
