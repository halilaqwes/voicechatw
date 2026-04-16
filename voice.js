let localStream = null;
let peer = null;
let activeCalls = {}; // Kime bağlandığımızı tutmak için

async function initVoiceChat() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        
        peer = new Peer(currentUser.id, {
            debug: 2
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
            call.answer(localStream); // Çağrıyı kendi mikrofonumuzla cevaplıyoruz
            handleCallEvents(call);
        });

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
    if(call) {
        handleCallEvents(call);
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
    if (window.onUserDisconnected) {
        window.onUserDisconnected(peerId);
    }
}

function toggleMute() {
    if(localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled; // true = ses açık, false = sessizde
    }
    return true;
}

function disconnectVoice() {
    if(peer) peer.destroy();
    if(localStream) {
        localStream.getTracks().forEach(t => t.stop());
    }
    activeCalls = {};
}
