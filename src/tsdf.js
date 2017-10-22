
var glMatrix = require('gl-matrix');
var vec3 = glMatrix.vec3;

DataView.prototype.getUint64 = function(byteOffset, littleEndian) {
    var low = littleEndian ? 0 : 4;
    var hi = 4 - low;
    return (this.getUint32(byteOffset + hi) << 32) |
            this.getUint32(byteOffset + low);
};

function Tsdf(resolution, size, distances) {
    var tsdf = this;
    this.resolution = resolution;
    this.size = size;
    this.distances = distances;

    this.distance = function(indices) {
        var index =
            indices[2] * tsdf.resolution[1] * tsdf.resolution[0] +
            indices[1] * tsdf.resolution[0] +
            indices[0];
        return tsdf.distances[index];
    };


    // Returns index in tsdf for given coordinate
    var tmp = vec3.create();
    this.idx = function(p) {
        vec3.mul(tmp, p, tsdf.world_to_lattice);
        return vec3.round(tmp, tmp);
    };

    // Returns whether specified coordinate is inside tsdf
    this.inside = function(p) {
        return p[0] > 0 && p[0] < tsdf.size[0] &&
            p[1] > 0 && p[1] < tsdf.size[1] &&
            p[2] > 0 && p[2] < tsdf.size[2];
    };

    // Returns near intersection plane with the given line
    this.intersect = function(o, d) {
        var min = vec3.fromValues(0, 0, 0);
        var max = tsdf.size;
        
        var tmin = (min[0] - o[0]) / d[0];
        var tmax = (max[0] - o[0]) / d[0];
        if (tmin > tmax) {
            var tmp = tmin;
            tmin = tmax;
            tmax = tmp;
        }
        var tymin = (min[1] - o[1]) / d[1];
        var tymax = (max[1] - o[1]) / d[1];
        if (tymin > tymax) {
            var tmp = tymin;
            tymin = tymax;
            tymax = tmp;
        }

        if ((tmin > tymax) || (tymin > tmax)) return false;

        if (tymin > tmin) tmin = tymin;
        if (tymax < tmax) tmax = tymax;
        var tzmin = (min[2] - o[2]) / d[2];
        var tzmax = (max[2] - o[2]) / d[2];
        if (tzmin > tzmax) {
            var tmp = tzmin;
            tzmin = tzmax;
            tzmax = tmp;
        }
        
        if ((tmin > tzmax) || (tzmin > tmax)) return false;
        if (tzmin > tmin) tmin = tzmin;
        //if (tzmax < tmax)
        //    tmax = tzmax;
        
        near = tmin;

        return {near: near};
    };
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
