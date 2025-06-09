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

const videoGrid = document.getElementById('video-grid');
let localStream;
let name = "";
let peer = null;
const peers = {};

function start() {
  name = document.getElementById('name-input').value.trim();
  if (!name) return;

  document.getElementById('name-popup').style.display = 'none';

  navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(stream => {
    localStream = stream;
    addVideoStream("Me", stream, peer?.id);

    peer = new Peer();
    peer.on('open', id => {
      db.ref('video-room').push({ id, name });

      db.ref('video-room').on('child_added', snapshot => {
        const peerData = snapshot.val();
        if (peerData.id !== id) connectToNewUser(peerData.id, stream, peerData.name);
      });
    });

    peer.on('call', call => {
      call.answer(stream);
      call.on('stream', remoteStream => {
        if (!peers[call.peer]) addVideoStream(call.metadata.name, remoteStream, call.peer);
        peers[call.peer] = call;
      });
    });
  });
}

function connectToNewUser(userId, stream, remoteName) {
  const call = peer.call(userId, stream, { metadata: { name } });
  call.on('stream', userVideoStream => {
    if (!peers[userId]) addVideoStream(remoteName, userVideoStream, userId);
  });
  peers[userId] = call;
}

function addVideoStream(userName, stream, id) {
  if (document.getElementById(id)) return;

  const container = document.createElement('div');
  container.id = id;
  container.className = "bg-gray-800 rounded-lg p-2 shadow-md flex flex-col items-center";

  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.className = "rounded-xl w-48 h-32 object-cover";

  const label = document.createElement('div');
  label.className = "mt-2 text-sm text-purple-400 font-semibold";
  label.textContent = userName;

  container.appendChild(video);
  container.appendChild(label);
  videoGrid.appendChild(container);
}
