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

const navChat = document.getElementById('nav-chat');
const navGame = document.getElementById('nav-game');
const viewChat = document.getElementById('view-chat');
const viewGame = document.getElementById('view-game');

let isDeafened = false;
const audioAnalyzers = {}; 

// Event Listeners
if(navChat && navGame) {
    navChat.addEventListener('click', () => {
        navChat.classList.add('active');
        navGame.classList.remove('active');
        viewChat.style.display = 'flex';
        viewGame.style.display = 'none';
    });
    navGame.addEventListener('click', () => {
        navGame.classList.add('active');
        navChat.classList.remove('active');
        viewGame.style.display = 'flex';
        viewChat.style.display = 'none';
    });
}

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

    // Sesleri GainNode üzerinden kısalım
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    for (let id in audioAnalyzers) {
        if (audioAnalyzers[id].gainNode && id !== currentUser?.id) {
            if (isDeafened) {
                audioAnalyzers[id].gainNode.gain.value = 0;
            } else {
                const slider = document.getElementById(`volume-${id}`);
                audioAnalyzers[id].gainNode.gain.value = slider ? parseFloat(slider.value) : 1;
            }
        }
    }

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
        <div class="participant-avatar" id="avatar-${id}" style="background-color: transparent; position: relative;">
            <video id="video-${id}" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; display:none; transform: scaleX(-1); border-radius: 50%; z-index:5;"></video>
            <img src="${avatarUrl}" id="img-${id}" width="64" height="64" style="border-radius:50%; display:block; z-index:1;" />
            <div class="mute-indicator" id="mute-indicator-${id}" style="display:none; z-index:10;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="#da373c"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02 3.28c-.76.54-1.64.91-2.58 1.08v2.14c1.48-.22 2.8-.84 3.88-1.74l-1.3-1.48zM14.98 11.17l-3.3-3.3V5c0-1.66 1.34-3 3-3s3 1.34 3 3v6.17zM4.27 3L3 4.27 l9 9v3.73c-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V22h2v-3.08c1.37-.2 2.63-.76 3.69-1.5l3.04 3.04 1.27-1.27-16.73-16.72z"/></svg>
            </div>
        </div>
        <div class="participant-name">${name} ${isMe ? '(Siz)' : ''}</div>
        ${!isMe ? `<input type="range" class="volume-slider" id="volume-${id}" min="0" max="3" step="0.05" value="1" title="Ses Seviyesi (Max %300)" />` : ''}
    `;
    
    participantsContainer.appendChild(card);

    if(!isMe) {
        const slider = document.getElementById(`volume-${id}`);
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (audioAnalyzers[id] && audioAnalyzers[id].gainNode) {
                audioAnalyzers[id].gainNode.gain.value = isDeafened ? 0 : val;
            } else {
                const audioElem = document.getElementById(`audio-${id}`);
                if(audioElem) audioElem.volume = Math.min(val, 1);
            }
        });

        const videoElem = document.getElementById(`video-${id}`);
        const audioElem = document.getElementById(`audio-${id}`);
        if(videoElem && audioElem && audioElem.srcObject) {
            videoElem.srcObject = audioElem.srcObject;
        }
    }
    
    if(isMe) {
        // We do not rely on localStream here since it could be null.
        // It will be attached by updateLocalVideo callback!
    }
}

// Called directly from voice.js right after camera/mic permission is granted
window.updateLocalVideo = (stream) => {
    const user = getCurrentUser();
    if(user) {
        const videoElem = document.getElementById(`video-${user.id}`);
        if(videoElem) videoElem.srcObject = stream;
        setupAudioAnalysis(user.id, stream);
    }
};

window.updateUserCamIcon = (id, isCamOn) => {
    const video = document.getElementById('video-' + id);
    const img = document.getElementById('img-' + id);
    const card = document.getElementById('participant-' + id);
    if(video && img) {
        if(isCamOn) {
            video.style.display = 'block';
            img.style.display = 'none';
            if(card) card.classList.add('video-active');
        } else {
            video.style.display = 'none';
            img.style.display = 'block';
            if(card) card.classList.remove('video-active');
        }
    }
};

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
        const gainNode = audioCtx.createGain();
        
        let initialVol = 1;
        const slider = document.getElementById(`volume-${id}`);
        if(slider) {
            initialVol = parseFloat(slider.value);
        }
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        gainNode.gain.value = (isDeafened && id !== currentUser?.id) ? 0 : initialVol;

        source.connect(gainNode);
        gainNode.connect(analyser); 
        
        if (id !== currentUser?.id) {
            gainNode.connect(audioCtx.destination);
            
            // Orijinal audio elemanını susturalım (yankı olmaması için)
            const audioElem = document.getElementById(`audio-${id}`);
            if (audioElem) {
                audioElem.muted = true;
            }
        }
        
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
        
        audioAnalyzers[id] = { context: audioCtx, gainNode: gainNode };
    } catch(e) {
        console.warn('Audio Analysis is not supported or failed', e);
    }
}
