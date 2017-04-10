
DataView.prototype.getUint64 = function(byteOffset, littleEndian) {
    var low = littleEndian ? 0 : 4;
    var hi = 4 - low;
    return (this.getUint32(byteOffset + hi) << 32) |
            this.getUint32(byteOffset + low);
};

function Tsdf(resolution, size, distances) {
    this.resolution = resolution;
    this.size = size;
    this.distances = distances;
}

function loadTsdf(raw_data) {
    var dv = new DataView(raw_data, 0);
    var o = 16;
    var resolution_x = dv.getUint64(o); o += 8;
    var resolution_y = dv.getUint64(o); o += 8;
    var resolution_z = dv.getUint64(o); o += 8;

    console.log(resolution_x, resolution_y, resolution_z);

    var size_x = dv.getFloat32(o); o += 4;
    var size_y = dv.getFloat32(o); o += 4;
    var size_z = dv.getFloat32(o); o += 4;
    
    var num_voxels = resolution_z * resolution_y * resolution_x;
    return new Tsdf(null, null, new Float32Array(raw_data, o, num_voxels));
}

function onload() {
    fetch('data/samuel-64.tsdf')
        .then(function(response) {
        return response.arrayBuffer();
    })
    .then(function(raw_data) {
        var tsdf = loadTsdf(raw_data);
        draw(tsdf);
    });
}

function draw(tsdf) {
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  
  var img = ctx.createImageData(128, 128);
  var z = 50;
  var c = 128*128*z;
  for (var i = 0; i < img.width * img.height * 4; i += 4) {
      var v = tsdf.distances[c];
      c++;
      img.data[i + 0] = 0;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 0xff;
  }

  ctx.putImageData(img, 0, 0);
}
