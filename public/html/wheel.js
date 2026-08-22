let emojis = [
  "🫶",
  "😇",
  "💣",
  "🥳",
  "💩",
  "📈",
  "🖕",
  "😈",
  "🚀",
  "👺",
  "💰",
  "📉",
];
const randInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
let rr = randInt(55, 255);
let gg = randInt(55, 255);
let bb = randInt(55, 255);
// store the timeout so we can cancel it if we spin again or change the number of emojis mid-spin
let spinTimeout = false;
let selectedEmoji = null;

function createSpinner(svgElt, slices = 12, list = emojis) {
  clearTimeout(spinTimeout);
  const percentC = 100 / slices;
  const ang = 270 - percentC * 1.8;
  const cx = 50;
  const cy = 50;
  const r = 25;
  const sw = 30;
  const startAngle = (ang * Math.PI) / 180; // convert to radians
  const angle = (percentC / 100) * (2 * Math.PI);
  const x = cx + r * Math.cos(startAngle + angle);
  const y = cy + r * Math.sin(startAngle + angle);
  const largeArc = percentC > 50 ? 1 : 0;
  let d = `M ${cx + r * Math.cos(startAngle)} ${
    cy + r * Math.sin(startAngle)
  } A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`;
  let textPath = `<defs><path id="wordPath" fill="none" stroke="red" d="M 43 16 q 7 -1 14 0 m -13 6 q 6 -1 12 0 m -11 7 q 5 -1 10 0 m -9 5 q 4 -1 8 0" /></defs>`;
  svgElt.insertAdjacentHTML("afterbegin", `<g class="slicesHere"></g>`);
  svgElt.insertAdjacentHTML("afterbegin", textPath);
  let sidewaysText = false;
  let sidewaysTextTransform = "";
  let textY = 15;
  let textSize = 200 / slices;
  if (textSize >= 20) {
    textSize = 20;
  }
  if (slices <= 8) {
    textY = 23;
  }
  if (sidewaysText) {
    sidewaysTextTransform = ` transform="rotate(-90 50 25)"`;
    textY = 25;
    textSize = 2;
  }
  for (let i = 0; i < slices; i++) {
    let sliceColor = `rgb(${((i + 1) * rr) % 255}, ${((i + 1) * gg) % 255}, ${
      ((i + 1) * bb) % 255
    })`;
    let path = `<g transform="rotate(${
      (360 / slices) * i
    } ${cx} ${cy})" class="slice"  data-value="${i}"><path class="slicePath" d="${d}" stroke="${sliceColor}" stroke-width="${sw}" fill="none"/><text x="50" y="${textY}" font-size="${textSize}" text-anchor="middle" textLength="25" dominant-baseline="middle"${sidewaysTextTransform}>${
      list[i % list.length]
    }</text></g>`;
    svgElt.querySelector(".slicesHere").insertAdjacentHTML("beforeend", path);
  }
  let spinAnimation = `<animateTransform class="ballAnim" attributeName="transform" attributeType="XML" type="rotate" values="0 50 50; 3600 50 50" dur="4000ms" begin="indefinite" repeatCount="1" fill="freeze" keyTimes="0;1" keySplines="0.25 0.1 0.25 1" calcMode="spline" />`;
  svgElt
    .querySelector(".slicesHere")
    .insertAdjacentHTML("afterbegin", spinAnimation);
  let spinner = `<g class="spinner"><circle cx="50" cy="50" r="8" /><path d="M50 38 l 2 5 h-4z" fill="#000" /></g>`;
  svgElt.insertAdjacentHTML("beforeend", spinner);
}
createSpinner(document.querySelector("#c"));
// The number of slices is now hardcoded to 12

async function spin(len = 12) {
  clearTimeout(spinTimeout);
  let segments = len;
  const winAngle = randInt(1800, 3600);
  const time = randInt(3000, 5000);

  document
    .querySelector(".ballAnim")
    .setAttribute("values", `0 50 50; ${winAngle} 50 50`);
  document.querySelector(".ballAnim").setAttribute("dur", `${time}ms`);
  const index =
    (segments - Math.round((winAngle % 360) / (360 / segments))) % segments;
  const winner = document.querySelector(`[data-value="${index}"] > text`);
  const winName = winner.textContent.trim();

  let slicess = document.querySelectorAll(`.slice`);
  for (let i = 0; i < slicess.length; i++) {
    slicess[i].classList.remove("winner");
  }

  document.querySelector(".ballAnim").beginElement();

  await new Promise((resolve) => {
    setTimeout(() => {
      confetti(document.querySelector("#c"), {
        type: [winName],
        flakes: 50,
        spin: false,
        fadeout: true,
        colors: ["gold", "goldenrod", "#000"],
        scale: 0.8,
        angle: 180,
        angleEmoji: 180,
      });
      document.querySelector(`[data-value="${index}"]`).classList.add("winner");

      selectedEmoji = winName;

      window.parent.postMessage({ selectedEmoji: selectedEmoji }, "*");
      resolve();
    }, time);
  });
}

document.querySelector("#c").addEventListener("click", () => {
  spin();
});