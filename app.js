import adapter from "webrtc-adapter"
let localStream;
let remoteStream;
let janusConnection;
let janusPlugin;
let myUsername;
let myRoom = 1234; // Example room ID
let remoteFeed = null;

document.getElementById('joinButton').addEventListener('click', joinRoom);
document.getElementById('startButton').addEventListener('click', start);
document.getElementById('callButton').addEventListener('click', call);
document.getElementById('hangupButton').addEventListener('click', hangUp);
document.getElementById('muteButton').addEventListener('click', toggleMute);
document.getElementById('videoButton').addEventListener('click', toggleVideo);

function joinRoom() {
  myUsername = document.getElementById('username').value;
  if (myUsername === "") {
    alert("Please enter a username");
    return;
  }
  document.getElementById('joinScreen').style.display = 'none';
  document.getElementById('videoScreen').style.display = 'block';
  initializeJanus();
}

async function start() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('localVideo').srcObject = localStream;
  janusPlugin.createOffer({
    media: { data: true },
    success: function(jsep) {
      const body = { request: "join", room: myRoom, ptype: "publisher", display: myUsername };
      janusPlugin.send({ message: body, jsep: jsep });
    },
    error: function(error) {
      console.error("WebRTC error:", error);
    }
  });
}

function initializeJanus() {
  Janus.init({
    debug: "all",
    dependencies: Janus.useDefaultDependencies({adapter: adapter}),
    callback: function() {
      janusConnection = new Janus({
        server: 'ws://localhost:8188/',
        success: function() {
          janusConnection.attach({
            plugin: "janus.plugin.videoroom",
            success: function(pluginHandle) {
              janusPlugin = pluginHandle;
              janusPlugin.send({
                message: { request: "create", room: myRoom }
              });
            },
            error: function(error) {
              console.error("Error attaching plugin", error);
            },
            onmessage: function(msg, jsep) {
              let event = msg["videoroom"];
              if (event) {
                if (event === "joined") {
                  let publishers = msg["publishers"];
                  for (let i in publishers) {
                    let id = publishers[i]["id"];
                    let display = publishers[i]["display"];
                    newRemoteFeed(id, display);
                  }
                } else if (event === "event") {
                  // Handle events
                }
              }
              if (jsep) {
                janusPlugin.handleRemoteJsep({ jsep: jsep });
              }
            },
            onlocalstream: function(stream) {
              // Do nothing
            },
            onremotestream: function(stream) {
              let remoteVideo = document.createElement('video');
              remoteVideo.autoplay = true;
              remoteVideo.srcObject = stream;
              document.getElementById('remoteParticipants').appendChild(remoteVideo);
            }
          });
        },
        error: function(error) {
          console.error("Error connecting to Janus", error);
        }
      });
    }
  });
}

function newRemoteFeed(id, display) {
  janusConnection.attach({
    plugin: "janus.plugin.videoroom",
    opaqueId: "remoteFeed" + id,
    success: function(pluginHandle) {
      remoteFeed = pluginHandle;
      let body = { request: "join", room: myRoom, ptype: "subscriber", feed: id };
      remoteFeed.send({ message: body });
    },
    error: function(error) {
      console.error("Error attaching plugin", error);
    },
    onmessage: function(msg, jsep) {
      if (jsep) {
        remoteFeed.createAnswer({
          jsep: jsep,
          media: { audioSend: false, videoSend: false },
          success: function(jsep) {
            let body = { request: "start", room: myRoom };
            remoteFeed.send({ message: body, jsep: jsep });
          },
          error: function(error) {
            console.error("WebRTC error:", error);
          }
        });
      }
    },
    onremotestream: function(stream) {
      let remoteVideo = document.createElement('video');
      remoteVideo.autoplay = true;
      remoteVideo.srcObject = stream;
      document.getElementById('remoteParticipants').appendChild(remoteVideo);
    }
  });
}

function call() {
  // Logic to start a WebRTC call using Janus
}

function hangUp() {
  // Logic to hang up a WebRTC call
}

function toggleMute() {
  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length > 0) {
    audioTracks[0].enabled = !audioTracks[0].enabled;
    document.getElementById('muteButton').textContent = audioTracks[0].enabled ? 'Mute' : 'Unmute';
  }
}

function toggleVideo() {
  const videoTracks = localStream.getVideoTracks();
  if (videoTracks.length > 0) {
    videoTracks[0].enabled = !videoTracks[0].enabled;
    document.getElementById('videoButton').textContent = videoTracks[0].enabled ? 'Video Off' : 'Video On';
  }
}