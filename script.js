// Ask for name
let userName = localStorage.getItem("userName");
if (!userName) {
  userName = prompt("Enter your name:");
  if (!userName) userName = "Anonymous";
  localStorage.setItem("userName", userName);
}

const firebaseConfig = {
  apiKey: "AIzaSyD4Zj1Rm7tlR-kHrLB-Uha5TJHbzZbfeRc",
  authDomain: "videocall-3560d.firebaseapp.com",
  databaseURL: "https://videocall-3560d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "videocall-3560d",
  storageBucket: "videocall-3560d.firebasestorage.app",
  messagingSenderId: "292442129307",
  appId: "1:292442129307:web:d52494cfb431bb01fe173e"
}

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const roomRef = db.ref("group-room");

// PeerJS setup
const peer = new Peer();
const peers = {};
const videoGrid = document.getElementById("video-grid");

// Get video
navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(stream => {
  addVideoStream(peer.id, stream, userName, true);

  peer.on("call", call => {
    call.answer(stream);
    call.on("stream", remoteStream => {
      if (!peers[call.peer]) {
        addVideoStream(call.peer, remoteStream, call.metadata.name, false);
        peers[call.peer] = call;
      }
    });
  });

  peer.on("open", id => {
    const userRef = roomRef.child(id);
    userRef.set({ name: userName });
    userRef.onDisconnect().remove();

    roomRef.on("value", snapshot => {
      const users = snapshot.val() || {};
      Object.keys(users).forEach(peerId => {
        if (peerId !== id && !peers[peerId]) {
          const otherUser = users[peerId];
          const call = peer.call(peerId, stream, { metadata: { name: userName } });
          call.on("stream", remoteStream => {
            if (!peers[peerId]) {
              addVideoStream(peerId, remoteStream, otherUser.name, false);
              peers[peerId] = call;
            }
          });
        }
      });
    });
  });
});

// Add video
function addVideoStream(peerId, stream, name, isLocal) {
  if (document.getElementById(peerId)) return;

  const videoWrapper = document.createElement("div");
  videoWrapper.classList.add("relative", "rounded", "overflow-hidden", "bg-gray-800", "shadow-lg");
  videoWrapper.id = peerId;

  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.className = "w-full h-auto object-cover rounded";

  if (isLocal) video.muted = true;

  const nameTag = document.createElement("div");
  nameTag.className = "absolute bottom-0 left-0 w-full bg-black bg-opacity-60 text-white text-xs text-center py-1";
  nameTag.innerText = name;

  videoWrapper.appendChild(video);
  videoWrapper.appendChild(nameTag);
  videoGrid.appendChild(videoWrapper);
}
