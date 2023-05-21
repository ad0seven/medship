let video = null;
let streamRef = null;
let adjustedCanvas = false;
let drawCanvas = null;
let drawCtx = null;
let captureCanvas = null;
let captureCtx = null;
let timeInterval = null;
let startedup = null;
let constraints = null;
let analytics = {
    "angry": 0,
    "disgust": 0,
    "fear": 0,
    "happy": 0,
    "sad": 0,
    "surprise": 0,
    "neutral": 0,
}

const verbose = true;
var secs = 0;

const ANALYSIS_INTERVAL = 100


// Decide whether your video has large or small face
// var faceMode = affdex.FaceDetectorMode.SMALL_FACES;
var faceMode = affdex.FaceDetectorMode.LARGE_FACES;

// Decide which detector to use photo or stream
// var detector = new affdex.PhotoDetector(faceMode);
var detector = new affdex.FrameDetector(faceMode);

// Initialize Emotion and Expression detectors
detector.detectAllEmotions();
detector.detectAllExpressions();
detector.detectAllEmojis();
detector.detectAllAppearance();

function startup() {
if (!startedup) {
    detector.start()
    startCamera();
    drawCanvas.width = drawCanvas.width;
    drawCanvas.width = video.videoWidth || drawCanvas.width;
    drawCanvas.height = video.videoHeight || drawCanvas.height;
    captureCanvas.width = video.videoWidth || captureCanvas.width;
    captureCanvas.height = video.videoHeight || captureCanvas.height;
    // drawCtx.lineWidth = "5";
    // drawCtx.strokeStyle = "blue";
    // drawCtx.font = "20px Verdana";
    // drawCtx.fillStyle = "red";
    startedup = true;
}
}


function startCamera() {
if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(function onSuccess(stream) {
        const video = document.getElementById('videoElement');
        streamRef = stream;
        video.autoplay = true;
        video.srcObject = stream;
        timeInterval = setInterval(grab, ANALYSIS_INTERVAL);
    })
} else {
    alert('getUserMedia is not supported in this browser.');
}
}

function stopInterval() {
    clearInterval(timeInterval);
}

function stopCamera() {
if (streamRef === null) {
    console.log("Stop Stream: Stream not started/stopped.");
}
else if (streamRef.active) {
    video.pause();
    streamRef.getTracks()[0].stop();
    video.srcObject = null;
    stopInterval();
    adjustCanvas();
    updateAnalytics();
}
}

document.onreadystatechange = () => {
if (document.readyState === "complete") {
    String.prototype.capitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
    }
    video = document.querySelector("#videoElement");
    captureCanvas = document.getElementById("captureCanvas");
    captureCtx = captureCanvas.getContext("2d");
    drawCanvas = document.getElementById("drawCanvas");
    drawCtx = drawCanvas.getContext("2d");
}
};

var detectorInit = false;

function grab() {
    captureCtx.drawImage(
        video,
        0,
        0,
        video.videoWidth,
        video.videoHeight,
        0,
        0,
        video.videoWidth,
        video.videoHeight,
    );

    // image base64 data for apis and stuff
    // const base64Image = captureCanvas.toDataURL("image/jpeg");

    if (detector && detector.isRunning && detectorInit) {
        detector.process(captureCtx.getImageData(0, 0, captureCanvas.width, captureCanvas.height), secs);
    };

    secs += ANALYSIS_INTERVAL / 1000;
}

    detector.addEventListener('onInitializeSuccess', function () {
    // console.log('detector initialized');
    detectorInit = true
    });

    detector.addEventListener("onImageResultsSuccess", function (faces, image, timestamp) {
    // drawImage(image);
    //$('#results').html("");
    var time_key = "Timestamp";
    var time_val = timestamp;

    if (verbose) {
        console.log('#results', "Timestamp: " + timestamp.toFixed(2));
        console.log('#results', "Number of faces found: " + faces.length);
        console.log("Number of faces found: " + faces.length);
    }
    if (faces.length > 0) {
        if (verbose) {
            console.log('\nFACES RESULT')
            console.log(faces) }
        // drawFeaturePoints(image, faces[0].featurePoints);
        drawAffdexStats(image, faces[0]);
    } else {
        // If face is not detected skip entry.
        console.log('Cannot find face, skipping entry');
    };
});

//Draw the detected facial feature points on the image
function drawAffdexStats(img, data) {
    let featurePoints = data.featurePoints;
    // var contxt = $('#face_video_canvas')[0].getContext('2d');
    var contxt = document.getElementById('drawCanvas').getContext('2d');
    contxt.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    var hRatio = contxt.canvas.width / img.width;
    var vRatio = contxt.canvas.height / img.height;
    var ratio = Math.min(hRatio, vRatio);

    contxt.strokeStyle = "#FFFFFF";
    for (var id in featurePoints) {
        contxt.beginPath();
        contxt.arc(featurePoints[id].x,
        featurePoints[id].y, 2, 0, 2 * Math.PI);
        contxt.stroke();
    }

    let emoji = data.emojis.dominantEmoji;
    const emotionWithHighestScore = getEmotionWithHighestScore(data.emotions);
    console.log(emotionWithHighestScore); // Output: "engagement"
    const browFurrow = data.expressions.browFurrow.toFixed(2);
    const browRaise = data.expressions.browRaise.toFixed(2);
    const smile = data.expressions.smile.toFixed(2);
    const innerBrowRaise = data.expressions.innerBrowRaise.toFixed(2);
    const lipPress = data.expressions.lipPress.toFixed(2);
    const upperLipRaise = data.expressions.upperLipRaise.toFixed(2);

    const text = `Dominant Emoji: ${emoji}\nEmotion: ${emotionWithHighestScore}\nSmile: ${smile}\nInner Brow Raise: ${innerBrowRaise}\nLip Press: ${lipPress}\nBrow Furrow: ${browFurrow}\nBrow Raise: ${browRaise}\n`;

    contxt.font = "16px Arial";
    contxt.fillStyle = "white";

    contxt.lineWidth = 2; // Width of the border line
    contxt.fillStyle = 'white'; // Color of the text
    contxt.strokeStyle = 'black'; // Color of the border

    for (let i = 0; i < text.split("\n").length; i++) {
        contxt.strokeText(text.split("\n")[i], 10, 20 + i * 20);
        contxt.fillText(text.split("\n")[i], 10, 20 + i * 20);
    }
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

//-------------------------------------------------------------
//OLD STUFF I DONT EVEN KNOW WHAT THIS DOES
//-------------------------------------------------------------

function updateAnalytics() {
let labels = ['angry', 'sad', 'happy', 'fear', 'disgust', 'surprise', 'neutral'];
labels.forEach(label => {
    document.getElementById(label).textContent = analytics[label];
});
}

function adjustCanvas(bool) {
if (!adjustedCanvas || bool) {
    drawCanvas.width = drawCanvas.width;
    drawCanvas.width = video.videoWidth || drawCanvas.width;
    drawCanvas.height = video.videoHeight || drawCanvas.height;
    captureCanvas.width = video.videoWidth || captureCanvas.width;
    captureCanvas.height = video.videoHeight || captureCanvas.height;
    drawCtx.lineWidth = "5";
    drawCtx.strokeStyle = "blue";
    drawCtx.font = "20px Verdana";
    drawCtx.fillStyle = "red";
    adjustedCanvas = true;
}
}

function downloadFrame() {
    var link = document.createElement('a');
    link.download = 'frame.jpeg';
    link.href = document.getElementById('myCanvas').toDataURL("image/jpeg", 1);
    link.click();
}

function upload(blob) {
    var fd = new FormData();
    fd.append("file", blob);
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/ml_upload", true);
    xhr.onload = function () {
        if (this.status == 200) {
        objects = JSON.parse(this.response);
        drawBoxes(objects);
        }
    };
    xhr.send(fd);
}

function drawBoxes(objects) {
    objects.forEach(object => {
        let label = object.label;
        let score = Number(object.score);
        let x = Number(object.x);
        let y = Number(object.y);
        let width = Number(object.width);
        let height = Number(object.height);
        analytics[label] += 1;
        adjustCanvas(true);
        drawCtx.fillText(label + " - " + score, x + 5, y + 20);
        drawCtx.strokeRect(x, y, width, height);
    });
}