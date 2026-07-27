/* ============================================================
   RAÉCAE — Shared behaviour
   Injects the global navigation & footer, handles scroll
   states, reveal animations and product card rendering.
   ============================================================ */

(function () {
  var page = document.body.getAttribute("data-page") || "";

  /* ---------- Navigation ---------- */
  var NAV_LINKS = [
    { href: "archive.html", label: "The Archive", key: "archive" },
    { href: "sell.html", label: "Sell", key: "sell" },
    { href: "stylist.html", label: "AI Stylist", key: "stylist" },
    { href: "authentication.html", label: "Authentication", key: "authentication" },
    { href: "about.html", label: "Maison", key: "about" }
  ];

  var navRoot = document.getElementById("nav-root");
  if (navRoot) {
    navRoot.innerHTML =
      '<nav class="nav" id="site-nav">' +
        '<div class="wrap nav-inner">' +
          '<a href="index.html" class="wordmark" aria-label="RAÉCAE home">RA<span class="accent">É</span>CAE' +
            '<span class="wordmark-sub">The Intelligent Fashion Archive</span>' +
          "</a>" +
          '<ul class="nav-links" id="nav-links">' +
            NAV_LINKS.map(function (l) {
              var active = l.key === page ? ' class="active"' : "";
              return '<li><a href="' + l.href + '"' + active + ">" + l.label + "</a></li>";
            }).join("") +
          "</ul>" +
          '<a href="archive.html" class="btn btn--gold btn--small nav-cta">Enter the Vault</a>' +
          '<button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu" aria-expanded="false">' +
            "<span></span><span></span><span></span>" +
          "</button>" +
        "</div>" +
      "</nav>";

    var nav = document.getElementById("site-nav");
    var onScroll = function () {
      nav.classList.toggle("scrolled", window.scrollY > 24);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var toggle = document.getElementById("nav-toggle");
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.getElementById("nav-links").addEventListener("click", function (e) {
      if (e.target.tagName === "A") document.body.classList.remove("nav-open");
    });
  }

  /* ---------- Footer ---------- */
  var footerRoot = document.getElementById("footer-root");
  if (footerRoot) {
    footerRoot.innerHTML =
      '<footer class="footer">' +
        '<div class="wrap">' +
          '<div class="footer-grid">' +
            '<div class="footer-brand">' +
              '<a href="index.html" class="wordmark">RA<span class="accent">É</span>CAE</a>' +
              "<p>Authenticated luxury resale, built in Amman. Every piece is verified by AI and expert hands before it is listed, and carries a digital passport for life.</p>" +
            "</div>" +
            "<div>" +
              "<h4>House</h4>" +
              "<ul>" +
                '<li><a href="archive.html">The Archive</a></li>' +
                '<li><a href="sell.html">Sell With Us</a></li>' +
                '<li><a href="stylist.html">AI Stylist</a></li>' +
                '<li><a href="authentication.html">Authentication</a></li>' +
              "</ul>" +
            "</div>" +
            "<div>" +
              "<h4>Maison</h4>" +
              "<ul>" +
                '<li><a href="about.html">Our Vision</a></li>' +
                '<li><a href="about.html#philosophy">Design Philosophy</a></li>' +
                '<li><a href="about.html#region">Jordan · Gulf · Europe</a></li>' +
                '<li><a href="about.html#contact">Contact</a></li>' +
              "</ul>" +
            "</div>" +
            "<div>" +
              "<h4>The Private List</h4>" +
              '<p class="footer-note">New drops and archive arrivals, before anyone else.</p>' +
              '<form class="footer-newsletter" onsubmit="event.preventDefault(); this.querySelector(\'input\').value=\'\'; this.querySelector(\'.btn\').textContent=\'Welcome\';">' +
                '<input class="field" type="email" placeholder="Email address" aria-label="Email address" required>' +
                '<button class="btn btn--gold btn--small" type="submit">Join</button>' +
              "</form>" +
            "</div>" +
          "</div>" +
          '<div class="footer-bottom">' +
            "<span>© 2026 RAÉCAE · Authenticated luxury resale</span>" +
            "<span>Amman · Dubai · Paris</span>" +
          "</div>" +
        "</div>" +
      "</footer>";
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------- Marquee (duplicate track for seamless loop) ---------- */
  document.querySelectorAll(".marquee-track").forEach(function (track) {
    track.innerHTML += track.innerHTML;
  });

  /* ---------- Product card renderer ---------- */
  window.renderProductCard = function (p, opts) {
    opts = opts || {};
    var delay = opts.delay != null ? ' style="--d:' + opts.delay + 's"' : "";
    var reveal = opts.reveal === false ? "" : " reveal";
    return (
      '<a class="product-card' + reveal + '" href="product.html?id=' + p.id + '"' + delay + ">" +
        '<div class="product-art">' +
          '<span class="badge badge--verified">Verified</span>' +
          window.raecaeArt(p.art) +
        "</div>" +
        '<div class="product-meta">' +
          '<div class="product-brand">' + p.brand + "</div>" +
          '<div class="product-title">' + p.title + "</div>" +
          '<div class="product-row">' +
            '<span class="product-price">' + window.raecaeMoney(p.price) + "</span>" +
            '<span class="product-condition">' + p.condition + " · " + p.year + "</span>" +
          "</div>" +
        "</div>" +
      "</a>"
    );
  };
})();
