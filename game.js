const canvas = document.getElementById('basketball-canvas');
const ctx = canvas.getContext('2d');
const scoreElem = document.getElementById('game-score');
const timeElem = document.getElementById('game-time');
const startBtn = document.getElementById('start-game-btn');

let score = 0;
let timeLeft = 60;
let isPlaying = false;
let gameInterval;

let hoop = { x: 160, y: 50, width: 80, height: 10, speed: 4, direction: 1 };
let ball = { x: 200, y: 350, radius: 15, isShooting: false, speedY: 0, speedX: 0 };

startBtn.addEventListener('click', startGame);

// Allow clicking OR touching to shoot
canvas.addEventListener('mousedown', shootBall);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); shootBall(); });

// Local Leaderboard logic
let leaderboard = {};

function startGame() {
    if(isPlaying) return;
    score = 0;
    timeLeft = 60;
    isPlaying = true;
    resetBall();
    
    scoreElem.textContent = `Skor: ${score}`;
    timeElem.textContent = `Süre: ${timeLeft}s`;
    
    gameInterval = setInterval(() => {
        timeLeft--;
        timeElem.textContent = `Süre: ${timeLeft}s`;
        if(timeLeft <= 0) gameOver();
    }, 1000);
    
    requestAnimationFrame(gameLoop);
}

function shootBall() {
    if(!isPlaying || ball.isShooting) return;
    ball.isShooting = true;
    ball.speedY = -12; // throw upwards
}

function gameLoop() {
    if(!isPlaying) {
        drawIdleState();
        return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Move Hoop horizontally
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
                resetBall();
                // Speed up hoop slightly to increase difficulty
                hoop.speed += 0.2;
            }
        }
        
        // Miss completely (went off screen)
        if(ball.y < -30) {
            resetBall();
        }
    }
    
    drawEntities();
    requestAnimationFrame(gameLoop);
}

function drawEntities() {
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

function drawIdleState() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawEntities();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0,0, canvas.width, canvas.height);
}

function resetBall() {
    ball.isShooting = false;
    ball.y = 350;
    ball.x = 200; // center
}

function gameOver() {
    isPlaying = false;
    clearInterval(gameInterval);
    drawIdleState();
    hoop.speed = 4; // reset difficulty
    
    alert(`🏀 Süre doldu! Toplam Skorunuz: ${score}`);
    
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
