const canvas = document.getElementById('basketball-canvas');
const ctx = canvas.getContext('2d');
const scoreElem = document.getElementById('game-score');
const timeElem = document.getElementById('game-time');
const startBtn = document.getElementById('start-game-btn');
const gameSelector = document.getElementById('game-selector');
const gameTitle = document.getElementById('game-title');

let currentGame = 'basketball';
let score = 0;
let timeLeft = 60;
let isPlaying = false;
let gameInterval;

// Basketball Vars
let hoop = { x: 160, y: 50, width: 80, height: 10, speed: 4, direction: 1 };
let ball = { x: 200, y: 350, radius: 15, isShooting: false, speedY: 0, speedX: 0 };

// Flappy Vars
let flappy = { x: 70, y: 200, velocity: 0, gravity: 0.6, jump: -9, size: 36 }; 
let pipes = [];
let frameCount = 0;

if(gameSelector) {
    gameSelector.addEventListener('change', (e) => {
        currentGame = e.target.value;
        if(currentGame === 'basketball') {
            gameTitle.textContent = 'Mini Oyunlar - 🏀 Basketbol';
            timeElem.textContent = `Süre: 60s`;
        } else {
            gameTitle.textContent = 'Mini Oyunlar - 💩 Mahonun Göt Deliği';
            timeElem.textContent = `Süre: ∞`;
        }
        
        isPlaying = false;
        clearInterval(gameInterval);
        score = 0;
        scoreElem.textContent = `Skor: ${score}`;
        drawIdleState();
    });
}

startBtn.addEventListener('click', startGame);

// Allow clicking OR touching to shoot/jump
canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(); }, {passive: false});

// Local Leaderboard logic (Persisted via LocalStorage)
let leaderboard = JSON.parse(localStorage.getItem('voiceChatLeaderboard') || '{}');

function startGame() {
    if(isPlaying) return;
    score = 0;
    isPlaying = true;
    scoreElem.textContent = `Skor: ${score}`;
    
    if(currentGame === 'basketball') {
        timeLeft = 60;
        resetBasketball();
        timeElem.textContent = `Süre: ${timeLeft}s`;
        
        gameInterval = setInterval(() => {
            timeLeft--;
            timeElem.textContent = `Süre: ${timeLeft}s`;
            if(timeLeft <= 0) gameOver();
        }, 1000);
    } else {
        resetFlappy();
        timeElem.textContent = `Süre: ∞`;
    }
    
    requestAnimationFrame(gameLoop);
}

function handleInput() {
    if(!isPlaying) return;
    if(currentGame === 'basketball') {
        if(ball.isShooting) return;
        ball.isShooting = true;
        ball.speedY = -12; // throw upwards
    } else {
        flappy.velocity = flappy.jump; // Flappy jump up
    }
}

function gameLoop() {
    if(!isPlaying) {
        drawIdleState();
        return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if(currentGame === 'basketball') {
        updateBasketball();
        drawBasketball();
    } else {
        updateFlappy();
        drawFlappy();
    }
    
    requestAnimationFrame(gameLoop);
}

// ---------------------------
// BASKETBALL LOGIC
// ---------------------------
function updateBasketball() {
    hoop.x += hoop.speed * hoop.direction;
    if(hoop.x <= 0 || hoop.x + hoop.width >= canvas.width) {
        hoop.direction *= -1;
    }
    
    // Move Ball
    if(ball.isShooting) {
        ball.y += ball.speedY;
        
        // Check for collision with hoop zone
        if(ball.y <= hoop.y + hoop.height && ball.y + ball.radius >= hoop.y) {
            // Check horizontal boundaries of the hoop
            if(ball.x >= hoop.x && ball.x <= hoop.x + hoop.width) {
                // SCORE!
                score++;
                scoreElem.textContent = `Skor: ${score}`;
                // Small animation/flash could happen here
                resetBasketball();
                // Speed up hoop slightly to increase difficulty
                hoop.speed += 0.2;
            }
        }
        
        // Miss completely (went off screen)
        if(ball.y < -30) {
            resetBasketball();
        }
    }
}

function drawBasketball() {
    // Draw Hoop (Backboard and rim)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(hoop.x, hoop.y - 30, hoop.width, 30); // Backboard
    
    ctx.fillStyle = '#da373c';
    ctx.fillRect(hoop.x, hoop.y, hoop.width, hoop.height); // Rim
    
    // Draw Net (simple lines)
    ctx.fillStyle = 'white';
    ctx.fillRect(hoop.x + 5, hoop.y + hoop.height, 2, 30); 
    ctx.fillRect(hoop.x + hoop.width - 7, hoop.y + hoop.height, 2, 30);
    ctx.fillRect(hoop.x + 20, hoop.y + hoop.height, 2, 25);
    ctx.fillRect(hoop.x + hoop.width - 22, hoop.y + hoop.height, 2, 25);
    
    // Draw Ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#e67e22'; 
    ctx.fill();
    
    // Ball lines for style
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(ball.x - ball.radius, ball.y);
    ctx.lineTo(ball.x + ball.radius, ball.y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y - ball.radius);
    ctx.lineTo(ball.x, ball.y + ball.radius);
    ctx.stroke();
}

function resetBasketball() {
    ball.isShooting = false;
    ball.y = 350;
    ball.x = 200; // center
}

// ---------------------------
// FLAPPY TROLL LOGIC
// ---------------------------
function resetFlappy() {
    flappy.y = 200;
    flappy.velocity = 0;
    pipes = [];
    frameCount = 0;
}

function updateFlappy() {
    flappy.velocity += flappy.gravity;
    flappy.y += flappy.velocity;
    
    if(frameCount % 80 === 0) {
        let gap = 130; 
        let minHeight = 50;
        let pTopHeight = Math.floor(Math.random() * (canvas.height - gap - minHeight * 2)) + minHeight;
        pipes.push({
            x: canvas.width,
            topHeight: pTopHeight,
            bottomY: pTopHeight + gap,
            width: 50,
            passed: false
        });
    }
    
    for(let i = pipes.length-1; i >= 0; i--) {
        let p = pipes[i];
        p.x -= 3;
        
        // AABB Collision bounds for poop emoji
        let bx = flappy.x - flappy.size/2 + 5;
        let by = flappy.y - flappy.size/2 + 5;
        let bw = flappy.size - 10;
        let bh = flappy.size - 10;
        
        // Check hits pipe
        let hitX = (bx + bw > p.x && bx < p.x + p.width);
        let hitTopY = (by < p.topHeight);
        let hitBotY = (by + bh > p.bottomY);
        
        if(hitX && (hitTopY || hitBotY)) {
            gameOver();
            return;
        }
        
        // Check scores
        if(p.x + p.width < flappy.x && !p.passed) {
            score++;
            scoreElem.textContent = `Skor: ${score}`;
            p.passed = true;
        }
        
        // Remove offscreen pipes
        if(p.x + p.width < 0) {
            pipes.splice(i, 1);
        }
    }
    
    // Bounds hitting
    if(flappy.y > canvas.height || flappy.y < 0) {
        gameOver();
        return;
    }
    
    frameCount++;
}

function drawFlappy() {
    ctx.fillStyle = '#f0932b'; // Fleshy troll color context
    pipes.forEach(p => {
        // Top pipe
        ctx.fillRect(p.x, 0, p.width, p.topHeight);
        // Bottom pipe
        ctx.fillRect(p.x, p.bottomY, p.width, canvas.height - p.bottomY);
        
        // Lips / edges
        ctx.fillStyle = '#eb4d4b';
        ctx.fillRect(p.x - 5, p.topHeight - 20, p.width + 10, 20);
        ctx.fillRect(p.x - 5, p.bottomY, p.width + 10, 20);
        ctx.fillStyle = '#f0932b'; // restored
    });
    
    // Draw poop emoji
    ctx.font = `${flappy.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💩', flappy.x, flappy.y);
}


// ---------------------------
// CORE ENGINE LOGIC
// ---------------------------
function drawIdleState() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(currentGame === 'basketball') {
        drawBasketball();
    } else {
        drawFlappy();
    }
    
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0,0, canvas.width, canvas.height);
}

function gameOver() {
    isPlaying = false;
    if(gameInterval) clearInterval(gameInterval);
    drawIdleState();
    
    hoop.speed = 4; // reset diff
    
    alert(`Oyun Bitti! Toplam Skorunuz: ${score}`);
    
    // Add own score to leaderboard immediately
    if(window.updateLeaderboard) {
        const currentUser = window.getCurrentUser ? window.getCurrentUser() : {name: 'Siz'};
        if(currentUser) {
            window.updateLeaderboard(currentUser.name, score);
        }
    }
    
    // Broadcast over network
    if(window.broadcastScore) {
        window.broadcastScore(score);
    }
}

// Global leaderboard management
window.updateLeaderboard = function(name, newScore) {
    if(!leaderboard[name] || newScore > leaderboard[name]) {
        leaderboard[name] = newScore;
        localStorage.setItem('voiceChatLeaderboard', JSON.stringify(leaderboard));
        renderLeaderboard();
    }
};

window.getLeaderboardData = function() {
    return leaderboard;
};

window.syncLeaderboard = function(remoteLeaderboard) {
    if(!remoteLeaderboard) return;
    let hasUpdates = false;
    for(const [name, scr] of Object.entries(remoteLeaderboard)) {
        if(!leaderboard[name] || scr > leaderboard[name]) {
            leaderboard[name] = scr;
            hasUpdates = true;
        }
    }
    if(hasUpdates) {
        localStorage.setItem('voiceChatLeaderboard', JSON.stringify(leaderboard));
        renderLeaderboard();
    }
};

function renderLeaderboard() {
    const sorted = Object.entries(leaderboard).sort((a,b) => b[1] - a[1]);
    const list = document.getElementById('leaderboard-list');
    if(!list) return;
    
    list.innerHTML = '';
    sorted.forEach(([name, usrScore], index) => {
        let prefix = '';
        if(index === 0) prefix = '🥇';
        else if(index === 1) prefix = '🥈';
        else if(index === 2) prefix = '🥉';
        
        list.innerHTML += `<div style="display:flex; justify-content:space-between; background:var(--bg-primary); padding:12px; border-radius:6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <span style="font-weight:600;">${prefix} ${name}</span>
            <span style="color:var(--green); font-weight:bold; font-size: 16px;">${usrScore} <span style="font-size:10px; color:white;"> Puan</span></span>
        </div>`;
    });
}

// Initial draw
drawIdleState();
renderLeaderboard();
