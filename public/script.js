// Firebase config — REPLACE WITH YOURS
const firebaseConfig = {
  apiKey: "AIzaSyBbSZ1cFjCU4gbE8vktUdjc5vuevkD07S4",
  authDomain: "videochat-80e75.firebaseapp.com",
  projectId: "videochat-80e75",
  storageBucket: "videochat-80e75.firebasestorage.app",
  messagingSenderId: "375111220632",
  appId: "1:375111220632:web:d71f495f6d4246aeb63fed"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const roomId = "main-room";
let peerConnections = {};
let localStream;
let name = "";

const startScreen = document.getElementById("start-screen");
const joinBtn = document.getElementById("join");
const nameInput = document.getElementById("name");

const videoChat = document.getElementById("video-chat");
const videosDiv = document.getElementById("videos");
const toggleVideoBtn = document.getElementById("toggle-video");
const toggleAudioBtn = document.getElementById("toggle-audio");
const screenShareBtn = document.getElementById("screen-share");
const disconnectBtn = document.getElementById("disconnect");

joinBtn.onclick = async () => {
  name = nameInput.value.trim();
  if (!name) return alert("Enter your name");

  startScreen.hidden = true;
  videoChat.hidden = false;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const localVideo = document.createElement("video");
  localVideo.srcObject = localStream;
  localVideo.autoplay = true;
  localVideo.muted = true;
  localVideo.playsInline = true;
  videosDiv.appendChild(localVideo);

  const myRef = db.collection("rooms").doc(roomId).collection("participants").doc(name);
  await myRef.set({ joined: firebase.firestore.FieldValue.serverTimestamp() });

  db.collection("rooms").doc(roomId).collection("participants").onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      const user = change.doc.id;
      if (user === name) return;

      if (change.type === "added" && !peerConnections[user]) {
        await createConnection(user, true);
      }
    });
  });

  db.collection("rooms").doc(roomId).collection("signals").onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      const data = change.doc.data();
      const from = data.from;
      const to = data.to;

      if (to !== name || from === name) return;

      if (data.type === "offer") {
        await createConnection(from, false);
        await peerConnections[from].setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await peerConnections[from].createAnswer();
        await peerConnections[from].setLocalDescription(answer);
        sendSignal(from, {
          type: "answer",
          sdp: answer
        });
      } else if (data.type === "answer") {
        await peerConnections[from].setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === "ice") {
        await peerConnections[from].addIceCandidate(new RTCIceCandidate(data.ice));
      }
    });
  });
};

async function createConnection(remoteName, isInitiator) {
  const pc = new RTCPeerConnection();
  peerConnections[remoteName] = pc;

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = event => {
    let remoteVideo = document.getElementById("video-" + remoteName);
    if (!remoteVideo) {
      remoteVideo = document.createElement("video");
      remoteVideo.id = "video-" + remoteName;
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      remoteVideo.srcObject = new MediaStream();
      videosDiv.appendChild(remoteVideo);
    }

    event.streams[0].getTracks().forEach(track => {
      remoteVideo.srcObject.addTrack(track);
    });
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      sendSignal(remoteName, {
        type: "ice",
        ice: event.candidate
      });
    }
  };

  if (isInitiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(remoteName, {
      type: "offer",
      sdp: offer
    });
  }
}

function sendSignal(to, data) {
  db.collection("rooms").doc(roomId).collection("signals").add({
    from: name,
    to,
    ...data,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// UI Controls
toggleVideoBtn.onclick = () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  toggleVideoBtn.textContent = videoTrack.enabled ? "📷 Video" : "📷 Off";
};

toggleAudioBtn.onclick = () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  toggleAudioBtn.textContent = audioTrack.enabled ? "🎤 Mute" : "🔇 Unmute";
};

screenShareBtn.onclick = async () => {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  const screenTrack = screenStream.getVideoTracks()[0];

  for (let pc of Object.values(peerConnections)) {
    const sender = pc.getSenders().find(s => s.track.kind === "video");
    sender.replaceTrack(screenTrack);
  }

  screenTrack.onended = () => {
    const videoTrack = localStream.getVideoTracks()[0];
    for (let pc of Object.values(peerConnections)) {
      const sender = pc.getSenders().find(s => s.track.kind === "video");
      sender.replaceTrack(videoTrack);
    }
  };
};

disconnectBtn.onclick = async () => {
  for (let pc of Object.values(peerConnections)) pc.close();
  peerConnections = {};
  location.reload();
};
