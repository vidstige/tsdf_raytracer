function onload() {
    fetch('data/test.txt')
        .then(function(response) {
        return response.text();
    })
    .then(function(tsdf) {
        console.log(tsdf);
    });
}

function draw() {
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  
  var img = ctx.createImageData(320, 200);
  for (var i = 0; i < img.width * img.height * 4; i += 4) {
      img.data[i + 0] = 0xff;
      img.data[i + 1] = 128;
      img.data[i + 2] = 128;
      img.data[i + 3] = 0xff;
  }

  ctx.putImageData(img, 0, 0);
}
