var tsdf_raytracer = require('../src/raytracer.js');

var glMatrix = require('gl-matrix');
var vec3 = glMatrix.vec3;
var mat3 = glMatrix.mat3;

function K() {
    var fx = 472, fy = 472;
    var cx = 319.5, cy = 239.5;
    var K = mat3.fromValues(fx, 0.0, cx, 0.0, fy, cy, 0.0, 0.0, 1.0);
    return mat3.transpose(mat3.create(), K);
}

function start_here() {
    fetch('data/samuel-64.tsdf')
        .then(function(response) {
        return response.arrayBuffer();
    })
    .then(function(raw_data) {
        var tsdf = tsdf_raytracer.loadTsdf(raw_data);

        var canvas = document.getElementById('canvas');
        var center = vec3.multiply(vec3.create(), tsdf.size, vec3.fromValues(0.5, 0.5, 0.5));
        var up = vec3.fromValues(0, 0, 1);

        //attachCamera(canvas, center, up, function(pose) { render(tsdf, pose); });
        console.log("autospin");
        tsdf_raytracer.autoSpin(K(), center, up, function(camera) { tsdf_raytracer.render(tsdf, camera); });
        
        window.onhashchange = function () {
            console.log(window.location.hash);
        }
    });
}
window.onload = start_here;