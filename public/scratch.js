const scratchWin = document.getElementById("scratch-win");
const coin = document.getElementById("coin");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const scratchWinBackground = document.querySelector(".scratch-win__background");

const width = 320;
const height = 160;

// Paint golden gradient
canvas.width = width;
canvas.height = height;

const gradient = ctx.createLinearGradient(0, 0, width, height);

gradient.addColorStop(0, "#d4af37");
gradient.addColorStop(0.3, "#a67c00");
gradient.addColorStop(0.5, "#d4af37");
gradient.addColorStop(0.8, "#a67c00");
gradient.addColorStop(1, "#d4af37");

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

scratchWin.classList.add("scratch-win--ready");

// Generate a random 6-digit number
const generateRandomNumber = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

// Update the scratch-win__background with the random number
const updateBackgroundWithRandomNumber = () => {
  const randomNumber = generateRandomNumber();
  scratchWinBackground.innerText = randomNumber;
  // Send the random number to the parent window
  window.parent.postMessage({ type: "randomNumber", value: randomNumber }, "*");
};

// Initial call to update the background
updateBackgroundWithRandomNumber();

// Calculate transparency
const maxPixels = width * height;

const calculateTransparency = () => {
  const imageData = ctx.getImageData(0, 0, width, height).data;
  let transparentPixels = 0;

  for (let i = 3; i < imageData.length; i += 4) {
    if (imageData[i] === 0) {
      transparentPixels++;
    }
  }

  return transparentPixels / maxPixels;
};

const mouseFunction = (event) => {
  event.preventDefault();
  // Adjust for touch events
  const clientX = event.clientX || (event.touches && event.touches[0].clientX);
  const clientY = event.clientY || (event.touches && event.touches[0].clientY);

  if (clientX === undefined || clientY === undefined) return;

  coin.style = `--top: ${clientY}px; --left: ${clientX}px;`;
  // Scratch
  const canvasPosition = canvas.getBoundingClientRect();
  const canvasX = clientX - canvasPosition.left;
  const canvasY = clientY - canvasPosition.top;

  if (canvasX > 0 && canvasX < width && canvasY > 0 && canvasY < height) {
    ctx.clearRect(canvasX - 10, canvasY - 10, 20, 20);

    const transparency = calculateTransparency();
    console.log("Transparency:", transparency);

    if (transparency > 0.3) {
      console.log("Ticket sufficiently scratched.");
      window.parent.postMessage({ type: "scratched", value: true }, "*");
    }
  }
};

// Existing mouse and touch event listeners
window.addEventListener("mousemove", mouseFunction, { passive: false });
window.addEventListener("touchmove", mouseFunction, { passive: false });

// Add these event listeners for touch start and end
window.addEventListener("touchstart", mouseFunction, { passive: false });
window.addEventListener("touchend", mouseFunction, { passive: false });
