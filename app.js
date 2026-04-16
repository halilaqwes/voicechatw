// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginBtn = document.getElementById('login-btn');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');

const participantsContainer = document.getElementById('participants-container');
const audioContainer = document.getElementById('audio-container');
const myAvatar = document.getElementById('my-avatar');
const myName = document.getElementById('my-name');
const muteBtn = document.getElementById('mute-btn');
const deafenBtn = document.getElementById('deafen-btn');
const logoutBtn = document.getElementById('logout-btn');

let isDeafened = false;
const audioAnalyzers = {}; 

// Event Listeners
loginBtn.addEventListener('click', () => handleLogin(passwordInput.value.trim()));
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin(passwordInput.value.trim());
});
muteBtn.addEventListener('click', handleMuteToggle);
deafenBtn.addEventListener('click', handleDeafenToggle);
logoutBtn.addEventListener('click', handleLogout);

// Auto-login check on load
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('voiceChatToken');
    if (savedToken) {
        passwordInput.value = savedToken;
        handleLogin(savedToken);
    }
});

function handleLogin(password) {
    if (login(password)) {
        // Save to local storage for future visits
        localStorage.setItem('voiceChatToken', password);
        // Successful login
        const user = getCurrentUser();
        
        loginScreen.style.display = 'none';
        chatScreen.style.display = 'flex';
        
        // Update my info
        const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        myAvatar.textContent = initials;
        myName.textContent = user.name;
        
        // Own participant card
        createParticipantCard(user.id, user.name, true);

        // Start Voice System
        initVoiceChat();
    } else {
        loginError.style.display = 'block';
    }
}

function handleMuteToggle() {
    const isUnmuted = toggleMute();
    if(isUnmuted) {
        muteBtn.classList.remove('active');
    } else {
        muteBtn.classList.add('active');
    }
}

function handleDeafenToggle() {
    isDeafened = !isDeafened;
    
    // Toggle mute all audio elements in DOM
    const audioItems = audioContainer.querySelectorAll('audio');
    audioItems.forEach(audio => {
        audio.muted = isDeafened;
    });

    if(isDeafened) {
        deafenBtn.classList.add('active');
    } else {
        deafenBtn.classList.remove('active');
    }
}

function handleLogout() {
    localStorage.removeItem('voiceChatToken');
    disconnectVoice();
    
    // Reset UI
    chatScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
    passwordInput.value = '';
    
    // Clear participants list
    participantsContainer.innerHTML = '';
    audioContainer.innerHTML = '';
    
    // Reset buttons
    isDeafened = false;
    deafenBtn.classList.remove('active');
    muteBtn.classList.remove('active');
}

// Called directly from voice.js when a peer joins
window.onUserConnected = (peerId, name, remoteStream) => {
    console.log(name + " odaya katıldı.");
    
    // Create Audio element
    let audioElement = document.getElementById('audio-' + peerId);
    if (!audioElement) {
        audioElement = document.createElement('audio');
        audioElement.id = 'audio-' + peerId;
        audioElement.autoplay = true;
        
        // If current user deafened, mute the new element
        audioElement.muted = isDeafened;
        audioContainer.appendChild(audioElement);
    }
    
    audioElement.srcObject = remoteStream;

    // Create participant UI card
    createParticipantCard(peerId, name, false);
    
    // Analyze audio for speaking animation
    setupAudioAnalysis(peerId, remoteStream);
};

// Called directly from voice.js when a peer leaves
window.onUserDisconnected = (peerId) => {
    console.log(peerId + " odadan ayrıldı.");
    
    // Remove from UI
    const card = document.getElementById('participant-' + peerId);
    if (card) card.remove();
    
    const audio = document.getElementById('audio-' + peerId);
    if (audio) audio.remove();
    
    if (audioAnalyzers[peerId]) {
        audioAnalyzers[peerId].interval && clearInterval(audioAnalyzers[peerId].interval);
        audioAnalyzers[peerId].context && audioAnalyzers[peerId].context.close();
        delete audioAnalyzers[peerId];
    }
};

function createParticipantCard(id, name, isMe) {
    // Avoid duplicates
    if(document.getElementById('participant-' + id)) return;

    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2);
    
    const card = document.createElement('div');
    card.className = 'participant-card';
    card.id = 'participant-' + id;
    
    card.innerHTML = `
        <div class="participant-avatar" id="avatar-${id}">${initials}</div>
        <div class="participant-name">${name} ${isMe ? '(Siz)' : ''}</div>
    `;
    
    participantsContainer.appendChild(card);
    
    if(isMe) {
        // Own voice analysis setup (from localStream) when voice.js returns
        setTimeout(() => {
            if(typeof localStream !== 'undefined' && localStream) {
                setupAudioAnalysis(id, localStream);
            }
        }, 2000); // give it time to load local stream
    }
}

// Light-weight speaking detection using AudioContext
function setupAudioAnalysis(id, stream) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.minDecibels = -60; 
        
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser); // We don't connect to destination to avoid echo
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const cardRef = document.getElementById('participant-' + id);
        
        const checkVolume = () => {
            if (!document.getElementById('participant-' + id)) {
                audioCtx.close();
                return;
            }
            
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            
            // threshold for "speaking"
            if (avg > 15 && (!isDeafened || id === getCurrentUser().id)) { 
                cardRef.classList.add('speaking');
            } else {
                cardRef.classList.remove('speaking');
            }
            
            requestAnimationFrame(checkVolume);
        };
        
        requestAnimationFrame(checkVolume);
        
        audioAnalyzers[id] = { context: audioCtx };
    } catch(e) {
        console.warn('Audio Analysis is not supported or failed', e);
    }
}
