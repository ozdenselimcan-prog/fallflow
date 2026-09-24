/*
 * FallFlow Website-Widget
 * Einbindung:
 *   <script src="https://APP-DOMAIN/widget.js" data-company-id="COMPANY_ID"></script>
 * Das Script legt nur einen Button und einen iframe an. Der Chat selbst läuft auf der App-Domain.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var companyId = script.getAttribute("data-company-id");
  if (!companyId || !/^[A-Za-z0-9-]{1,64}$/.test(companyId)) {
    console.error("[FallFlow] data-company-id fehlt oder ist ungültig.");
    return;
  }
  if (document.getElementById("fallflow-widget-root")) return;

  var origin = new URL(script.src, window.location.href).origin;
  var label = script.getAttribute("data-label") || "Beratung anfragen";
  var color = /^#[0-9a-fA-F]{6}$/.test(script.getAttribute("data-color") || "") ? script.getAttribute("data-color") : "#1f6f5c";

  var root = document.createElement("div");
  root.id = "fallflow-widget-root";
  root.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,sans-serif;";

  var frameWrap = document.createElement("div");
  frameWrap.style.cssText =
    "display:none;position:absolute;right:0;bottom:64px;width:380px;height:600px;max-width:calc(100vw - 32px);max-height:calc(100vh - 96px);" +
    "border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.2);background:#fff;";

  var frame = document.createElement("iframe");
  frame.title = label;
  frame.style.cssText = "border:0;width:100%;height:100%;";
  frame.setAttribute("loading", "lazy");
  frameWrap.appendChild(frame);

  var button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-expanded", "false");
  button.style.cssText =
    "cursor:pointer;border:0;border-radius:999px;padding:14px 22px;font-size:15px;font-weight:600;color:#fff;background:" +
    color +
    ";box-shadow:0 6px 20px rgba(0,0,0,.2);";

  function mobileFullscreen() {
    if (window.innerWidth <= 480) {
      frameWrap.style.cssText += "position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;border-radius:0;bottom:0;right:0;";
    }
  }

  var open = false;
  button.addEventListener("click", function () {
    open = !open;
    if (open && !frame.src) frame.src = origin + "/widget/" + encodeURIComponent(companyId);
    frameWrap.style.display = open ? "block" : "none";
    button.textContent = open ? "Schließen" : label;
    button.setAttribute("aria-expanded", String(open));
    if (open) mobileFullscreen();
  });

  root.appendChild(frameWrap);
  root.appendChild(button);
  document.body.appendChild(root);
})();
