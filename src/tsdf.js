
var glMatrix = require('gl-matrix');
var vec3 = glMatrix.vec3;

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
    var resolution = vec3.fromValues(resolution_x, resolution_y, resolution_z);

    // when using getFloat32 little endian need to be specified explicitly...
    var size_x = dv.getFloat32(o, true); o += 4;
    var size_y = dv.getFloat32(o, true); o += 4;
    var size_z = dv.getFloat32(o, true); o += 4;
    var size = vec3.fromValues(size_x, size_y, size_z);
    
    var num_voxels = resolution_z * resolution_y * resolution_x;
    // ... while when using Float32Array, it does not.
    return new Tsdf(resolution, size, new Float32Array(raw_data, o, num_voxels));
}

module.exports = {loadTsdf};
