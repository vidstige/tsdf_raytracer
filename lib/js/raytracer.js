var glMatrix = require('gl-matrix');
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

    var size_x = dv.getFloat32(o); o += 4;
    var size_y = dv.getFloat32(o); o += 4;
    var size_z = dv.getFloat32(o); o += 4;
    var size = vec3.fromValues(size_x, size_y, size_z);
    
    var num_voxels = resolution_z * resolution_y * resolution_x;
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
        indices.z * tsdf.resolution.y * tsdf.resolution.x +
        indices.y * tsdf.resolution.y +
        indices.x;
    return tsdf.distances[index];
}

// Returns index in tsdf for given coordinate
function idx(tsdf, p)
{
    //return (tsdf.voxel_length_inverse * p).cast<int>();
    
    // This vector scales world coordinates to tsdf coordinates
    var m = vec3.divide(vec3.create(), tsdf.resolution, tsdf.size);
    return vec3.mul(vec3.create(), p, m).round();
}

// Returns whether specified coordinate is inside tsdf
function inside(tsdf, p) {
    return p.x > 0 && p.x < tsdf.size.x && p.y > 0 && p.y < tsdf.size.y && p.z > 0 && p.z < tsdf.size.z;
}

// Returns near intersection plane with the given line
function intersect(tsdf, o, d)
{
    var min = vec3.fromValues(0, 0, 0);
    var max = tsdf.size;
    
    var tmin = (min.x - o.x) / d.x;
    var tmax = (max.x - o.x) / d.x;
    if (tmin > tmax) {
        var tmp = tmin;
        tmin = tmax;
        tmax = tmp;
    }
    var tymin = (min.y - o.y) / d.y;
    var tymax = (max.y - o.y) / d.y;
    if (tymin > tymax) {
        var tmp = tymin;
        tymin = tymax;
        tymax = tmp;
    }

    if ((tmin > tymax) || (tymin > tmax))
        return false;

    if (tymin > tmin)
        tmin = tymin;
    if (tymax < tmax)
        tmax = tymax;
    var tzmin = (min.z - o.z) / d.z;
    var tzmax = (max.z - o.z) / d.z;
    if (tzmin > tzmax) {
        var tmp = tzmin;
        tzmin = tzmax;
        tzmax = tmp;
    }
    
    if ((tmin > tzmax) || (tzmin > tmax))
        return false;
    if (tzmin > tmin)
        tmin = tzmin;
    //if (tzmax < tmax)
    //    tmax = tzmax;
    
    near = tmin + Number.EPSILON;
    
    return near;
}

function render_depth(tsdf, pose, K, depth, width, height)
{
    var pre = mat3.create();
    mat4.mul(pre, pose.rotation, K.clone().inverse());
    //Eigen::Matrix3f pre = pose.rotation() * K_.inverse();
    
    var c = 0;
    for (var y = 0; y < height; y++)
    {
        for (var x = 0; x < width; x++)
        {
            //auto d = pre * Eigen::Vector3f(x, y, 1);
            var d = vec3.transformMat3(vec3.create(), vec3.fromValues(x, y, 1), pre);
            d.normalize();
            //Eigen::Vector3f p(pose.translation());
            var p = pose.translation;

            var k = 0;
            if (intersect(tsdf, p, d, k)) {
                // TODO: select min element intead of x
                var voxel_length = vec3.divide(vec3.create(), tsdf.size, tsdf.resolution).x;
                var dist;
                var isInside;
                while ((isInside = inside(tsdf, p)) && (dist = distance_multiply(tsdf, idx(tsdf, p))) > 0) {
                    //p = pose.translation + k *  d;
                    // p = pose.translation + d * k
                    vec3.scaleAndAdd(p, pose.translation, d, k);
                    p = pose.translation.clone();
                    k += tsdf.voxel_length;

                    //k += std::max(tsdf.voxel_length / 2, dist);
                    //k += dist;
                }
                if (!isInside)
                {
                    depth[c] = 0;
                }
                else
                {
                    //k += distance(tsdf, idx(tsdf, p));
                    //target[c] = 63000 - (unsigned short)(k*800);
                    depth[c] = k;
                }
            }
            else {
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

function render(tsdf) {
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
