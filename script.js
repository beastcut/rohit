// ==== Firebase Setup ====
const firebaseConfig = {
  apiKey: "AIzaSyD4Zj1Rm7tlR-kHrLB-Uha5TJHbzZbfeRc",
  authDomain: "videocall-3560d.firebaseapp.com",
  databaseURL: "https://videocall-3560d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "videocall-3560d",
  storageBucket: "videocall-3560d.firebasestorage.app",
  messagingSenderId: "292442129307",
  appId: "1:292442129307:web:d52494cfb431bb01fe173e"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const room = "default-room";

// ==== Variables ====
let localStream;
let peer;
let connections = {};
let username = "";

// ==== Elements ====
const videoGrid = document.getElementById("video-grid");

// ==== Functions ====

function joinCall() {
  username = document.getElementById("usernameInput").value.trim();
  if (!username) return alert("Please enter a name");
  document.getElementById("namePopup").style.display = "none";
  startCall();
}

function startCall() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((stream) => {
    localStream = stream;
    peer = new Peer();

    peer.on("open", (id) => {
      addVideoStream(id, stream, username);
      db.ref(`${room}/users/${id}`).set({ username });
      db.ref(`${room}/users/${id}`).onDisconnect().remove();
    });

    peer.on("call", (call) => {
      call.answer(localStream);
      call.on("stream", (remoteStream) => {
        if (!connections[call.peer]) {
          db.ref(`${room}/users/${call.peer}`).once("value", (snapshot) => {
            const name = snapshot.val()?.username || "Guest";
            addVideoStream(call.peer, remoteStream, name);
          });
          connections[call.peer] = call;
        }
      });
    });

    db.ref(`${room}/users`).on("child_added", (data) => {
      const userId = data.key;
      if (userId !== peer.id && !connections[userId]) {
        const call = peer.call(userId, localStream);
        call.on("stream", (remoteStream) => {
          if (!connections[userId]) {
            addVideoStream(userId, remoteStream, data.val().username);
          }
        });
        connections[userId] = call;
      }
    });

    db.ref(`${room}/users`).on("child_removed", (data) => {
      removeVideo(data.key);
    });
  });
}

function addVideoStream(id, stream, name) {
  const wrapper = document.createElement("div");
  wrapper.className = "relative rounded overflow-hidden shadow-lg";

  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.className = "rounded w-full h-auto";
  if (id === peer?.id) video.muted = true;

  const label = document.createElement("div");
  label.textContent = name;
  label.className = "absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-sm p-1 text-center";

  wrapper.id = `video-${id}`;
  wrapper.appendChild(video);
  wrapper.appendChild(label);
  videoGrid.appendChild(wrapper);
}

function removeVideo(id) {
  const videoWrapper = document.getElementById(`video-${id}`);
  if (videoWrapper) videoWrapper.remove();
  if (connections[id]) {
    connections[id].close();
    delete connections[id];
  }
}

function toggleVideo() {
  const videoTrack = localStream?.getVideoTracks()[0];
  if (videoTrack) videoTrack.enabled = !videoTrack.enabled;
}

function disconnect() {
  db.ref(`${room}/users/${peer.id}`).remove();
  peer.disconnect();
  Object.values(connections).forEach((call) => call.close());
  alert("You have left the call.");
  location.reload();
}
