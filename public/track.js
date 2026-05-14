/**
 * BlockBoost AI crawler tracker.
 *
 * Customer adds ONE line to their site:
 *   <script src="https://visibilityiq.vercel.app/track.js"
 *           data-project="proj_xyz" async></script>
 *
 * What it does:
 *   - Fires a single beacon to /api/track/visit on page load
 *   - Sends only {projectId, url} — server re-detects UA + classifies
 *   - Falls back to <img> pixel if fetch is blocked (strict CSP)
 *   - Never throws, never logs, never affects page performance
 *
 * What it does NOT do:
 *   - Read cookies, set cookies, fingerprint, or track humans by ID
 *   - Phone home for anyone whose UA isn't an AI crawler (server-side filter)
 */
(function () {
  try {
    var script = document.currentScript;
    if (!script) return;
    var projectId = script.getAttribute("data-project");
    if (!projectId) return;

    var endpoint = (script.src || "").replace(/\/track\.js.*$/, "/api/track/visit");
    if (!endpoint || endpoint.indexOf("/api/track/visit") < 0) return;

    var url = window.location.href;
    var payload = JSON.stringify({ projectId: projectId, url: url });

    // Preferred: keepalive fetch so the request survives navigation.
    if (typeof fetch === "function") {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        credentials: "omit",
        mode: "cors",
      }).catch(function () {
        /* fall through to pixel below */
        pixel();
      });
    } else {
      pixel();
    }

    function pixel() {
      var img = new Image(1, 1);
      img.referrerPolicy = "no-referrer";
      img.src =
        endpoint +
        "?p=" + encodeURIComponent(projectId) +
        "&u=" + encodeURIComponent(url) +
        "&t=" + Date.now();
    }
  } catch (_e) {
    /* never break the host page */
  }
})();
