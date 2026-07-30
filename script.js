document.documentElement.classList.add("js-ready");

const gameBoard = document.querySelector("#game-board");

if (gameBoard) {
  const context = gameBoard.getContext("2d");
  const scoreElement = document.querySelector("#score");
  const highScoreElement = document.querySelector("#high-score");
  const statusElement = document.querySelector("#game-status");
  const startButton = document.querySelector("#start-game");
  const pauseButton = document.querySelector("#pause-game");
  const restartButton = document.querySelector("#restart-game");
  const cellSize = gameBoard.width / 20;
  const highScoreKey = "bitwise-snake-high-score";

  let snake;
  let food;
  let direction;
  let queuedDirection;
  let score;
  let running = false;
  let paused = false;
  let gameOver = false;
  let timerId = null;
  let enemies = [];
  let gameStartTime = 0;

  const readHighScore = () => Number(localStorage.getItem(highScoreKey) || 0);

  const updateHud = () => {
    scoreElement.textContent = String(score);
    highScoreElement.textContent = String(Math.max(readHighScore(), score));
    pauseButton.disabled = !running || gameOver;
  };

  const draw = () => {
    context.fillStyle = "#17221f";
    context.fillRect(0, 0, gameBoard.width, gameBoard.height);
    context.strokeStyle = "rgba(183, 214, 203, 0.12)";
    context.lineWidth = 1;
    for (let line = 0; line <= 20; line += 1) {
      const position = line * cellSize;
      context.beginPath();
      context.moveTo(position, 0);
      context.lineTo(position, gameBoard.height);
      context.stroke();
      context.beginPath();
      context.moveTo(0, position);
      context.lineTo(gameBoard.width, position);
      context.stroke();
    }

    context.fillStyle = "#e2b86b";
    context.fillRect(food.x * cellSize + 3, food.y * cellSize + 3, cellSize - 6, cellSize - 6);
    enemies.forEach((enemy) => {
      context.beginPath();
      context.fillStyle = "#f07b68";
      context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      context.fill();
    });
    snake.forEach((segment, index) => {
      context.fillStyle = index === 0 ? "#b7d6cb" : "#5ca18e";
      context.fillRect(segment.x * cellSize + 2, segment.y * cellSize + 2, cellSize - 4, cellSize - 4);
    });
  };

  const placeFood = () => {
    let candidate;
    do {
      candidate = {
        x: Math.floor(Math.random() * 20),
        y: Math.floor(Math.random() * 20),
      };
    } while (snake.some((segment) => segment.x === candidate.x && segment.y === candidate.y));
    food = candidate;
  };

  const spawnEnemy = () => {
    const center = gameBoard.width / 2;
    const side = Math.floor(Math.random() * 4);
    const enemy = { x: center, y: center, radius: cellSize * 0.32, vx: 0, vy: 0 };
    if (side === 0) enemy.x = -enemy.radius;
    if (side === 1) enemy.x = gameBoard.width + enemy.radius;
    if (side === 2) enemy.y = -enemy.radius;
    if (side === 3) enemy.y = gameBoard.height + enemy.radius;
    if (side === 0 || side === 1) enemy.y = Math.random() * gameBoard.height;
    if (side === 2 || side === 3) enemy.x = Math.random() * gameBoard.width;
    const deltaX = center - enemy.x;
    const deltaY = center - enemy.y;
    const distance = Math.hypot(deltaX, deltaY) || 1;
    const speed = 2.25 + Math.floor((performance.now() - gameStartTime) / 8000) * 0.12;
    enemy.vx = (deltaX / distance) * speed;
    enemy.vy = (deltaY / distance) * speed;
    enemies.push(enemy);
  };

  const maintainEnemies = () => {
    const targetCount = 1 + Math.floor((performance.now() - gameStartTime) / 4000);
    while (enemies.length < targetCount) spawnEnemy();
  };

  const advanceEnemies = () => {
    enemies.forEach((enemy) => {
      enemy.x += enemy.vx;
      enemy.y += enemy.vy;
    });
    enemies = enemies.filter((enemy) => {
      const outside = enemy.x < -enemy.radius || enemy.x > gameBoard.width + enemy.radius
        || enemy.y < -enemy.radius || enemy.y > gameBoard.height + enemy.radius;
      if (outside) score += 1;
      return !outside;
    });
  };

  const enemyHitsCell = (cell) => {
    const cellCenter = {
      x: cell.x * cellSize + cellSize / 2,
      y: cell.y * cellSize + cellSize / 2,
    };
    return enemies.find((enemy) => Math.hypot(enemy.x - cellCenter.x, enemy.y - cellCenter.y)
      <= enemy.radius + cellSize * 0.35);
  };

  const resetRound = () => {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    direction = { x: 1, y: 0 };
    queuedDirection = { x: 1, y: 0 };
    placeFood();
    draw();
  };

  const stopTimer = () => {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  const startTimer = () => {
    if (timerId === null) {
      timerId = window.setInterval(tick, 150);
    }
  };

  const endGame = () => {
    running = false;
    paused = false;
    gameOver = true;
    stopTimer();
    enemies = [];
    gameStartTime = 0;
    if (score > readHighScore()) {
      localStorage.setItem(highScoreKey, String(score));
    }
    statusElement.textContent = "Game over";
    startButton.textContent = "Start again";
    updateHud();
  };

  function tick() {
    if (!running || paused || gameOver) return;
    maintainEnemies();
    advanceEnemies();
    direction = queuedDirection;
    const head = snake[0];
    const nextHead = { x: head.x + direction.x, y: head.y + direction.y };
    const hitWall = nextHead.x < 0 || nextHead.x >= 20 || nextHead.y < 0 || nextHead.y >= 20;
    const willEat = nextHead.x === food.x && nextHead.y === food.y;
    const bodyToCheck = willEat ? snake : snake.slice(0, -1);
    const hitSelf = bodyToCheck.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);
    const hitEnemy = enemyHitsCell(nextHead);
    if (hitWall || hitSelf || hitEnemy) {
      if (hitEnemy) enemies = enemies.filter((enemy) => enemy !== hitEnemy);
      endGame();
      updateHud();
      draw();
      return;
    }

    snake.unshift(nextHead);
    if (willEat) {
      placeFood();
    } else {
      snake.pop();
    }
    statusElement.textContent = "Running";
    updateHud();
    draw();
  }

  const setDirection = (nextDirection) => {
    if (nextDirection.x === -direction.x && nextDirection.y === -direction.y) return;
    if (nextDirection.x === -queuedDirection.x && nextDirection.y === -queuedDirection.y) return;
    queuedDirection = nextDirection;
    if (!running && !gameOver) startGame();
  };

  const startGame = () => {
    if (gameOver) {
      score = 0;
      gameOver = false;
      enemies = [];
      gameStartTime = 0;
      resetRound();
    }
    if (!running) gameStartTime = performance.now();
    running = true;
    paused = false;
    statusElement.textContent = "Running";
    startButton.textContent = "Running";
    startTimer();
    updateHud();
  };

  const togglePause = () => {
    if (!running || gameOver) return;
    paused = !paused;
    statusElement.textContent = paused ? "Paused" : "Running";
    pauseButton.textContent = paused ? "Resume" : "Pause";
  };

  const restartGame = () => {
    stopTimer();
    score = 0;
    running = false;
    paused = false;
    gameOver = false;
    enemies = [];
    gameStartTime = 0;
    startButton.textContent = "Start game";
    pauseButton.textContent = "Pause";
    statusElement.textContent = "Ready";
    resetRound();
    updateHud();
  };

  const guideFromPointer = (event) => {
    const bounds = gameBoard.getBoundingClientRect();
    const target = {
      x: ((event.clientX - bounds.left) / bounds.width) * 20,
      y: ((event.clientY - bounds.top) / bounds.height) * 20,
    };
    const head = snake[0];
    const deltaX = target.x - head.x;
    const deltaY = target.y - head.y;
    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      setDirection({ x: deltaX >= 0 ? 1 : -1, y: 0 });
    } else {
      setDirection({ x: 0, y: deltaY >= 0 ? 1 : -1 });
    }
  };

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const directions = {
      arrowup: { x: 0, y: -1 },
      w: { x: 0, y: -1 },
      arrowdown: { x: 0, y: 1 },
      s: { x: 0, y: 1 },
      arrowleft: { x: -1, y: 0 },
      a: { x: -1, y: 0 },
      arrowright: { x: 1, y: 0 },
      d: { x: 1, y: 0 },
    };
    if (directions[key]) {
      event.preventDefault();
      setDirection(directions[key]);
    } else if (key === "p" || event.code === "Space") {
      event.preventDefault();
      togglePause();
    } else if (event.key === "Enter") {
      startGame();
    }
  });

  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const directionMap = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
      };
      setDirection(directionMap[button.dataset.direction]);
    });
  });

  gameBoard.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    guideFromPointer(event);
  });
  gameBoard.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || event.buttons > 0) guideFromPointer(event);
  });

  startButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", togglePause);
  restartButton.addEventListener("click", restartGame);
  score = 0;
  resetRound();
  updateHud();
}
