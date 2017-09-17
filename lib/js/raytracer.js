var glMatrix = require('gl-matrix');
var vec2 = glMatrix.vec2;
var vec3 = glMatrix.vec3;
var mat3 = glMatrix.mat3;
var mat4 = glMatrix.mat4;

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

// Look at - komb version
function lookat(pose, eye, center, up) {
      /*  using namespace Eigen;
        Vector3f z = at - eye;
        z.normalize();
        Vector3f x = z.cross(up);
        x.normalize();
        Vector3f y = z.cross(x);
        y.normalize();
        
        Matrix3f R;
        R.col(0) = x;
        R.col(1) = y;
        R.col(2) = z;
        
        return Translation3f(eye) * R;*/
    var z = vec3.sub(vec3.create(), center, eye);
    vec3.normalize(z, z);
    var x = vec3.cross(vec3.create(), z, up);
    vec3.normalize(x, x);
    var y = vec3.cross(vec3.create(), z, x);
    vec3.normalize(y, y);

    var R = mat4.fromValues(
        x[0], x[1], x[2], 0,
        y[0], y[1], y[2], 0,
        z[0], z[1], z[2], 0,
        0, 0, 0, 1);
    var t = mat4.fromTranslation(mat4.create(), eye);
    mat4.multiply(pose, t, R);
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


// Camera stuff
function updatePose(pose, center, up, a) {
    var r = 0.4;
    var eye = vec3.fromValues(center[0] + Math.sin(a) * r, center[1] - Math.cos(a) * r, center[2]);
    lookat(pose, eye, center, up);
}

function attachCamera(element, center, up, renderer) {
    var a = 0;
    var pose = mat4.create();

    var down = null;
    element.onmousedown = function(e) {
        down = e;
    };
    element.onmouseup = function(e) {
        down = null;
    };
    element.onmousemove = function(e) {
        if (!down) return;
        a += (down.x - e.x) / 100;
        updatePose(pose, center, up, a);
        renderer(pose);
        return false;
    };
    updatePose(pose, center, up, a);
    renderer(pose);
}


function autoSpin(center, up, renderer, a) {
    a = a || -Math.PI / 3;
    if (a > Math.PI / 3) {
        return;
    }
    var pose = mat4.create();
    updatePose(pose, center, up, a);
    renderer(pose);
    setTimeout(autoSpin, 10, center, up, renderer, a + 0.05);
}

function start_here() {
    fetch('data/samuel-64.tsdf')
        .then(function(response) {
        return response.arrayBuffer();
    })
    .then(function(raw_data) {
        var tsdf = loadTsdf(raw_data);

        var canvas = document.getElementById('canvas');
        var center = vec3.multiply(vec3.create(), tsdf.size, vec3.fromValues(0.5, 0.5, 0.5));
        var up = vec3.fromValues(0, 0, 1);

        //attachCamera(canvas, center, up, function(pose) { render(tsdf, pose); });
        console.log("autospin");
        autoSpin(center, up, function(pose) { render(tsdf, pose); });
        
        window.onhashchange = function () {
            console.log(window.location.hash);
        }
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
    
    near = tmin;

    return {near: near};
}

var cache;
function render_depth(tsdf, pose, K, depth, width, height)
{
    var K_inv = mat3.create();
    mat3.invert(K_inv, K);

    var rotation = mat3.fromMat4(mat3.create(), pose);
    var pose_translation = mat4.getTranslation(vec3.create(), pose);

    //console.log("correct tranalation", vec3.fromValues(0.5, -0.1, 0.5));
    //console.log("correct rotation", mat3.fromValues(1, 0, 0, 0, 0, -1, 0, 1, 0))

    var pre = mat3.create();
    mat3.mul(pre, rotation, K_inv);
    
    // TODO: select min element intead of x
    var voxel_length = vec3.divide(vec3.create(), tsdf.size, tsdf.resolution)[0];

    // create normalized per pixel ray directions cache
    if (!cache) {
        var c = 0;
        console.log("Creating cache");
        cache = [];
        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var d = vec3.transformMat3(vec3.create(), vec3.fromValues(x, y, 1), K_inv);
                //var d = vec3.fromValues(x, y, 1);
                vec3.normalize(d, d);
                cache[c] = d;
                c++;
            }
        }
    }

    var c = 0;
    var d = vec3.create();
    for (var y = 0; y < height; y++)
    {
        for (var x = 0; x < width; x++)
        {
            vec3.transformMat3(d, cache[c], rotation);
            var p = vec3.clone(pose_translation);
            var intersection = intersect(tsdf, p, d);
            if (intersection) {
                var k = intersection.near;
                var dist = 0;
                do {
                    k += Math.max(voxel_length, dist);
                    vec3.scaleAndAdd(p, pose_translation, d, k);
                    if (!inside(tsdf, p)) {
                        break;
                    }
                    dist = distance_multiply(tsdf, idx(tsdf, p));
                } while (dist > 0);
                depth[c] = k;
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

var img;
var depth;
function render(tsdf, pose) {
    var fx = 472, fy = 472;
    var cx = 319.5, cy = 239.5;
    var K = mat3.fromValues(fx, 0.0, cx, 0.0, fy, cy, 0.0, 0.0, 1.0);
    var K = mat3.transpose(mat3.create(), K);
    
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');

    var render_size = vec2.fromValues(canvas.width, canvas.height);
    if (!depth) {
        depth = new Float32Array(render_size[0] * render_size[1]);
    }

    console.time("raytrace");
    render_depth(tsdf, pose, scaleCamera(K, vec2.fromValues(640, 480), render_size), depth, render_size[0], render_size[1]);
    console.timeEnd("raytrace");

    if (!img) {
        img = ctx.createImageData(render_size[0], render_size[1]);
    }
    var c = 0;
    //var min = Math.min.apply(null, depth),
    //    max = Math.max.apply(null, depth);

    //console.log(min, max);
    var min = 0.25, max = 0.8;

    // Scales normalized (0-1) depth to pixel value
    function f(nm) {
        var a = 0.1;
        return 1 - (nm / (a+nm));
    }
    
    for (var i = 0; i < img.width * img.height * 4; i += 4) {
        var v = depth[c];
        c++;
        
        img.data[i + 0] = 0;
        img.data[i + 1] = 255 * f((v - min) / (max - min));
        img.data[i + 2] = 255 * f((v - min) / (max - min));
        img.data[i + 3] = 0xff;
    }

    ctx.putImageData(img, 0, 0);


    // Save png
    // var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");  // here is the most important part because if you dont replace you will get a DOM 18 exception.
    // window.location.href = image; // it will save locally
}
