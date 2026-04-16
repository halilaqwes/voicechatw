let localStream = null;
let peer = null;
let activeCalls = {}; // Kime bağlandığımızı tutmak için
let dataConnections = {}; // Veri kanalları (Mute durumu aktarımı için)

async function initVoiceChat() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false // Dalgalanmayı (sesin kısılıp açılmasını) önlemek için kapatıldı
            },
            video: {
                width: { ideal: 320 },
                height: { ideal: 240 }
            }
        });
        
        // Başlangıçta kamerayı kapalı tutalım
        if (localStream.getVideoTracks().length > 0) {
            localStream.getVideoTracks()[0].enabled = false;
        }
        
        // Yerel kamera ve mikrofon hazır olduğunda arayüzü tetikle
        if (window.updateLocalVideo) {
            window.updateLocalVideo(localStream);
        }
        
        peer = new Peer(currentUser.id, {
            debug: 2,
            pingInterval: 5000, // Bağlantı kopmalarını önlemek için sık ping
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        peer.on('open', (id) => {
            console.log('PeerJS Sunucusuna Bağlandı. ID: ' + id);
            
            // Diğer tüm kayıtlı kullanıcılara çağrı yapmayı dener (Online iseler anında açarlar)
            const otherIds = getAllUserIds().filter(uid => uid !== currentUser.id);
            otherIds.forEach(targetId => {
                // Biraz bekleterek arayalım ki aynı anda girildiğinde çakışmaları en aza indirelim
                setTimeout(() => callUser(targetId), Math.random() * 1000);
            });
        });

        // Biri bizi aradığında (Diğer kullanıcı sonradan online olursa)
        peer.on('call', (call) => {
            console.log('Gelen çağrı: ' + call.peer);
            call.answer(localStream); // Çağrıyı kendi mikrofonumuz/kameramızla cevaplıyoruz
            handleCallEvents(call);
        });

        // Veri kanalı (Mute durumlarını almak için)
        peer.on('connection', (conn) => {
            handleDataConnection(conn);
        });

        // Hata ayıklama ve kopmaları giderme (Mesh Healing)
        setInterval(() => {
            if (!peer || !peer.open) return;
            const otherIds = getAllUserIds().filter(uid => uid !== currentUser.id);
            otherIds.forEach(targetId => {
                if (!activeCalls[targetId]) {
                    // Bağlantı listesinde yoklarsa tekrar dene
                    callUser(targetId);
                }
            });
        }, 8000); // 8 saniyede bir tarar

        peer.on('error', (err) => {
            console.error('PeerJS Hatası:', err);
            // peer-unavailable hatası karşı tarafın o an offline olduğunu gösterir, görmezden gelebiliriz.
        });

        peer.on('disconnected', () => {
            console.log('PeerJS sunucusuyla bağlantı koptu, tekrar deneniyor...');
            peer.reconnect();
        });

    } catch (err) {
        console.error('Mikrofon erişimi sağlanamadı:', err);
        alert('Sesli sohbete katılmak için mikrofon izni vermeniz gerekmektedir.');
    }
}

function callUser(targetId) {
    if (activeCalls[targetId]) return;
    console.log('Arama yapılıyor: ' + targetId);
    
    // Güvenli arama
    const call = peer.call(targetId, localStream);
    const conn = peer.connect(targetId); // Veri kanalı aç (Mute için)
    
    if(call) {
        handleCallEvents(call);
    }
    if(conn) {
        handleDataConnection(conn);
    }
}

function handleCallEvents(call) {
    const peerId = call.peer;
    
    call.on('stream', (remoteStream) => {
        console.log('Stream alındı: ' + peerId);
        if(!activeCalls[peerId]) {
            activeCalls[peerId] = call;
            // Arayüze kullanıcının sesini ve avatarını ekle
            if (window.onUserConnected) {
                window.onUserConnected(peerId, getUserNameById(peerId), remoteStream);
            }
        }
    });

    call.on('close', () => {
        console.log('Çağrı kapandı: ' + peerId);
        cleanupCall(peerId);
    });
    
    call.on('error', (err) => {
        console.log('Çağrı hatası: ' + peerId, err);
        cleanupCall(peerId);
    });
}

function cleanupCall(peerId) {
    delete activeCalls[peerId];
    if (dataConnections[peerId]) {
        dataConnections[peerId].close();
        delete dataConnections[peerId];
    }
    if (window.onUserDisconnected) {
        window.onUserDisconnected(peerId);
    }
}

function handleDataConnection(conn) {
    if(!conn) return;
    
    conn.on('open', () => {
        dataConnections[conn.peer] = conn;
        // Bağlandığımızda karşı tarafa mikrofonumuzun o anki durumunu bildir
        if(localStream) {
            if(localStream.getAudioTracks().length > 0) {
                const isMuted = !localStream.getAudioTracks()[0].enabled;
                if(isMuted) conn.send({ type: 'MUTE', state: true });
            }
            if(localStream.getVideoTracks().length > 0) {
                const isCamOn = localStream.getVideoTracks()[0].enabled;
                if(isCamOn) conn.send({ type: 'CAM', state: true });
            }
        }
    });

    conn.on('data', (data) => {
        if(!data) return;
        if(data.type === 'MUTE') {
            if(window.updateUserMuteIcon) {
                window.updateUserMuteIcon(conn.peer, data.state);
            }
        }
        else if (data.type === 'CAM') {
            if(window.updateUserCamIcon) {
                window.updateUserCamIcon(conn.peer, data.state);
            }
        }
        else if (data.type === 'CHAT') {
            if(window.onChatMessageReceived) {
                window.onChatMessageReceived(conn.peer, data.text);
            }
        }
        else if (data.type === 'SCORE') {
            if(window.updateLeaderboard) {
                window.updateLeaderboard(data.name, data.score);
            }
        }
    });

    conn.on('close', () => {
        delete dataConnections[conn.peer];
    });
}

function toggleMute() {
    if(localStream && localStream.getAudioTracks().length > 0) {
        const audioTrack = localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        const isMuted = !audioTrack.enabled;
        
        // Diğer herkese mute durumunu bildir
        broadcastMuteState(isMuted);
        
        return audioTrack.enabled; // true = ses açık, false = sessizde
    }
    return true;
}

function toggleCamera() {
    if(localStream && localStream.getVideoTracks().length > 0) {
        const videoTrack = localStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        
        broadcastCamState(videoTrack.enabled);
        
        // Kamera durumunu kendimize göstermek için (Local Video handling in app.js if needed)
        return videoTrack.enabled; // true = kamera açık, false = kapalı
    }
    return false;
}

function broadcastMuteState(isMuted) {
    Object.values(dataConnections).forEach(conn => {
        if(conn && conn.open) {
            conn.send({ type: 'MUTE', state: isMuted });
        }
    });
}

function broadcastCamState(isCamOn) {
    Object.values(dataConnections).forEach(conn => {
        if(conn && conn.open) {
            conn.send({ type: 'CAM', state: isCamOn });
        }
    });
}

window.broadcastChat = function(text) {
    Object.values(dataConnections).forEach(conn => {
        if(conn && conn.open) {
            conn.send({ type: 'CHAT', text: text });
        }
    });
};

window.broadcastScore = function(score) {
    const currentUser = getCurrentUser();
    Object.values(dataConnections).forEach(conn => {
        if(conn && conn.open) {
            conn.send({ type: 'SCORE', score: score, name: currentUser.name });
        }
    });
};

function disconnectVoice() {
    if(peer) peer.destroy();
    if(localStream) {
        localStream.getTracks().forEach(t => t.stop());
    }
    activeCalls = {};
    dataConnections = {};
}
