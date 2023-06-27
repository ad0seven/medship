

Window.onload = loadResults();
function loadResults() {
  
  const results = JSON.parse(localStorage.getItem("results"));

  const datasets = Object.values(results).map((result) => {
    return {
      label: 'Dataset',
      data: [{ x: result.timestamp, y: result.detected }],
      pointBackgroundColor: getColorForDetectedValue(result.detected),
      pointRadius: 5,
      pointHoverRadius: 7,
    };
  });

  const config = {
    type: 'scatter',
     data: {
  datasets: datasets,
},
options: {
  responsive: true,
  plugins: {
    title: {
      display: true,
      text: 'Expressions Detected',
    },
  },
  scales: {
    x: {
      type: 'linear',
      display: true,
      title: {
        display: true,
        text: 'Timestamp',
      },
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'Detected',
      },
    },
  },
},
};
  var myChart = new Chart(ctx, config);
}

let replayVid = document.getElementById("replay");
let drSuperVid = document.getElementById("drSuperVid");
let filename = localStorage.getItem("filename");

console.log(`the filename is ${filename}`)
console.log(`the results are`)
console.log(JSON.parse(localStorage.getItem("results")));


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

function getColorForDetectedValue(detected) {
  switch (detected) {
    case 'compassion':
      return 'rgba(255, 99, 132, 0.5)';
    case 'listening':
      return 'rgba(54, 162, 235, 0.5)';
    case 'welcoming':
      return 'rgba(255, 206, 86, 0.5)';
    default:
      return 'rgba(0, 0, 0, 0.5)';
  }
}