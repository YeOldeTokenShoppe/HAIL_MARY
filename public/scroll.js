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
function createScrollOverlay(el, panelHeight, num, angle) {
  var tops = [];
  var bottoms = [];

  var topParent = el.parentNode;
  var bottomParent = el.parentNode;

  var html = el.innerHTML;

  var totalTheta = 0;

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
      topPanel.style.transform = transYrotX(-panelHeight, 0);
      bottomPanel.style.top = "100%";
      bottomPanel.style.transform = transYrotX(0, 0);
    } else {
      topPanel.style.transform = transYrotX(-panelHeight + 0.25, angle);
      // Negative: the bottom curls AWAY, like the top. Curling toward the
      // viewer, the roll stood ~70px off the page, and #container's
      // rotateY(20deg) swung it ~30px past the right edge as a blank slab.
      bottomPanel.style.transform = transYrotX(panelHeight - 0.25, -angle);

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

  // Start with a slight curl at the top (as if already scrolled down a bit)
  var initialScroll = 80;
  el.scrollTop = initialScroll;
  syncPanelContent(tops, bottoms, initialScroll, container.clientHeight, panelHeight);

  function update() {
    var scrollTop = el.scrollTop;
    var containerHeight = container.clientHeight;
    requestAnimationFrame(function() {
      syncPanelContent(tops, bottoms, scrollTop, containerHeight, panelHeight);
    });
  }

  el.onscroll = update;
  window.onresize = update;
}

var theta = 0.3;
var num = 20;
if (/iPhone|Android/.test(navigator.userAgent)) {
  theta = 0.45;
  num = 10;
}

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
  // Every div here is position:absolute, so a width-less #content sizes to
  // its text, not its container — on a phone that ran ~100px past the
  // right edge under body{overflow:hidden}, clipped with no way to pan.
  // Pin it to the container; the magnifier's zoom then rewraps instead.
  el.style.left = "0";
  el.style.width = "100%";
  el.style.boxSizing = "border-box";
  el.style.overflowX = "hidden"; // text wraps now; don't let it nudge sideways
  // Fixed-size inline images (scroll4/5's 200px heart) would still poke out
  // of a narrow, zoomed column — cap them at the column width. object-fit
  // keeps the art undistorted inside its authored box instead of squashing.
  el.querySelectorAll("img").forEach(function (img) {
    img.style.maxWidth = "100%";
    img.style.objectFit = "contain";
  });
} else {
  createScrollOverlay($("#content"), 20, num, theta);
}