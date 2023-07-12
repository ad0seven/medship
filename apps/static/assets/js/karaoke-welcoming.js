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

let maxEmotion = null;
let welcoming = null;


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

    detector.stop();

    video.srcObject = null;
    stopInterval();
    adjustCanvas();
    updateSpreadsheet();
    clearDrawCanvas();
 
    startedup = false;
    detectorInit = false;
    
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

const testType = 'karaoke-welcoming'
const dataColumns = ['timestamp', 'cheekRaise', 'smile', 'engagement','welcoming']
var recordedData = [] //storing the spreadsheet data


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

    //get global unix timestamp (more flexible for data analysis)
     let unix_timestamp = new Date().getTime();

     if (verbose) {
        console.log('#results', "Timestamp: " + timestamp.toFixed(2));
        console.log('#results', "Number of faces found: " + faces.length);
        console.log("Number of faces found: " + faces.length);
    }
    if (faces.length > 0) {
        if (verbose) {
            console.log('\nFACES RESULT')
            console.log(faces) 
        }
        // drawFeaturePoints(image, faces[0].featurePoints);

        updateStats(faces[0], unix_timestamp);


        if (startedup) {
           drawAffdexStats(image, faces[0]);
       }
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
    const cheekRaise = data.expressions.cheekRaise.toFixed(2);
    const eyeWiden = data.expressions.eyeWiden.toFixed(2);
    const engagement = data.emotions.engagement.toFixed(2);

    const welcomingExpressions = {
        cheekRaise: cheekRaise,
        smile: smile,
        engagement: engagement
    };

    const customThresholds = {
        cheekRaise: 10,
        smile: 25,
        engagement: 20
      };
      
    
    const welcoming = checkWelcomingDetected(welcomingExpressions, customThresholds) ? 'Detected' : 'Not Detected';
    
    maxEmotion = getEmotionWithHighestScore(data.emotions);
    console.log(maxEmotion);

    let text = `Welcoming: ${welcoming}\nCheek Raise: ${cheekRaise}\nLip Corners Pull: ${smile}\nEngagement ${engagement}\nDominant Emoji: ${emoji}`;

    contxt.font = "20px Arial";
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

function checkWelcomingDetected(expressions, thresholds) {
    const welcomingExpressions = ['cheekRaise', 'smile', 'engagement'];
    let welcomingDetected = true;
  
    for (const expression of welcomingExpressions) {
      const score = expressions[expression];
      const threshold = thresholds[expression];
  
      if (score <= threshold) {
        welcomingDetected = false;
        break;
      }
    }
  
    return welcomingDetected ? 'welcomingDetected' : null;
  }
  

function clearDrawCanvas() {
    let contxt = document.getElementById("drawCanvas").getContext("2d");
    contxt.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    console.log("Cleared draw canvas");
  }

function convertCamelCaseToSpaces(str) {
    // Use regular expressions to find uppercase letters preceded by a lowercase letter
    // and insert a space before them
    return str.replace(/([a-z])([A-Z])/g, '$1 $2')
              // Replace all uppercase letters with lowercase letters
              .toLowerCase();
  }

  function updateStats(data, timestamp){
    let newDataRow = []
    newDataRow.push(timestamp)

    for (const columnName of dataColumns) {
        if (data.expressions.hasOwnProperty(columnName)) {
            let dataCol = data.expressions[columnName].toFixed(2);
            newDataRow.push(dataCol)
        }
    } 


        // Calculate maxEmotion and compassionDetected here
        const maxEmotion = getEmotionWithHighestScore(data.emotions);
        const welcomingExpressions = {
            cheekRaise: data.expressions.cheekRaise.toFixed(2),
            smile: data.expressions.smile.toFixed(2),
            engagement: data.emotions.engagement.toFixed(2),
        };
    
        const customThresholds = {
            cheekRaise: 10,
            smile: 25,
            engagement: 20
          };
    
        const welcomingDetected = checkWelcomingDetected(welcomingExpressions, customThresholds);
    
        // Add maxEmotion and compassionDetected to newDataRow
        newDataRow.push(maxEmotion, welcomingDetected);
    
        if (verbose){
            console.log(`New data row: ${newDataRow}`)
        }
        recordedData.push(newDataRow)
    }


    // Initialize the selectedFeedback variable globally
    let selectedFeedback = '';
    
    // Initially disable the stopCamera button
    document.querySelector('#stopCamera').disabled = true;
    
    // Feedback event listener
    document.querySelectorAll('.feedback li').forEach(entry => entry.addEventListener('click', e => {
        if(!entry.classList.contains('active')) {
            document.querySelector('.feedback li.active').classList.remove('active');
            entry.classList.add('active');
            selectedFeedback = entry.className.split(' ')[0]; // Store the class name before 'active'
            
            // Enable the stopCamera button when feedback is selected
            document.querySelector('#stopCamera').disabled = false;
        }
        e.preventDefault();
    }));

    
    function updateSpreadsheet() {
        //send over the data to flask endpoint that updates the google sheet
        let quizResults = JSON.parse(localStorage.getItem('quizResults'));
        console.log('Quiz results retrieved:', quizResults);
        
        // Ensure we're only sending the score
        let quizScore = quizResults.score;
    
        fetch('/update-sheet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                test_type: testType,
                columns: dataColumns,
                values: recordedData,
                max_emotion: maxEmotion, // Include maxEmotion data
                welcoming_detected: welcoming,
                feedback: selectedFeedback, // Include user feedback data
                quiz_results: quizScore  // Send just the quiz score
            }),
        })
        .then(response => response.json())
        .then(data => {
            let success = data['success']
            if (success) {
                console.log('Successfully updated spreadsheet')
            } else {
                console.log('Failed to update spreadsheet')
            }
        })
        .catch((error) => {
            console.error('Error:', error);
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