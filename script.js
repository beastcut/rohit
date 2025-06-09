// Firebase config
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

let localStream;
let peer;
let name;
const peers = {};
const videoGrid = document.getElementById("video-grid");

// Ask name and start
window.start = async () => {
  name = document.getElementById("nameInput").value.trim();
  if (!name) return alert("Please enter a name");

  document.getElementById("nameModal").style.display = "none";

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

  const localVideo = createVideoElement(localStream, name);
  videoGrid.appendChild(localVideo);

  peer = new Peer(undefined, {
    host: "peerjs.com",
    secure: true,
    port: 443
  });

  peer.on("open", id => {
    db.ref("video-users/" + id).set({ name });
    db.ref("video-users/" + id).onDisconnect().remove();
  });

  peer.on("call", call => {
    call.answer(localStream);
    call.on("stream", remoteStream => {
      if (!peers[call.peer]) {
        const remoteVideo = createVideoElement(remoteStream, "");
        remoteVideo.id = `video-${call.peer}`;
        videoGrid.appendChild(remoteVideo);

        db.ref("video-users/" + call.peer).once("value", snap => {
          if (snap.exists()) {
            remoteVideo.querySelector("p").textContent = snap.val().name;
          }
        });

        peers[call.peer] = call;
      }
    });
  });

  db.ref("video-users").on("child_added", snap => {
    const userId = snap.key;
    const userName = snap.val().name;

    if (userId !== peer.id) {
      const call = peer.call(userId, localStream);
      call.on("stream", remoteStream => {
        if (!peers[userId]) {
          const remoteVideo = createVideoElement(remoteStream, userName);
          remoteVideo.id = `video-${userId}`;
          videoGrid.appendChild(remoteVideo);
          peers[userId] = call;
        }
      });

      call.on("close", () => {
        const vid = document.getElementById(`video-${userId}`);
        if (vid) vid.remove();
        delete peers[userId];
      });
    }
  });

  db.ref("video-users").on("child_removed", snap => {
    const userId = snap.key;
    const vid = document.getElementById(`video-${userId}`);
    if (vid) vid.remove();
    if (peers[userId]) {
      peers[userId].close();
      delete peers[userId];
    }
  });
};

function createVideoElement(stream, label = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "relative rounded overflow-hidden shadow-lg";

  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.className = "rounded w-full h-64 object-cover";

  const nameTag = document.createElement("p");
  nameTag.textContent = label;
  nameTag.className = "absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-center py-1 text-sm";

  wrapper.appendChild(video);
  wrapper.appendChild(nameTag);
  return wrapper;
}