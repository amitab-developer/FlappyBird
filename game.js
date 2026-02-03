const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("start");

const runCountEl = document.getElementById("run-count");
const levelEl = document.getElementById("level");
const distanceEl = document.getElementById("distance");

const WORLD = {
  width: canvas.width,
  height: canvas.height,
  floor: canvas.height - 40,
  ceiling: 40,
};

let runCount = 1;
let level = 1;
let distance = 0;
let isRunning = false;
let lastTime = 0;
let roomSeed = Math.random();

const player = {
  x: 160,
  y: WORLD.height * 0.5,
  radius: 14,
  velocity: 0,
  gravity: 1300,
  dash: -420,
};

const roomState = {
  segments: [],
  segmentIndex: 0,
  scrollSpeed: 240,
  gap: 160,
  length: 2400,
  remaining: 2400,
};

const starfield = Array.from({ length: 60 }, () => ({
  x: Math.random() * WORLD.width,
  y: Math.random() * WORLD.height,
  r: Math.random() * 2 + 0.4,
  s: Math.random() * 0.6 + 0.2,
}));

function mulberry32(seed) {
  let t = seed * 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildRoom() {
  const random = mulberry32(roomSeed * 1000 + level);
  roomState.segments = [];
  roomState.segmentIndex = 0;
  roomState.scrollSpeed = 220 + level * 18;
  roomState.gap = Math.max(90, 180 - level * 8);
  roomState.length = 2200 + level * 120;
  roomState.remaining = roomState.length;

  let cursor = WORLD.width + 200;
  while (cursor < WORLD.width + roomState.length) {
    const center = WORLD.height * (0.25 + random() * 0.5);
    const gap = roomState.gap * (0.7 + random() * 0.6);
    const thickness = 220 + random() * 160;
    roomState.segments.push({
      x: cursor,
      center,
      gap,
      thickness,
    });
    cursor += 260 + random() * 220;
  }
}

function resetRun() {
  player.y = WORLD.height * 0.5;
  player.velocity = 0;
  distance = 0;
  roomSeed = Math.random();
  buildRoom();
  updateHud();
}

function updateHud() {
  runCountEl.textContent = runCount;
  levelEl.textContent = level;
  distanceEl.textContent = Math.floor(distance);
}

function startRun() {
  overlay.classList.add("hidden");
  isRunning = true;
  lastTime = performance.now();
  resetRun();
  requestAnimationFrame(loop);
}

function endRun() {
  isRunning = false;
  runCount += 1;
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = "You Died";
  overlay.querySelector("p").innerHTML = "Instant death. Instant restart. Click or press Space to go again.";
  overlay.querySelector(".sub").textContent = `Cleared level ${level - 1}. Ready for another run?`;
  startButton.textContent = "Restart";
  updateHud();
}

function nextRoom() {
  level += 1;
  resetRun();
}

function dash() {
  if (!isRunning) {
    startRun();
    return;
  }
  player.velocity = player.dash;
}

function update(delta) {
  const gravity = player.gravity * (delta / 1000);
  player.velocity += gravity;
  player.y += player.velocity * (delta / 1000);

  const scroll = roomState.scrollSpeed * (delta / 1000);
  distance += scroll;
  roomState.remaining -= scroll;

  roomState.segments.forEach((segment) => {
    segment.x -= scroll;
  });

  if (roomState.remaining <= 0) {
    nextRoom();
  }

  const hitCeiling = player.y - player.radius < WORLD.ceiling;
  const hitFloor = player.y + player.radius > WORLD.floor;
  if (hitCeiling || hitFloor) {
    endRun();
  }

  for (const segment of roomState.segments) {
    if (segment.x + segment.thickness < 0) {
      continue;
    }
    if (segment.x > player.x + player.radius) {
      break;
    }

    const withinX =
      player.x + player.radius > segment.x &&
      player.x - player.radius < segment.x + segment.thickness;
    if (!withinX) {
      continue;
    }

    const top = segment.center - segment.gap / 2;
    const bottom = segment.center + segment.gap / 2;
    if (player.y - player.radius < top || player.y + player.radius > bottom) {
      endRun();
      break;
    }
  }

  updateHud();
}

function draw() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = "#05070f";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  starfield.forEach((star) => {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
    star.x -= star.s;
    if (star.x < 0) {
      star.x = WORLD.width + Math.random() * 100;
      star.y = Math.random() * WORLD.height;
    }
  });

  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, WORLD.floor, WORLD.width, WORLD.height - WORLD.floor);
  ctx.fillRect(0, 0, WORLD.width, WORLD.ceiling);

  roomState.segments.forEach((segment) => {
    if (segment.x + segment.thickness < 0) {
      return;
    }
    ctx.fillStyle = "#ff5c5c";
    const topHeight = segment.center - segment.gap / 2 - WORLD.ceiling;
    ctx.fillRect(segment.x, WORLD.ceiling, segment.thickness, topHeight);

    const bottomY = segment.center + segment.gap / 2;
    const bottomHeight = WORLD.floor - bottomY;
    ctx.fillRect(segment.x, bottomY, segment.thickness, bottomHeight);
  });

  ctx.fillStyle = "#f7f7ff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, WORLD.ceiling, WORLD.width, WORLD.floor - WORLD.ceiling);
}

function loop(timestamp) {
  if (!isRunning) {
    return;
  }
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(loop);
}

startButton.addEventListener("click", dash);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    dash();
  }
});
canvas.addEventListener("pointerdown", dash);

buildRoom();
draw();
