// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBbSZ1cFjCU4gbE8vktUdjc5vuevkD07S4",
  authDomain: "videochat-80e75.firebaseapp.com",
  projectId: "videochat-80e75",
  storageBucket: "videochat-80e75.firebasestorage.app",
  messagingSenderId: "375111220632",
  appId: "1:375111220632:web:d71f495f6d4246aeb63fed"
};

firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();

// Variables
let localStream, screenStream;
let localUserId, myName;
let roomId = "main-room";
let peerConnections = {};
let screenSharing = false;

// UI Elements
const videoGrid = document.getElementById("videoGrid");
const btnJoin = document.getElementById("btnJoin");
const inputName = document.getElementById("inputName");
const btnCamera = document.getElementById("btnCamera");
const btnMic = document.getElementById("btnMic");
const btnScreenShare = document.getElementById("btnScreenShare");
const btnDisconnect = document.getElementById("btnDisconnect");

// ICE Config
const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

btnJoin.onclick = async () => {
  myName = inputName.value.trim();
  if (!myName) return alert("Please enter your name");

  localUserId = Date.now().toString();
  document.getElementById("nameModal").style.display = "none";

  await startLocalStream();

  const roomRef = firestore.collection("rooms").doc(roomId);
  await roomRef.collection("peers").doc(localUserId).set({ name: myName });

  setupFirestoreListeners();

  const peersSnapshot = await roomRef.collection("peers").get();
  peersSnapshot.forEach(doc => {
    const peerId = doc.id;
    if (peerId !== localUserId) {
      createPeerConnection(peerId, doc.data().name, true);
    }
  });

  [btnCamera, btnMic, btnScreenShare, btnDisconnect].forEach(btn => btn.disabled = false);
};

async function startLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const localVideo = createVideoBlock(localStream, localUserId, myName);
  videoGrid.appendChild(localVideo);
}

function createVideoBlock(stream, id, name) {
  const container = document.createElement("div");
  container.className = "relative";

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;
  video.className = "w-full rounded-lg border border-gray-300";
  container.appendChild(video);

  const label = document.createElement("div");
  label.textContent = name || "Unknown";
  label.className = "absolute bottom-0 bg-black bg-opacity-60 text-white text-sm px-2 py-1 rounded-t w-full text-center";
  container.appendChild(label);

  container.id = `user-${id}`;
  return container;
}

function setupFirestoreListeners() {
  const candidatesRef = firestore.collection("rooms").doc(roomId).collection("candidates");

  candidatesRef.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === "added") {
        const data = change.doc.data();
        if (data.to === localUserId) {
          const pc = getOrCreatePeerConnection(data.from, data.name);
          if (data.candidate?.type) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.candidate));
            if (data.candidate.type === "offer") {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              candidatesRef.add({
                from: localUserId,
                to: data.from,
                candidate: answer,
                name: myName
              });
            }
          } else {
            pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        }
      }
    });
  });

  firestore.collection("rooms").doc(roomId).collection("peers")
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        const peerId = change.doc.id;
        if (peerId === localUserId) return;

        if (change.type === "added") {
          const name = change.doc.data().name;
          if (!peerConnections[peerId]) {
            createPeerConnection(peerId, name, true);
          }
        } else if (change.type === "removed") {
          removePeer(peerId);
        }
      });
    });
}

function getOrCreatePeerConnection(peerId, name) {
  if (peerConnections[peerId]) return peerConnections[peerId];

  const pc = new RTCPeerConnection(configuration);
  peerConnections[peerId] = pc;

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = (e) => {
    let container = document.getElementById(`user-${peerId}`);
    if (!container) {
      container = createVideoBlock(e.streams[0], peerId, name);
      videoGrid.appendChild(container);
    } else {
      const video = container.querySelector("video");
      video.srcObject = e.streams[0];
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      firestore.collection("rooms").doc(roomId).collection("candidates").add({
        from: localUserId,
        to: peerId,
        candidate: event.candidate.toJSON(),
        name: myName
      });
    }
  };

  return pc;
}

async function createPeerConnection(peerId, name, isCaller) {
  const pc = getOrCreatePeerConnection(peerId, name);
  if (isCaller) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    firestore.collection("rooms").doc(roomId).collection("candidates").add({
      from: localUserId,
      to: peerId,
      candidate: offer,
      name: myName
    });
  }
}

function removePeer(peerId) {
  const container = document.getElementById(`user-${peerId}`);
  if (container) container.remove();

  if (peerConnections[peerId]) {
    peerConnections[peerId].close();
    delete peerConnections[peerId];
  }
}

// Controls
btnCamera.onclick = () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  btnCamera.textContent = videoTrack.enabled ? "Turn Camera Off" : "Turn Camera On";
};

btnMic.onclick = () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  btnMic.textContent = audioTrack.enabled ? "Mute" : "Unmute";
};

btnScreenShare.onclick = async () => {
  if (screenSharing) return;

  screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  screenSharing = true;

  const screenTrack = screenStream.getVideoTracks()[0];
  Object.values(peerConnections).forEach(pc => {
    const sender = pc.getSenders().find(s => s.track.kind === "video");
    sender.replaceTrack(screenTrack);
  });

  const localVideo = document.querySelector(`#user-${localUserId} video`);
  localVideo.srcObject = screenStream;

  screenTrack.onended = () => {
    Object.values(peerConnections).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track.kind === "video");
      sender.replaceTrack(localStream.getVideoTracks()[0]);
    });
    localVideo.srcObject = localStream;
    screenSharing = false;
  };
};

btnDisconnect.onclick = async () => {
  const roomRef = firestore.collection("rooms").doc(roomId);
  await roomRef.collection("peers").doc(localUserId).delete();

  localStream.getTracks().forEach(t => t.stop());
  Object.values(peerConnections).forEach(pc => pc.close());
  peerConnections = {};
  location.reload();
};
