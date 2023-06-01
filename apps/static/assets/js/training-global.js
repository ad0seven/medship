/*
strategy for the training page
same as the practice
- start camera
- start detector
- draw the results into the canvas, but somehow make it so that only the video is visible
- now, record the canvas at 30 fps
- when the user clicks the button, stop recording, stop the detector, stop the camera
- send the frames to the server
- generate the mp4
- save to bucket
- gather it in the other page
*/

let parents = document.getElementById("parents");
let streamParent = document.getElementById("streamParent");
let video = document.getElementById("stream");
let vidParent = document.getElementById("vidParent");
let vid = document.getElementById("vid");
let recordingTimeMS = 8000;
let startButton = document.getElementById("startRecord");
let saveButton = document.getElementById("save");
let nextButton = document.getElementById("next");
let filename = null;
let results = null;
let savingText = document.getElementById("saving");
var drawCanvas = document.getElementById("drawCanvas");
var drawCtx = drawCanvas.getContext("2d");

var captureCanvas = document.getElementById("captureCanvas");
var captureCtx = captureCanvas.getContext("2d");

var verbose = true;

//================================================================================================
// detector and recording stuff

const RECORDING_FPS = 24;
const ANALYSIS_INTERVAL = 100;

var detectorInit = false;
var startedUp = false;
var detectorInterval = null;
var recordingInterval = null;

var secs = 0;

var recordingFrames = [];
// var detectorResults = [];
var currentResults = null;
var currentResultImg = null;

var allResults = {};

console.log("training-global.js loaded");

var framePadding = null;

let recordingRequestId;

/*
anger
contempt
disgust
engagement
fear
joy
sadness
surprise
valence
*/

// warm up the detector
var faceMode = affdex.FaceDetectorMode.LARGE_FACES;
var detector = new affdex.FrameDetector(faceMode);

detector.detectAllEmotions();
detector.detectAllExpressions();
detector.detectAllEmojis();
detector.detectAllAppearance();
saveButton.style.display = "none";

window.onload = function () {
  let videoWidth = parseFloat(getComputedStyle(video).width);
  let videoHeight = parseFloat(getComputedStyle(video).height);

  console.log(`video dimensions ${videoWidth} ${videoHeight}`);

  // setting up the canvases
  for (const element of [drawCanvas, captureCanvas]) {
    element.width = videoWidth;
    element.height = videoHeight;
  }
  //   console.log("set the stream width length");
};

function startListener() {
  document.getElementById("canvas-text").innerText = "Loading...";
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then((stream) => {
      video.autoPlay = true;
      video.srcObject = stream;
      vid.play();
      document.getElementById("canvas-text").innerText = "";

      // start the detector
      detector.start();
      startedUp = true;

      saveButton.style.display = "inline-block";

      detectorInterval = setInterval(grab, ANALYSIS_INTERVAL);

      // start the 30 fps recorder
      //   recordingInterval = setInterval(recordFrame, 1000 / RECORDING_FPS);
      startRecordingFrames(RECORDING_FPS);

      //instead of recording video directly, take a screenshot every 33ms
    });
}

function grab() {
  //   captureCtx.drawImage(
  //     video,
  //     0,
  //     0,
  //     video.videoWidth,
  //     video.videoHeight,
  //     0,
  //     0,
  //     captureCanvas.width,
  //     captureCanvas.height
  //   );

  drawVideoMaintainingAspectRatio(video, captureCanvas);

  if (detector && detector.isRunning && detectorInit) {
    detector.process(
      captureCtx.getImageData(0, 0, captureCanvas.width, captureCanvas.height),
      secs
    );
  }

  secs += ANALYSIS_INTERVAL / 1000;
}

detector.addEventListener("onInitializeSuccess", function () {
  // console.log('detector initialized');
  detectorInit = true;
});

detector.addEventListener(
  "onImageResultsSuccess",
  function (faces, image, timestamp) {
    // drawImage(image);
    //$('#results').html("");
    var time_key = "Timestamp";
    var time_val = timestamp.toFixed(2);

    //get global unix timestamp (more flexible for data analysis)
    let unix_timestamp = new Date().getTime();

    if (verbose) {
      console.log("#results", "Timestamp: " + timestamp.toFixed(2));
      console.log("#results", "Number of faces found: " + faces.length);
      console.log("Number of faces found: " + faces.length);
    }
    if (faces.length > 0) {
      if (verbose) {
        console.log("\nFACES RESULT");
        console.log(faces);
      }

      //   updateStats(faces[0], unix_timestamp);

      if (startedUp) {
        // drawAffdexStats(image, faces[0]);
        currentResults = faces[0];
        currentResultImg = image;
      }
    } else {
      // If face is not detected skip entry.
      console.log("Cannot find face, skipping entry");
    }
  }
);

//Draw the detected facial feature points on the image
function drawAffdexStats(img, data) {
  let featurePoints = data.featurePoints;
  var contxt = document.getElementById("drawCanvas").getContext("2d");

  //   contxt.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

  var hRatio = contxt.canvas.width / img.width;
  var vRatio = contxt.canvas.height / img.height;

  padding = parseInt(getComputedStyle(drawCanvas).padding);

  var ratio = Math.min(hRatio, vRatio);

  contxt.strokeStyle = "#FFFFFF";

  for (var id in featurePoints) {
    contxt.beginPath();
    contxt.arc(featurePoints[id].x, featurePoints[id].y, 2, 0, 2 * Math.PI);
    contxt.stroke();
  }

  //   let emoji = data.emojis.dominantEmoji;
  //   const emotionWithHighestScore = getEmotionWithHighestScore(data.emotions);

  //   console.log(emotionWithHighestScore);
  //   let text = `dominant emoji: ${emoji}\nemotion: ${emotionWithHighestScore}`;

  //   for (const columnName of dataColumns) {
  //     if (data.expressions.hasOwnProperty(columnName)) {
  //       let dataCol = data.expressions[columnName].toFixed(2);

  //       const name = convertCamelCaseToSpaces(columnName);

  //       text += `\n${name}: ${dataCol}`;
  //     }
  //   }

  //   contxt.font = "16px Arial";
  //   contxt.fillStyle = "white";

  //   contxt.lineWidth = 2; // Width of the border line
  //   contxt.fillStyle = "white"; // Color of the text
  //   contxt.strokeStyle = "black"; // Color of the border

  //   for (let i = 0; i < text.split("\n").length; i++) {
  //     contxt.strokeText(text.split("\n")[i], 10, 20 + i * 20);
  //     contxt.fillText(text.split("\n")[i], 10, 20 + i * 20);
  //   }
}

function startRecordingFrames(fps) {
  let lastFrameTime = 0;
  let interval = 1000 / fps; // Interval for FPS

  function callback(currentTime) {
    recordingRequestId = requestAnimationFrame(callback);
    let deltaTime = currentTime - lastFrameTime;

    if (deltaTime >= interval) {
      // The deltaTime is at least our desired interval, so execute the code

      recordFrame();

      lastFrameTime = currentTime - (deltaTime % interval); // set lastFrameTime to the current time adjusted by the leftover time not used in this frame
    }
  }

  recordingRequestId = requestAnimationFrame(callback);
}

function stopRecordingFrames() {
  if (recordingRequestId) {
    cancelAnimationFrame(recordingRequestId);
    recordingRequestId = null;
  }
}

function recordFrame() {
  //instead of drawing the points each detector update,
  // store the points in a variable,
  //draw the video 30/24 times a second with whatever the current results are
  //and then draw the points on top of the video

  if (startedUp && detectorInit && currentResults) {
    //draw the video in the drawCanvas
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    // drawCtx.drawImage(
    //   video,
    //   0,
    //   0,
    //   video.videoWidth,
    //   video.videoHeight,
    //   0,
    //   0,
    //   drawCanvas.width,
    //   drawCanvas.height
    // );

    drawVideoMaintainingAspectRatio(video, drawCanvas);

    drawAffdexStats(currentResultImg, currentResults);

    let dataFrame = drawCanvas.toDataURL();
    // recordingFrames.push(dataFrame);

    const unixTimestamp = Date.now();
    console.log(unixTimestamp);

    allResults[unixTimestamp] = { frame: dataFrame, results: currentResults };
  }
}

function saveResults() {
  document.getElementById("canvas-text").innerText = "Loading...";

  clearInterval(detectorInterval);
  //   clearInterval(recordingInterval);
  stopRecordingFrames();
  detector.stop();
  startedUp = false;
  detectorInit = false;
  video.pause();
  video.srcObject = null;
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

  fetch("/create-video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ frame_data: allResults }),
  })
    // .then((response) => response.blob()) // convert the response to a blob
    // .then((blob) => {
    //   // Create an object URL for the blob
    //   let url = window.URL.createObjectURL(blob);
    //   let a = document.createElement("a");
    //   a.href = url;
    //   a.download = "output.mp4";
    //   document.body.appendChild(a); // we need to append the element to the dom -> otherwise it will not work in firefox
    //   a.click();
    //   a.remove(); //afterwards we remove the element again
    // });
    .then((response) => response.json())
    .then((data) => {
      console.log("video generation response: ", data);
      let fileName = data.filename;
      let frameData = data.frame_data;

      localStorage.setItem("filename", fileName);
      localStorage.setItem("results", frameData);
      enableButton();
      document.getElementById("canvas-text").innerText = "Done! ";
    });

  allResults = {};
}

function drawVideoMaintainingAspectRatio(video, canvas) {
  let context = canvas.getContext("2d");
  let videoRatio = video.videoWidth / video.videoHeight;
  let canvasRatio = canvas.width / canvas.height;

  let drawWidth;
  let drawHeight;

  if (videoRatio > canvasRatio) {
    drawWidth = canvas.width;
    drawHeight = drawWidth / videoRatio;
  } else {
    drawHeight = canvas.height;
    drawWidth = drawHeight * videoRatio;
  }

  let left = (canvas.width - drawWidth) / 2;
  let top = (canvas.height - drawHeight) / 2;

  context.clearRect(0, 0, canvas.width, canvas.height);

  context.drawImage(
    video,
    0,
    0,
    video.videoWidth,
    video.videoHeight,
    left,
    top,
    drawWidth,
    drawHeight
  );
}

//================================================================================================
//======================================= OLD CODE ================================================

function enableButton() {
  nextButton.style.display = "inline";
}

function wait(delayInMS) {
  return new Promise((resolve) => setTimeout(resolve, delayInMS));
}

function startRecording(stream, lengthInMS) {
  let recorder = new MediaRecorder(stream);
  let data = [];

  recorder.ondataavailable = (event) => data.push(event.data);
  recorder.start();
  vid.play();

  let stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = (event) => reject(event.name);
  });

  let recorded = wait(lengthInMS).then(
    () => recorder.state == "recording" && recorder.stop()
  );

  return Promise.all([stopped, recorded]).then(() => data);
}

function stop(stream) {
  stream.getTracks().forEach((track) => track.stop());
}

function getfilename() {
  localStorage.setItem("filename", filename);
  localStorage.setItem("results", results);
  enableButton();
}

function upload_video(blob) {
  var fd = new FormData();
  fd.append("vid_file", blob);
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/ml_upload_vid", true);
  xhr.onload = function () {
    if (this.status == 200) {
      objects = JSON.parse(this.response);
      filename = objects[0].fn;
      results = objects[0].results;
    }
  };
  xhr.send(fd);
}
