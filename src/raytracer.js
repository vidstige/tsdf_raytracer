var glMatrix = require('gl-matrix');
var vec2 = glMatrix.vec2;
var vec3 = glMatrix.vec3;
var mat3 = glMatrix.mat3;
var mat4 = glMatrix.mat4;

var tsdf = require('./tsdf.js');

function Camera(K) {
    var thiz = this;
    this.K = K;
    this.pose = mat4.create();

    this.lookat = function(eye, center, up) {
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
        mat4.multiply(thiz.pose, t, R);
    };
}

// Camera stuff
function updateCamera(camera, center, up, a) {
    var r = 0.4;
    var eye = vec3.fromValues(center[0] + Math.sin(a) * r, center[1] - Math.cos(a) * r, center[2]);
    camera.lookat(eye, center, up);
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
        updateCamera(camera, center, up, a);
        renderer(camera);
        return false;
    };
    updateCamera(camera, center, up, a);
    renderer(camera);
}


function autoSpin(K, center, up, renderer, a) {
    a = a || -Math.PI / 3;
    if (a > Math.PI / 3) {
        return;
    }
    var camera = new Camera(K);
    updateCamera(camera, center, up, a);
    renderer(camera);
    setTimeout(autoSpin, 10, K, center, up, renderer, a + 0.05);
}


function Raytracer() {
    var cache;
    this.render_depth = function(tsdf, pose, K, depth, width, height)
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

        if (!tsdf.world_to_lattice) {
            tsdf.world_to_lattice = vec3.divide(vec3.create(), tsdf.resolution, tsdf.size);
        }

        var c = 0;
        var d = vec3.create();
        var steps = [];
        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var n = 0;
                vec3.transformMat3(d, cache[c], rotation);
                var p = vec3.clone(pose_translation);
                var intersection = tsdf.intersect(p, d);
                if (intersection) {
                    var k = intersection.near;
                    var dist = 0;
                    do {
                        k += Math.max(voxel_length, dist);
                        vec3.scaleAndAdd(p, pose_translation, d, k);
                        if (!tsdf.inside(p)) {
                            break;
                        }
                        dist = tsdf.distance(tsdf.idx(p));
                        n++;
                    } while (dist > 0);
                    depth[c] = k;
                    steps[c] = n;
                } else {
                    depth[c] = 0;
                    steps[c] = 0;
                }
                
                c++;
            }
        }
        /*var sum = 0;
        for (var i = 0; i < steps.length; i++) {
            sum += steps[i];
        }
        console.log("Average steps " + sum/steps.length);
        var min = Math.min.apply(null, steps),
            max = Math.max.apply(null, steps);
        console.log("max: " + max);
        console.log("min: " + min);*/

    };
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
var raytracer = new Raytracer();
function render(tsdf, camera) {
        var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');

    var render_size = vec2.fromValues(canvas.width, canvas.height);
    if (!depth) {
        depth = new Float32Array(render_size[0] * render_size[1]);
    }

    console.time("raytrace");
    raytracer.render_depth(tsdf, camera.pose, scaleCamera(camera.K, camera.K.resolution, render_size), depth, render_size[0], render_size[1]);
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

module.exports = {loadTsdf: tsdf.loadTsdf, autoSpin, render};
