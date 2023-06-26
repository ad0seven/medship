Window.onload = loadResults();
function loadResults() {

  var ctx = document.getElementById('myChart');
  let results = localStorage.getItem("results");
  const config = {
    type: 'doughnut',
    data: {
      //labels: ['Angry', 'Disgust', 'Fear', 'Happy', 'Sad', 'Surprise', 'Neutral'],
      labels: ['anger', 'contempt', 'disgust', 'engagement', 'fear', 'joy', 'sadness', 'surprise'],
      datasets: [
        {
          label: 'Dataset',
          data: results,
          backgroundColor: [
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 23, 192, 0.5)',
            'rgba(54, 162, 45, 0.5)',
            'rgba(27, 206, 86, 0.5)',
            'rgba(35, 92, 192, 0.5)',
            'rgba(135, 92, 92, 0.5)',
            'rgba(35, 192, 92, 0.5)',
          ]
        }
      ]
    },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Expressions Detected'
      }
      }
    },
  };
  var myChart = new Chart(ctx, config);
}

let replayVid = document.getElementById("replay");
let drSuperVid = document.getElementById("drSuperVid");
let filename = localStorage.getItem("filename");

console.log(`the filename is ${filename}`)
console.log(`the results are`)
console.log(localStorage.getItem("results"))

//replayVid.src = filename;
replayVid.src = filename;
replayVid.load()

function play() {
  replayVid.play();
  drSuperVid.play();
  loadResults();
}

function pause() {
  replayVid.pause();
  drSuperVid.pause();
}
