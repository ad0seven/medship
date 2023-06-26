
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


let allResults = {};

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

let recordingFrames = {};
// var detectorResults = [];
var currentResults = null;
var currentResultImg = null;



console.log("training-global.js loaded");

var framePadding = null;

let recordingRequestId;

//get global unix timestamp (more flexible for data analysis)
let unix_timestamp = new Date().getTime();


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

function checkCompassionDetected(expressions) {
  const compassionExpression = ['innerBrowRaise', 'smile', 'lipPress'];
  let compassionDetected = true;

  for (const expression of compassionExpression) {
  const score = expressions[expression];

  if (score <= 20) {
      compassionDetected = false;
      break;
  }
  }

  return compassionDetected ? 'compassionDetected' : null;
}

function checkWelcomingDetected(expressions) {
  const welcomingExpression = ['cheekRaise', 'smile', 'engagement'];
  let welcomingDetected = true;

  for (const expression of welcomingExpression) {
  const score = expressions[expression];

  if (score <= 30) {
      welcomingDetected = false;
      break;
  }
  }

  return welcomingDetected ? 'welcomingDetected' : null;
}

function checkListeningDetected(expressions) {
    const listeningExpression = ['','eyeWiden', 'smile', 'engagement'];
    let listeningDetected = true;

    for (const expression of listeningExpression) {
    const score = expressions[expression];

    if (score <= 20) {
        listeningDetected = false;
        break;
    }
    }

    return listeningDetected ? 'listeningDetected' : null;
}

var welcoming, listening, compassion;

detector.addEventListener("onImageResultsSuccess", function (faces, image, timestamp) {
  var time_val = timestamp.toFixed(2);

  if (faces.length > 0) {
    currentResults = faces[0];
    currentResultImg = image;

      // Update the expressions and emotions data
      const browFurrow = currentResults.expressions.browFurrow.toFixed(2);
      const browRaise = currentResults.expressions.browRaise.toFixed(2);
      const smile = currentResults.expressions.smile.toFixed(2);
      const innerBrowRaise = currentResults.expressions.innerBrowRaise.toFixed(2);
      const lipPress = currentResults.expressions.lipPress.toFixed(2);
      const cheekRaise = currentResults.expressions.cheekRaise.toFixed(2);
      const eyeWiden = currentResults.expressions.eyeWiden.toFixed(2);
      const engagement = currentResults.emotions.engagement.toFixed(2);
  
      const compassionExpression = {
        innerBrowRaise: innerBrowRaise,
        smile: smile,
        lipPress: lipPress
      };
  
      const welcomingExpression = {
        cheekRaise: cheekRaise,
        smile: smile,
        engagement: engagement
      };
  
      const listeningExpression = {
        browRaise: browRaise,
        eyeWiden: eyeWiden,
        smile: smile,
        engagement: engagement
      };
  
      welcoming = checkWelcomingDetected(welcomingExpression) ? 'Detected' : 'Not Detected';
      listening = checkListeningDetected(listeningExpression) ? 'Detected' : 'Not Detected';
      compassion = checkCompassionDetected(compassionExpression) ? 'Detected' : 'Not Detected';

    // Check if "welcoming" expression is detected
    welcomingExpression = {
      cheekRaise: currentResults.expressions.cheekRaise.toFixed(2),
      smile: currentResults.expressions.smile.toFixed(2),
      engagement: currentResults.emotions.engagement.toFixed(2),
    };

    welcoming = checkWelcomingDetected(welcomingExpression) ? 'Detected' : 'Not Detected';

    // Check if "listening" expression is detected
    listeningExpression = {
      browRaise: currentResults.expressions.browRaise.toFixed(2),
      eyeWiden: currentResults.expressions.eyeWiden.toFixed(2),
      smile: currentResults.expressions.smile.toFixed(2),
      engagement: currentResults.emotions.engagement.toFixed(2),
    };

    listening = checkListeningDetected(listeningExpression) ? 'Detected' : 'Not Detected';

    // Check if "compassion" expression is detected
    compassionExpression = {
      innerBrowRaise: currentResults.expressions.innerBrowRaise.toFixed(2),
      smile: currentResults.expressions.smile.toFixed(2),
      lipPress: currentResults.expressions.lipPress.toFixed(2),
    };

    compassion = checkCompassionDetected(compassionExpression) ? 'Detected' : 'Not Detected'; 
  }
});

detector.addEventListener(
  "onImageResultsSuccess",
  function (faces, image, timestamp) {
    // drawImage(image);
    //$('#results').html("");
    var time_key = "Timestamp";
    var time_val = timestamp.toFixed(2);

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

  let emoji = data.emojis.dominantEmoji;
  const emotionWithHighestScore = getEmotionWithHighestScore(data.emotions);

  console.log(emotionWithHighestScore);

  // Define and initialize the expression objects
  const welcomingExpression = {
    cheekRaise: data.expressions.cheekRaise.toFixed(2),
    smile: data.expressions.smile.toFixed(2),
    engagement: data.emotions.engagement.toFixed(2),
  };

  const listeningExpression = {
    browRaise: data.expressions.browRaise.toFixed(2),
    eyeWiden: data.expressions.eyeWiden.toFixed(2),
    smile: data.expressions.smile.toFixed(2),
    engagement: data.emotions.engagement.toFixed(2),
  };

  const compassionExpression = {
    innerBrowRaise: data.expressions.innerBrowRaise.toFixed(2),
    smile: data.expressions.smile.toFixed(2),
    lipPress: data.expressions.lipPress.toFixed(2),
  };

  // Call the detection functions and assign the results
  welcoming = checkWelcomingDetected(welcomingExpression) ? 'Detected' : 'Not Detected';
  listening = checkListeningDetected(listeningExpression) ? 'Detected' : 'Not Detected';
  compassion = checkCompassionDetected(compassionExpression) ? 'Detected' : 'Not Detected';

  const text = `Compassionate: ${compassion}\nWelcoming: ${welcoming}\nListening: ${listening}\nDominant Emoji: ${emoji}`;

  // const dataColumns = ['timestamp', 'compassion', 'welcoming', 'listening'];

  //for (const columnName of dataColumns) {
  // if (data.expressions.hasOwnProperty(columnName)) {
  //    let dataCol = data.expressions[columnName].toFixed(2);

 //     const name = convertCamelCaseToSpaces(columnName);

   //   text += `\n${name}: ${dataCol}`;
   // }
 // }

  contxt.font = "20px Arial";
  contxt.fillStyle = "white";

  contxt.lineWidth = 2; // Width of the border line
  contxt.fillStyle = "white"; // Color of the text
  contxt.strokeStyle = "black"; // Color of the border

  for (let i = 0; i < text.split("\n").length; i++) {
    contxt.strokeText(text.split("\n")[i], 10, 20 + i * 20);
    contxt.fillText(text.split("\n")[i], 10, 20 + i * 20);
  }
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
  if (startedUp && detectorInit && currentResults) {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    drawCtx.drawImage(
      video,
      0,
      0,
      video.videoWidth,
      video.videoHeight,
      0,
      0,
      drawCanvas.width,
      drawCanvas.height
    );

    drawVideoMaintainingAspectRatio(video, drawCanvas);

    drawAffdexStats(currentResultImg, currentResults);

    let dataFrame = drawCanvas.toDataURL();
    recordingFrames[dataFrame] = dataFrame;

    const unixTimestamp = Date.now();
    console.log(unixTimestamp);


  // Update the detection results based on the expressions
  const compassionExpression = {
    innerBrowRaise: currentResults.expressions.innerBrowRaise.toFixed(2),
    smile: currentResults.expressions.smile.toFixed(2),
    lipPress: currentResults.expressions.lipPress.toFixed(2)
  };
  const welcomingExpression = {
    cheekRaise: currentResults.expressions.cheekRaise.toFixed(2),
    smile: currentResults.expressions.smile.toFixed(2),
    engagement: currentResults.emotions.engagement.toFixed(2)
  };
  const listeningExpression = {
    browRaise: currentResults.expressions.browRaise.toFixed(2),
    eyeWiden: currentResults.expressions.eyeWiden.toFixed(2),
    smile: currentResults.expressions.smile.toFixed(2),
    engagement: currentResults.emotions.engagement.toFixed(2)
  };

  // Update the welcoming, listening, and compassion variables based on detection results
  const welcomingDetected = checkWelcomingDetected(welcomingExpression);
  const listeningDetected = checkListeningDetected(listeningExpression);
  const compassionDetected = checkCompassionDetected(compassionExpression);

    // Store the detection results in the allResults object
    const frameData = {
      timestamp: unixTimestamp,
      frame: dataFrame,
      results: {
        compassion: compassionDetected ? 'Detected' : 'Not Detected',
        welcoming: welcomingDetected ? 'Detected' : 'Not Detected',
        listening: listeningDetected ? 'Detected' : 'Not Detected'
      }
    };
  
    allResults[unixTimestamp] = frameData;
  }
}


function saveResults() {
  detected_values = []
  document.getElementById("canvas-text").innerText = "Loading...";

  clearInterval(detectorInterval);
  stopRecordingFrames();
  detector.stop();
  startedUp = false;
  detectorInit = false;
  video.pause();
  video.srcObject = null;
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

  const frameData = Object.entries(allResults);

  fetch("/create-video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ frame_data: frameData }),
  })
  .then((response) => response.json())
  .then((data) => {
    console.log("video generation response: ", data);
    let fileName = data.filename;
    let frameData = data.frame_data;

    localStorage.setItem("filename", fileName);
    localStorage.setItem("results", JSON.stringify(frameData)); // Stringify the frameData object before storing it

    enableButton();
    document.getElementById("canvas-text").innerText = "Done! ";
  });

  console.log("allResults", allResults);
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


function getEmotionWithHighestScore(emotions) {
  let maxEmotion = null;
  let maxScore = Number.NEGATIVE_INFINITY;

  for (const emotion in emotions) {
    const score = emotions[emotion];

    if (score > maxScore) {
      maxScore = score;
      maxEmotion = emotion;
    }
  }

  return maxEmotion;
}


function updateStats(data, timestamp) {
  let newDataRow = [];
  newDataRow.push(timestamp);

  for (const columnName of dataColumns) {
    if (data.expressions.hasOwnProperty(columnName)) {
      let dataCol = data.expressions[columnName].toFixed(2);
      newDataRow.push(dataCol);
    }
  }
  if (verbose) {
    console.log(`New data row: ${newDataRow}`);
  }
  recordedData.push(newDataRow);
}



function convertCamelCaseToSpaces(str) {
  // Use regular expressions to find uppercase letters preceded by a lowercase letter
  // and insert a space before them
  return (
    str
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // Replace all uppercase letters with lowercase letters
      .toLowerCase()
  );
}

//================================================================================================
//======================================= OLD CODE ================================================

function enableButton() {
  nextButton.style.display = "inline";
}
