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

const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

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

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
        sendChatMessage(chatInput.value.trim());
        chatInput.value = '';
    }
});

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
        
        // Update my info with Random Avatar
        const myAvatarUrl = `https://api.dicebear.com/8.x/bottts/svg?seed=${user.id}`;
        myAvatar.innerHTML = `<img src="${myAvatarUrl}" width="32" height="32" style="border-radius:50%" />`;
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
    const isMuted = !isUnmuted;

    if(isUnmuted) {
        muteBtn.classList.remove('active');
    } else {
        muteBtn.classList.add('active');
    }
    
    // Kendi ikonumuzu güncelle
    const currentUser = getCurrentUser();
    if(currentUser) {
        updateUserMuteIcon(currentUser.id, isMuted);
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

    const avatarUrl = `https://api.dicebear.com/8.x/bottts/svg?seed=${id}`;
    
    const card = document.createElement('div');
    card.className = 'participant-card';
    card.id = 'participant-' + id;
    
    card.innerHTML = `
        <div class="participant-avatar" id="avatar-${id}" style="background-color: transparent;">
            <img src="${avatarUrl}" width="64" height="64" style="border-radius:50%" />
            <div class="mute-indicator" id="mute-indicator-${id}" style="display:none;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="#da373c"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02 3.28c-.76.54-1.64.91-2.58 1.08v2.14c1.48-.22 2.8-.84 3.88-1.74l-1.3-1.48zM14.98 11.17l-3.3-3.3V5c0-1.66 1.34-3 3-3s3 1.34 3 3v6.17zM4.27 3L3 4.27 l9 9v3.73c-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V22h2v-3.08c1.37-.2 2.63-.76 3.69-1.5l3.04 3.04 1.27-1.27-16.73-16.72z"/></svg>
            </div>
        </div>
        <div class="participant-name">${name} ${isMe ? '(Siz)' : ''}</div>
        ${!isMe ? `<input type="range" class="volume-slider" id="volume-${id}" min="0" max="1" step="0.05" value="1" title="Ses Seviyesi" />` : ''}
    `;
    
    participantsContainer.appendChild(card);

    if(!isMe) {
        const slider = document.getElementById(`volume-${id}`);
        slider.addEventListener('input', (e) => {
            const audioElem = document.getElementById(`audio-${id}`);
            if(audioElem) audioElem.volume = e.target.value;
        });
    }
    
    if(isMe) {
        // Own voice analysis setup (from localStream) when voice.js returns
        setTimeout(() => {
            if(typeof localStream !== 'undefined' && localStream) {
                setupAudioAnalysis(id, localStream);
            }
        }, 2000); // give it time to load local stream
    }
}

// Global olarak çağırılan sessiz durumu
window.updateUserMuteIcon = (id, isMuted) => {
    const indicator = document.getElementById('mute-indicator-' + id);
    if(indicator) {
        indicator.style.display = isMuted ? 'flex' : 'none';
        
        // Susturulduğunda konuşma efekti varsa sil
        if(isMuted) {
            const card = document.getElementById('participant-' + id);
            if(card) card.classList.remove('speaking');
        }
    }
};

// Chat Functions
function sendChatMessage(text) {
    const user = getCurrentUser();
    appendMessageToUI(user.id, user.name, text, true);
    if(window.broadcastChat) {
        window.broadcastChat(text);
    }
}

window.onChatMessageReceived = (senderId, text) => {
    const senderName = getUserNameById(senderId);
    appendMessageToUI(senderId, senderName, text, false);
};

function appendMessageToUI(id, name, text, isMe) {
    const div = document.createElement('div');
    div.className = `chat-message ${isMe ? 'me' : ''}`;
    div.innerHTML = `
        <div class="sender">${name}</div>
        <div class="text">${text}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
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
