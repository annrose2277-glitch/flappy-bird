const canvas = document.getElementById("gameCanvas");
const loadingScreen = document.getElementById("loadingScreen");
const ctx = canvas.getContext("2d");
const playButton = document.getElementById("playButton");
const replayButton = document.getElementById("replayButton");
const pauseButton = document.getElementById("pauseButton");
const countdownDisplay = document.getElementById("countdown");
const scoreDisplay = document.getElementById("score");
const instructions = document.getElementById("instructions");
const bestScoreDisplay = document.getElementById("bestScore");
const gameOverScreen = document.getElementById("gameOverScreen");
const finalScore = document.getElementById("finalScore");
const finalBestScore = document.getElementById("finalBestScore");
const gameOverReplay = document.getElementById("gameOverReplay");
const sounds = {
  flap: new Audio("assets/sounds/flap.mp3"),
  hit: new Audio("assets/sounds/hit.mp3"),
  score: new Audio("assets/sounds/score.mp3"),
  start: new Audio("assets/sounds/start.mp3"),
  newHigh: new Audio("assets/sounds/newhighscore.mp3")
};

function playSound(sound) {
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

const confettiCanvas = document.getElementById("confettiCanvas");
const confettiCtx = confettiCanvas.getContext("2d");

confettiCanvas.width = window.innerWidth;
confettiCanvas.height = window.innerHeight;

let confettiParticles = [];

/* ===============================
   BIRD SELECTION SYSTEM
=================================*/

let selectedBird = "bird.png";
const birdOptions = document.querySelectorAll(".bird-option");

birdOptions.forEach(option => {
  option.addEventListener("click", () => {
    birdOptions.forEach(o => o.classList.remove("selected"));
    option.classList.add("selected");
    selectedBird = option.dataset.bird;
    bird.image.src = selectedBird;
  });
});

/* ===============================
   GAME CONSTANTS
=================================*/

const BASE_GRAVITY = 0.25;
let GRAVITY = BASE_GRAVITY;
const FLAP = -5.5;
const MAX_FALL_SPEED = 7;
const PIPE_WIDTH = 50;
const PIPE_GAP = 200;
const MIN_PIPE_DISTANCE = 300;
let currentPipeSpeed = 2;
const GRACE_PERIOD_MS = 2000;

/* ===============================
   GAME VARIABLES
=================================*/

let bird = {
  x: 50,
  y: 300,
  width: 50,
  height: 50,
  velocity: 0,
  image: new Image(),
};

let pipes = [];
let score = 0;
let isGameOver = false;
let isPaused = false;
let animationId = null;
let gameStartTime = 0;
let isDebugMode = false;

/* ===============================
   BEST SCORE STORAGE
=================================*/

let bestScore = parseInt(localStorage.getItem("bestScore")) || 0;
bestScoreDisplay.innerText = `Best: ${bestScore}`;

/* ===============================
   LOAD BIRD IMAGE
=================================*/

bird.image.src = selectedBird;

bird.image.onload = () => {
  setTimeout(() => {
    loadingScreen.style.display = "none";
    canvas.style.display = "block";
  }, 1000);
};

/* ===============================
   CREATE PIPE
=================================*/

function createPipe() {
  const gapY = Math.random() * (canvas.height - PIPE_GAP - 200) + 200;
  pipes.push({ x: canvas.width, y: gapY });
}

/* ===============================
   DRAW BIRD
=================================*/

function drawBird() {
  ctx.save();
  ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);

  if (isGameOver) {
    canvas.style.transform = "translateX(2px)";
    setTimeout(() => (canvas.style.transform = "translateX(-2px)"), 50);
  }

  const rotation = Math.min(
    Math.PI / 2,
    Math.max(-Math.PI / 9, bird.velocity * 0.1)
  );

  ctx.rotate(rotation);

  if (isGameOver) {
    ctx.filter = "grayscale(100%) brightness(60%) sepia(100%) hue-rotate(-50deg) saturate(500%)";
  }

  ctx.drawImage(
    bird.image,
    -bird.width / 2,
    -bird.height / 2,
    bird.width,
    bird.height
  );

  ctx.restore();
}

/* ===============================
   DRAW PIPES
=================================*/

function drawPipes() {
  ctx.fillStyle = "green";
  pipes.forEach((pipe) => {
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.y - PIPE_GAP);
    ctx.fillRect(pipe.x, pipe.y, PIPE_WIDTH, canvas.height - pipe.y);
  });
}

/* ===============================
   UPDATE GAME
=================================*/

function update() {
  if (isGameOver || isPaused) return;

  if (Date.now() - gameStartTime < GRACE_PERIOD_MS) {
    GRAVITY = BASE_GRAVITY * 0.5;
  } else {
    GRAVITY = BASE_GRAVITY;
  }

  bird.velocity += GRAVITY;

  if (bird.velocity > MAX_FALL_SPEED) {
    bird.velocity = MAX_FALL_SPEED;
  }

  bird.y += bird.velocity;

  currentPipeSpeed = 2 + Math.floor(score / 10) * 0.2;

  pipes.forEach((pipe) => (pipe.x -= currentPipeSpeed));

  pipes.forEach((pipe, index) => {
    if (!pipe.scored && bird.x > pipe.x + PIPE_WIDTH) {
      score++;
      pipe.scored = true;
      playSound(sounds.score);
    }

    if (pipe.x + PIPE_WIDTH < 0) {
      pipes.splice(index, 1);
    }
  });

  if (
    pipes.length === 0 ||
    pipes[pipes.length - 1].x < canvas.width - MIN_PIPE_DISTANCE
  ) {
    createPipe();
  }

  // OPTIMIZED COLLISION DETECTION: Circle-to-AABB
  const birdRadius = 20; 
  const birdCenterX = bird.x + bird.width / 2;
  const birdCenterY = bird.y + bird.height / 2;

  // Floor/Ceiling collision
  if (birdCenterY + birdRadius >= canvas.height || birdCenterY - birdRadius <= 0) {
    playSound(sounds.hit);
    isGameOver = true;
    return;
  }

  // Pipe collision
  pipes.forEach(pipe => {
    // Top Pipe Box
    let topPipeBox = { x: pipe.x, y: 0, w: PIPE_WIDTH, h: pipe.y - PIPE_GAP };
    // Bottom Pipe Box
    let bottomPipeBox = { x: pipe.x, y: pipe.y, w: PIPE_WIDTH, h: canvas.height - pipe.y };

    function checkCircleAABB(circleX, circleY, radius, box) {
      let testX = circleX;
      let testY = circleY;

      if (circleX < box.x) testX = box.x;
      else if (circleX > box.x + box.w) testX = box.x + box.w;

      if (circleY < box.y) testY = box.y;
      else if (circleY > box.y + box.h) testY = box.y + box.h;

      let distX = circleX - testX;
      let distY = circleY - testY;
      let distance = Math.sqrt((distX * distX) + (distY * distY));

      return distance <= radius;
    }

    if (checkCircleAABB(birdCenterX, birdCenterY, birdRadius, topPipeBox) || 
        checkCircleAABB(birdCenterX, birdCenterY, birdRadius, bottomPipeBox)) {
      playSound(sounds.hit);
      isGameOver = true;
    }
  });
}

/* ===============================
   DRAW FRAME
=================================*/

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawAdvancedBackground();
  drawBird();
  drawPipes();

  if (isPaused) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "40px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
  }

  scoreDisplay.innerText = `Score: ${score}`;
  bestScoreDisplay.innerText = `Best: ${bestScore}`;
}

/* ===============================
   GAME LOOP
=================================*/

function gameLoop() {
  update();
  draw();

  if (!isGameOver) {
    animationId = requestAnimationFrame(gameLoop);
  } else {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem("bestScore", bestScore);
      bestScoreDisplay.innerText = `Best: ${bestScore}`;
      playSound(sounds.newHigh);
      launchConfetti();
    }

    setTimeout(() => {
      showGameOverScreen();
      pauseButton.style.display = "none";
    }, 300);
  }
}

/* ===============================
   PREPARE GAME
=================================*/

function prepareGame() {
  bird = {
    x: 50,
    y: 300,
    width: 50,
    height: 50,
    velocity: 0,
    image: new Image()
  };

  bird.image.src = selectedBird;
  pipes = [];
  score = 0;
  isGameOver = false;
  isPaused = false;
  canvas.style.display = "block";
  replayButton.style.display = "none";
  playButton.style.display = "none";
  instructions.style.display = "none";
  pauseButton.style.display = "inline-block";
  pauseButton.innerText = "PAUSE";
  scoreDisplay.innerText = `Score: ${score}`;
  bestScoreDisplay.innerText = `Best: ${bestScore}`;
  gameOverScreen.style.display = "none";
  createPipe();
}

/* ===============================
   COUNTDOWN START
=================================*/

function startCountdown() {
  prepareGame();
  let countdown = 3;
  countdownDisplay.style.display = "block";
  countdownDisplay.innerText = countdown;

  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      countdownDisplay.innerText = countdown;
    } else {
      clearInterval(countdownInterval);
      countdownDisplay.style.display = "none";
      gameStartTime = Date.now();
      playSound(sounds.start);
      gameLoop();
    }
  }, 1000);
}

/* ===============================
   GAME OVER SCREEN
=================================*/

function showGameOverScreen() {
  finalScore.innerText = "Score: " + score;
  finalBestScore.innerText = "Best: " + bestScore;
  gameOverScreen.style.display = "flex";
}

/* ===============================
   FLAP
=================================*/

function flap() {
  if (!isGameOver && !isPaused) {
    bird.velocity = FLAP;
    playSound(sounds.flap);
  }
}

/* ===============================
   ADVANCED PARALLAX BACKGROUND
=================================*/

let clouds = [
  { x: 50, y: 80, size: 40 },
  { x: 200, y: 120, size: 35 },
  { x: 350, y: 60, size: 45 }
];

let mountains = [
  { x: 0, height: 180 },
  { x: 200, height: 150 },
  { x: 400, height: 170 }
];

const CLOUD_SPEED = 0.3;
const MOUNTAIN_SPEED = 0.15;

function drawSky() {
  let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (score < 10) {
    gradient.addColorStop(0, "#87CEEB");
    gradient.addColorStop(1, "#B0E0E6");
  } else if (score < 20) {
    gradient.addColorStop(0, "#FFB347");
    gradient.addColorStop(1, "#FF7F50");
  } else {
    gradient.addColorStop(0, "#0B132B");
    gradient.addColorStop(1, "#1C2541");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawClouds() {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  clouds.forEach(cloud => {
    cloud.x -= CLOUD_SPEED;
    if (cloud.x < -60) {
      cloud.x = canvas.width + Math.random() * 50;
      cloud.y = 40 + Math.random() * 120;
    }
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.size * 0.8, cloud.y + 5, cloud.size * 0.7, 0, Math.PI * 2);
    ctx.arc(cloud.x - cloud.size * 0.8, cloud.y + 5, cloud.size * 0.7, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawMountains() {
  ctx.fillStyle = "#556B2F";
  mountains.forEach(m => {
    m.x -= MOUNTAIN_SPEED;
    if (m.x < -200) {
      m.x = canvas.width;
    }
    ctx.beginPath();
    ctx.moveTo(m.x, canvas.height);
    ctx.lineTo(m.x + 100, canvas.height - m.height);
    ctx.lineTo(m.x + 200, canvas.height);
    ctx.closePath();
    ctx.fill();
  });
}

function drawAdvancedBackground() {
  drawSky();
  drawClouds();
  drawMountains();
}

/* ===============================
   BUTTON EVENTS
=================================*/

playButton.addEventListener("click", startCountdown);
replayButton.addEventListener("click", () => {
  prepareGame();
  gameLoop();
});
gameOverReplay.addEventListener("click", () => {
  gameOverScreen.style.display = "none";
  prepareGame();
  gameLoop();
});
pauseButton.addEventListener("click", () => {
  isPaused = !isPaused;
  pauseButton.innerText = isPaused ? "RESUME" : "PAUSE";
});

function launchConfetti() {
  confettiParticles = [];
  for (let i = 0; i < 150; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * -confettiCanvas.height,
      size: Math.random() * 6 + 4,
      speed: Math.random() * 3 + 2,
      angle: Math.random() * Math.PI * 2,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`
    });
  }
  animateConfetti();
}

function animateConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiParticles.forEach(p => {
    p.y += p.speed;
    p.x += Math.sin(p.angle);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(p.x, p.y, p.size, p.size);
  });
  confettiParticles = confettiParticles.filter(p => p.y < confettiCanvas.height);
  if (confettiParticles.length > 0) {
    requestAnimationFrame(animateConfetti);
  }
}

/* ===============================
   INPUT CONTROLS
=================================*/

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") flap();
  if (event.code === "KeyP" && !isGameOver) {
    isPaused = !isPaused;
    pauseButton.innerText = isPaused ? "RESUME" : "PAUSE";
  }
  if (event.code === "KeyD") {
    isDebugMode = !isDebugMode;
  }
});

window.addEventListener("mousedown", (event) => {
  if (event.target.tagName !== "BUTTON") {
    flap();
  }
});

window.addEventListener("touchstart", (event) => {
  if (event.target.tagName !== "BUTTON") {
    event.preventDefault();
    flap();
  }
}, { passive: false });
