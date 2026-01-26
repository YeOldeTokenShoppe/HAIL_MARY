// Each articulation panel consists of three DOM elements
//  - a grandparent for 3d positioning
//  - a parent for clipping
//  - and a child to hold and 'scroll' content via changing transforms
function panel(html) {
  var panelNode = document.createElement("div");
  var panelCutoutNode = document.createElement("div");
  var panelContentNode = document.createElement("div");

  panelNode.classList.add("panel-node");

  panelCutoutNode.classList.add("panel-cutout");

  panelContentNode.innerHTML = html;
  panelContentNode.classList.add("panel-content");

  panelCutoutNode.appendChild(panelContentNode);
  panelNode.appendChild(panelCutoutNode);

  return panelNode;
}

// Keep the content panels in sync by translating them up or down according to the scroll distance
function syncPanelContent(
  tops,
  bottoms,
  scrollTop,
  containerHeight,
  panelHeight
) {
  for (var i = 0; i < tops.length; i++) {
    var t = tops[i];
    var b = bottoms[i];
    var tTop = (i + 1) * panelHeight - scrollTop;
    var bTop = -i * panelHeight - scrollTop - containerHeight;
    t.style.transform = "translate3d(0," + tTop + "px,0)";
    b.style.transform = "translate3d(0," + bTop + "px,0)";
  }
}

function transYrotX(y, x) {
  return "translate3d(0," + y + "px,0) rotateX(" + x + "rad)";
}

// Create num top and bottom panels based off the innerHTML of el with articulation angle.
// We nest panels and use `transform-style: preserve-3d` to get the tentacle curl effect.
// Content and panels are both driven by JS transforms so they always update in the same
// frame — no desync between native compositor scrolling and JS panel updates.
function createScrollOverlay(el, panelHeight, num, angle) {
  var tops = [];
  var bottoms = [];

  var topParent = el.parentNode;
  var bottomParent = el.parentNode;

  var html = el.innerHTML;

  var totalTheta = 0;

  // Wrap content children in a transform-driven container.
  // This replaces native scrolling so content and panels always move together.
  var wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.transformStyle = "flat";
  wrapper.style.willChange = "transform";
  while (el.firstChild) wrapper.appendChild(el.firstChild);
  el.appendChild(wrapper);
  el.style.overflow = "hidden";

  var scrollPos = 110;
  var cachedHeight = container.clientHeight;
  var maxScroll = Math.max(0, wrapper.scrollHeight - cachedHeight);

  for (var i = 0; i < num; i++) {
    var topPanel = panel(html);
    var bottomPanel = panel(html);

    topPanel.style.height = panelHeight + "px";
    bottomPanel.style.height = panelHeight + "px";
    topPanel.style.transformOrigin = "50% 100% 0";
    bottomPanel.style.transformOrigin = "50% 0% 0";

    var topPanelContent = topPanel.querySelector(".panel-content");
    var bottomPanelContent = bottomPanel.querySelector(".panel-content");

    if (i === 0) {
      topPanel.style.transform = transYrotX(-panelHeight + 0.25, 0);
      bottomPanel.style.top = "100%";
      bottomPanel.style.transform = transYrotX(-0.25, 0);
    } else {
      topPanel.style.transform = transYrotX(-panelHeight + 0.25, angle);
      bottomPanel.style.transform = transYrotX(panelHeight - 0.25, angle);

      totalTheta += angle;
      totalTheta %= 2 * Math.PI;
      if (Math.PI * (1 / 2) < totalTheta && totalTheta < Math.PI * (3 / 2)) {
        topPanelContent.classList.add("backface");
        bottomPanelContent.classList.add("backface");
      }
    }

    angle += 0.025;

    tops.push(topPanelContent);
    bottoms.push(bottomPanelContent);

    topParent.appendChild(topPanel);
    bottomParent.appendChild(bottomPanel);

    topParent = topPanel;
    bottomParent = bottomPanel;
  }

  function sync() {
    wrapper.style.transform = "translate3d(0," + (-scrollPos) + "px,0)";
    syncPanelContent(tops, bottoms, scrollPos, cachedHeight, panelHeight);
  }

  var ticking = false;
  function scheduleSync() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      sync();
      ticking = false;
    });
  }

  // Wheel events — normalize deltaMode for mouse wheels vs trackpads
  el.addEventListener("wheel", function (e) {
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 20;
    else if (e.deltaMode === 2) delta *= cachedHeight;
    scrollPos = Math.max(0, Math.min(maxScroll, scrollPos + delta));
    scheduleSync();
  }, { passive: true });

  // Touch events with momentum
  var touchStartY = 0;
  var velocity = 0;
  var momentumId = null;

  el.addEventListener("touchstart", function (e) {
    touchStartY = e.touches[0].clientY;
    velocity = 0;
    if (momentumId) {
      cancelAnimationFrame(momentumId);
      momentumId = null;
    }
  }, { passive: true });

  el.addEventListener("touchmove", function (e) {
    var y = e.touches[0].clientY;
    var delta = touchStartY - y;
    touchStartY = y;
    velocity = delta;
    scrollPos = Math.max(0, Math.min(maxScroll, scrollPos + delta));
    scheduleSync();
  }, { passive: true });

  el.addEventListener("touchend", function () {
    function momentum() {
      velocity *= 0.95;
      if (Math.abs(velocity) < 0.5) {
        momentumId = null;
        return;
      }
      scrollPos = Math.max(0, Math.min(maxScroll, scrollPos + velocity));
      sync();
      momentumId = requestAnimationFrame(momentum);
    }
    momentumId = requestAnimationFrame(momentum);
  }, { passive: true });

  window.addEventListener("resize", function () {
    cachedHeight = container.clientHeight;
    maxScroll = Math.max(0, wrapper.scrollHeight - cachedHeight);
    scheduleSync();
  });

  // Initial sync — content and panels start at the same position, together
  sync();
}

var theta = 0.3;
var num = 20;

var $ = document.querySelector.bind(document);

var container = $("#container");
var isFlat = new URLSearchParams(window.location.search).get("flat") === "true";

if (isFlat) {
  container.style.transform = "translate(-50%, -50%)";
  container.style.perspective = "none";
  container.style.webkitPerspective = "none";
  container.style.width = "92%";
  container.style.height = "90%";
  container.style.maxHeight = "none";
  container.style.top = "50%";
  var el = $("#content");
  el.style.overflowY = "auto";
  el.style.webkitOverflowScrolling = "touch";
} else {
  if (/iPhone|Android/.test(navigator.userAgent)) {
    container.style.width = "clamp(70%, 65vmin, 90%)";
  }
  createScrollOverlay($("#content"), 20, num, theta);
}
