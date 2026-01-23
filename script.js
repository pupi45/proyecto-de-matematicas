// ===== Canvas =====
const graph = document.getElementById("graph");
const gctx = graph.getContext("2d");

const road = document.getElementById("road");
const rctx = road.getContext("2d");

// ===== HiDPI / Anti pixel =====
function setupHiDPICanvas(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

setupHiDPICanvas(graph, gctx);
setupHiDPICanvas(road, rctx);

// Si la ventana cambia, re-ajusta (evita pixelado al cambiar tamaño)
window.addEventListener("resize", () => {
  setupHiDPICanvas(graph, gctx);
  setupHiDPICanvas(road, rctx);
});

// ===== UI =====
const brake = document.getElementById("brake");
const gas = document.getElementById("gas");
const speedSlider = document.getElementById("speed");

document.getElementById("btnPrudente").addEventListener("click", () => setMode("prudente"));
document.getElementById("btnArriesgada").addEventListener("click", () => setMode("arriesgada"));
document.getElementById("btnTimida").addEventListener("click", () => setMode("timida"));

// ===== Imágenes =====
const roadImg = new Image(); roadImg.src = "road.png";
const carImg = new Image(); carImg.src = "car.png";
const obstacleImg = new Image(); obstacleImg.src = "cone.png";

// ===== Tamaños / Carril =====
const CAR_W = 80;
const CAR_H = 40;
const OBS_W = 30;
const OBS_H = 30;

// Ajusta este número si quieres el carril de arriba/abajo
const LANE_Y = 118;
const SAFE_GAP = 6;

// ===== Simulación =====
const WAIT_TIME = 120;
let mode = "prudente";
let speed = 0;
let carX = 50;
let obstacleX = 420;
let carState = "moving";
let waitTimer = 0;

// ===== PLANO INFINITO =====
let scale = 80;
let originX = graph.getBoundingClientRect().width / 2;
let originY = graph.getBoundingClientRect().height / 2;

let isDragging = false;
let lastX = 0;
let lastY = 0;

const points = [
  {x:0,y:1, label:"(lejos, rápido)"},
  {x:1,y:1, label:"(cerca, rápido)"},
  {x:0,y:0, label:"(lejos, lento)"},
  {x:1,y:0, label:"(cerca, lento)"}
];

// ===== Zoom & Pan =====
graph.addEventListener("wheel", (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  scale *= factor;
  scale = Math.max(20, Math.min(scale, 300));
});

graph.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastX = e.offsetX;
  lastY = e.offsetY;
});

graph.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  originX += e.offsetX - lastX;
  originY += e.offsetY - lastY;
  lastX = e.offsetX;
  lastY = e.offsetY;
});

window.addEventListener("mouseup", () => isDragging = false);

// ===== Dibujo del plano =====
function drawGraph() {
  const rect = graph.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  gctx.clearRect(0, 0, w, h);

  const left = (-originX) / scale;
  const right = (w - originX) / scale;
  const top = originY / scale;
  const bottom = (originY - h) / scale;

  // Grid
  gctx.strokeStyle = "#e0e0e0";
  gctx.lineWidth = 1;

  for (let x = Math.floor(left); x <= right; x++) {
    const px = originX + x * scale;
    gctx.beginPath();
    gctx.moveTo(px, 0);
    gctx.lineTo(px, h);
    gctx.stroke();
  }

  for (let y = Math.floor(bottom); y <= top; y++) {
    const py = originY - y * scale;
    gctx.beginPath();
    gctx.moveTo(0, py);
    gctx.lineTo(w, py);
    gctx.stroke();
  }

  // Axes
  gctx.strokeStyle = "#000";
  gctx.lineWidth = 2;
  gctx.beginPath();
  gctx.moveTo(0, originY);
  gctx.lineTo(w, originY);
  gctx.stroke();

  gctx.beginPath();
  gctx.moveTo(originX, 0);
  gctx.lineTo(originX, h);
  gctx.stroke();

  drawNumbers(left, right, bottom, top);
  drawPoints();
  drawDecisionLine();
}

function drawNumbers(left, right, bottom, top) {
  gctx.fillStyle = "#000";
  gctx.font = "12px Arial";

  for (let x = Math.floor(left); x <= right; x++) {
    gctx.fillText(x, originX + x * scale + 2, originY - 4);
  }

  for (let y = Math.floor(bottom); y <= top; y++) {
    gctx.fillText(y, originX + 4, originY - y * scale - 2);
  }
}

function drawPoints() {
  points.forEach((p) => {
    const px = originX + p.x * scale;
    const py = originY - p.y * scale;

    gctx.beginPath();
    gctx.arc(px, py, 6, 0, Math.PI * 2);
    gctx.fillStyle = "blue";
    gctx.fill();

    gctx.font = "12px Arial";
    gctx.fillStyle = "#111827";
    gctx.fillText(p.label, px + 10, py - 10);
  });
}

function drawDecisionLine() {
  let m, b, color;

  if (mode === "prudente") { m = -4; b = 2.5; color = "green"; }
  if (mode === "arriesgada") { m = -0.68; b = 2.00; color = "red"; }
  if (mode === "timida") { m = -1.13; b = 0.45; color = "orange"; }

  gctx.strokeStyle = color;
  gctx.lineWidth = 2;
  gctx.beginPath();

  let first = true;
  for (let x = -50; x <= 50; x += 0.1) {
    const y = m * x + b;
    const px = originX + x * scale;
    const py = originY - y * scale;
    if (first) { gctx.moveTo(px, py); first = false; }
    else gctx.lineTo(px, py);
  }
  gctx.stroke();
}

// ===== Carretera =====
function drawRoad() {
  const rect = road.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  rctx.clearRect(0, 0, w, h);
  rctx.drawImage(roadImg, 0, 0, w, h);

  // Carro y obstáculo alineados al carril
  rctx.drawImage(carImg, carX, LANE_Y, CAR_W, CAR_H);
  rctx.drawImage(obstacleImg, obstacleX, LANE_Y + 6, OBS_W, OBS_H);
}

// ===== Velocímetro =====
const arcVal = document.getElementById("arc-val");
const needle = document.getElementById("needle");
const spdText = document.getElementById("spdText");
const arcLength = arcVal.getTotalLength();

arcVal.style.strokeDasharray = `${arcLength} ${arcLength}`;
arcVal.style.strokeDashoffset = `${arcLength}`;

function updateSpeedometerCircle(v) {
  const max = 120;
  const t = Math.max(0, Math.min(v, max)) / max;

  // Arco
  const offset = arcLength * (1 - t);
  arcVal.style.strokeDashoffset = `${offset}`;

  // Color
  if (t < 0.55) arcVal.style.stroke = "rgba(59,130,246,0.95)";
  else if (t < 0.82) arcVal.style.stroke = "rgba(245,158,11,0.95)";
  else arcVal.style.stroke = "rgba(239,68,68,0.95)";

  // Aguja SIN PASARSE
  const needleLine = document.getElementById("needleLine");
const cx = 110, cy = 140;

// Angulos en radianes
const START_ANGLE = -135;
const END_ANGLE = 135;

let angle = START_ANGLE + (END_ANGLE - START_ANGLE) * t;

if (t > 0.97) angle += (Math.random() - 0.5) * 1.2;

// clamp final
angle = Math.max(START_ANGLE, Math.min(END_ANGLE, angle));

// convertir a radianes
const rad = (Math.PI / 180) * angle;

// largo de aguja (ajústalo si quieres)
const L = 60;

// punto final
const x2 = cx + L * Math.cos(rad);
const y2 = cy + L * Math.sin(rad);

needleLine.setAttribute("x1", cx);
needleLine.setAttribute("y1", cy);
needleLine.setAttribute("x2", x2);
needleLine.setAttribute("y2", y2);
spdText.textContent = Math.round(v);

}

// ===== Frenado (separado) =====
function updateCar() {
  const frontCar = carX + CAR_W;
  const distance = obstacleX - frontCar;

  brake.classList.remove("active");
  gas.classList.remove("active");

  // Más separados
  let base = 0;
  if (mode === "arriesgada") base = -100;   // muy tarde (a raya)
  if (mode === "prudente")   base = 28;  // más tarde que tímida
  if (mode === "timida")     base = 95;  // temprano

  // Más realista: velocidad²
  const stopDist = (speed * speed) / 220;

  // Arriesgada todavía más tarde
  const modeFactor = (mode === "arriesgada") ? 0.75 : 1.0;

  const brakeDistance = base + stopDist * modeFactor + SAFE_GAP;

  if (carState === "moving") {
    if (distance <= brakeDistance) {
      carState = "braking";
    } else {
      speed += 1;
      gas.classList.add("active");
    }
  }

  if (carState === "braking") {
    speed -= 3;
    brake.classList.add("active");

    // Si llegó al cono: frena exacto
    if (distance <= 0) {
      speed = 0;
      carState = "waiting";
      waitTimer = WAIT_TIME;
    }

    if (speed <= 0) {
      speed = 0;
      carState = "waiting";
      waitTimer = WAIT_TIME;
    }
  }

  if (carState === "waiting") {
    waitTimer--;
    if (waitTimer <= 0) resetSimulation();
  }

  speed = Math.max(0, Math.min(speed, 120));
  carX += speed * 0.02;
  speedSlider.value = speed;

  updateSpeedometerCircle(speed);
}

function resetSimulation() {
  carX = 50;
  obstacleX = 300 + Math.random() * 160; // mejor rango
  speed = 0;
  carState = "moving";
}

// ===== Modo =====
function setMode(m){
  mode = m;

  // quitar activo a todos
  document.querySelectorAll(".btn").forEach(btn=>{
    btn.classList.remove("active-mode");
  });

  // activar el correspondiente
  const btn = document.getElementById(
    m === "arriesgada" ? "btnArriesgada" :
    m === "prudente"   ? "btnPrudente"   :
                          "btnTimida"
  );

  if(btn) btn.classList.add("active-mode");
}


// ===== Secreto =====
const secretBtn = document.getElementById("secret-button");
const secretModal = document.getElementById("secret-modal");

secretBtn.addEventListener("dblclick", () => {
  secretModal.style.display = "flex";
});
secretModal.addEventListener("click", () => {
  secretModal.style.display = "none";
});

// ===== Loop =====
function loop() {
  updateCar();
  drawGraph();
  drawRoad();
  requestAnimationFrame(loop);
}
loop();
const themeBtn = document.getElementById("themeToggle");
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  themeBtn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
});