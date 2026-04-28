const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const quitButton = document.getElementById('quitButton');
const controls = document.getElementById('controls');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

const context = ctx;
context.scale(20, 20); // Scale the grid to 20px blocks
nextCtx.scale(20, 20);

// --- Audio Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type = 'square', duration = 0.1, volume = 0.1) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const nextPieces = [];

function createPiece(type) {
    if (type === 'I') return [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]];
    if (type === 'L') return [[0, 2, 0], [0, 2, 0], [0, 2, 2]];
    if (type === 'J') return [[0, 3, 0], [0, 3, 0], [3, 3, 0]];
    if (type === 'O') return [[4, 4], [4, 4]];
    if (type === 'Z') return [[5, 5, 0], [0, 5, 5], [0, 0, 0]];
    if (type === 'S') return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
    if (type === 'T') return [[0, 7, 0], [7, 7, 7], [0, 0, 0]];
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) matrix.push(new Array(w).fill(0));
    return matrix;
}

function drawMatrix(matrix, offset, targetCtx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                targetCtx.fillStyle = colors[value];
                targetCtx.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];
const arena = createMatrix(12, 20);
const player = { pos: {x: 0, y: 0}, matrix: null, score: 0 };

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
        }
    }
    return false;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
        });
    });
}

function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        player.score += rowCount * 10;
        rowCount *= 2;
        playSound(600, 'triangle', 0.3); // Line clear sound
    }
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
        playSound(150, 'sine', 0.05); // Landing sound
    }
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
    else playSound(200, 'square', 0.05, 0.05); // Move sound
}

function updateNextPieces() {
    while (nextPieces.length < 3) {
        const pieces = 'ILJOTSZ';
        nextPieces.push(createPiece(pieces[pieces.length * Math.random() | 0]));
    }
}

function playerReset() {
    if (nextPieces.length === 0) updateNextPieces();
    player.matrix = nextPieces.shift();
    updateNextPieces(); 
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        player.score = 0;
        playSound(100, 'sawtooth', 0.5); // Game Over sound
        updateScore();
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    playSound(300, 'square', 0.05, 0.05); // Rotate sound
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let requestId;
let isPaused = true;

function update(time = 0) {
    if (isPaused) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    requestId = requestAnimationFrame(update);
}

function updateScore() {
    scoreDisplay.innerText = player.score;
}

function drawNext() {
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    nextPieces.forEach((matrix, index) => {
        drawMatrix(matrix, {x: 0.5, y: 1 + (index * 4.5)}, nextCtx);
    });
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0});
    if (player.matrix) drawMatrix(player.matrix, player.pos);
    drawNext();
}

document.addEventListener('keydown', event => {
    if (event.keyCode === 37) playerMove(-1);
    else if (event.keyCode === 39) playerMove(1);
    else if (event.keyCode === 40) playerDrop();
    else if (event.keyCode === 38) playerRotate(1);
});

startButton.addEventListener('click', () => {
    if (!player.matrix) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        isPaused = false;
        playerReset();
        updateScore();
        lastTime = performance.now();
        update(lastTime);
        startButton.classList.add('hidden');
        controls.classList.remove('hidden');
    }
});

restartButton.addEventListener('click', () => {
    cancelAnimationFrame(requestId);
    arena.forEach(row => row.fill(0));
    nextPieces.length = 0;
    player.score = 0;
    isPaused = false;
    playerReset();
    updateScore();
    dropCounter = 0;
    lastTime = performance.now();
    update(lastTime);
});

quitButton.addEventListener('click', () => {
    cancelAnimationFrame(requestId);
    isPaused = true;
    arena.forEach(row => row.fill(0));
    nextPieces.length = 0;
    player.score = 0;
    player.matrix = null;
    updateScore();
    controls.classList.add('hidden');
    startButton.classList.remove('hidden');
    draw();
});

draw();