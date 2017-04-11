var glMatrix = require('gl-matrix');
var vec2 = glMatrix.vec2;
var vec3 = glMatrix.vec3;
var mat3 = glMatrix.mat3;

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

function start_here() {
    fetch('data/samuel-64.tsdf')
        .then(function(response) {
        return response.arrayBuffer();
    })
    .then(function(raw_data) {
        var tsdf = loadTsdf(raw_data);
        render(tsdf);
    });
}
window.start_here = start_here;


// Returns distance to surface at specified indices
function distance_multiply(tsdf, indices)
{
    var index =
        indices[2] * tsdf.resolution[1] * tsdf.resolution[0] +
        indices[1] * tsdf.resolution[0] +
        indices[0];
    return tsdf.distances[index];
}

// Returns index in tsdf for given coordinate
function idx(tsdf, p)
{
    if (!tsdf.world_to_lattice) {
        tsdf.world_to_lattice = vec3.divide(vec3.create(), tsdf.resolution, tsdf.size);
    }
    var tmp = vec3.create();
    vec3.mul(tmp, p, tsdf.world_to_lattice);
    return vec3.round(tmp, tmp);
}

// Returns whether specified coordinate is inside tsdf
function inside(tsdf, p) {
    return p[0] > 0 && p[0] < tsdf.size[0] &&
        p[1] > 0 && p[1] < tsdf.size[1] &&
        p[2] > 0 && p[2] < tsdf.size[2];
}

// Returns near intersection plane with the given line
function intersect(tsdf, o, d)
{
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
    
    near = tmin + Number.EPSILON;

    return {near: near};
}

function render_depth(tsdf, pose, K, depth, width, height)
{
    var K_inv = mat3.create();
    mat3.invert(K_inv, K);

    var pre = mat3.create();
    mat3.mul(pre, pose.rotation, K_inv);
    
    // TODO: select min element intead of x
    var voxel_length = vec3.divide(vec3.create(), tsdf.size, tsdf.resolution)[0];

    var c = 0;
    for (var y = 0; y < height; y++)
    {
        for (var x = 0; x < width; x++)
        {
            var d = vec3.transformMat3(vec3.create(), vec3.fromValues(x, y, 1), pre);
            vec3.normalize(d, d);
            
            var p = vec3.clone(pose.translation);
            var intersection = intersect(tsdf, p, d);
            if (intersection) {
                var k = intersection.near;
                var dist;
                var isInside;

                vec3.scaleAndAdd(p, pose.translation, d, k);
                while ((isInside = inside(tsdf, p)) && (dist = distance_multiply(tsdf, idx(tsdf, p))) > 0) {
                    vec3.scaleAndAdd(p, pose.translation, d, k);
                    k += voxel_length;
                }
                if (!isInside)
                {
                    depth[c] = 0;
                }
                else
                {
                    depth[c] = k;
                }
            } else {
                depth[c] = 0;
            }
            
            c++;
        }
    }
}

/*
void RayTracer::depthToGray(const float* depth, int width, int height, unsigned short* output)
{
    int c = 0;
    for (int y = 0; y < height; y++)
    {
        for (int x = 0; x < width; x++)
        {
            output[c] = 63000 - (unsigned short)(depth[c]*800);
            
            c++;
        }
    }
}

void RayTracer::illuminate(const float* depth, int width, int height, unsigned short* output)
{
    Eigen::Vector3f light(0, 0, -1);
    int c = 0;
    for (int y = 0; y < height-1; y++)
    {
        for (int x = 0; x < width-1; x++)
        {
            if (depth[c] > std::numeric_limits<float>::epsilon())
            {
                float dx = depth[c] - depth[c + 1];
                float dy = depth[c] - depth[c + width];
                Eigen::Vector3f normal(-dx, -dy, 1);
                normal.normalize();
            
                float l = normal.dot(light);
            
                output[c] = 1200 + l*2000;
            }
            else
            {
                output[c] = 0;
            }
            c++;
        }
        c++;
    }
}
*/

function scaleCamera(K, oldSize, newSize) {
    var scale_x = newSize[0] / oldSize[0];
    var scale_y = newSize[1] / oldSize[1];
    return mat3.fromValues(
        K[0] * scale_x, 0, 0,
        0, K[4] * scale_y, 0,
        K[6] * scale_x, K[7] * scale_y, 1.0);
}

function render(tsdf) {
    var fx = 472, fy = 472;
    var cx = 319.5, cy = 239.5;
    var K = mat3.fromValues(fx, 0.0, cx, 0.0, fy, cy, 0.0, 0.0, 1.0);
    var K = mat3.transpose(mat3.create(), K);
    
    pose = {
        translation: vec3.fromValues(0.5, -0.1, 0.5),
        rotation: mat3.fromValues(1, 0, 0, 0, 0, -1, 0, 1, 0)
    };
    var render_size = vec2.fromValues(160, 100);
    var depth = [];

    console.time("raytrace");
    render_depth(tsdf, pose, scaleCamera(K, vec2.fromValues(640, 480), render_size), depth, render_size[0], render_size[1]);
    console.timeEnd("raytrace");

    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');

    var img = ctx.createImageData(render_size[0], render_size[1]);
    var c = 0;
    for (var i = 0; i < img.width * img.height * 4; i += 4) {
        var v = depth[c];
        c++;
        img.data[i + 0] = 0;
        img.data[i + 1] = (v-0.4) * 1200;
        img.data[i + 2] = (v-0.4) * 1200;
        img.data[i + 3] = 0xff;
    }

    ctx.scale(10, 10);
    ctx.putImageData(img, 0, 0);
}
