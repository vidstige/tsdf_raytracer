// Copyright 2017 Volumental AB. CONFIDENTIAL. DO NOT REDISTRIBUTE.
#include <algorithm> // for swap

#include "TsdfRaytracer.hpp"
#include <Eigen/Core>

namespace komb {

float evaluateAt(const Tsdf<float>& tsdf, const Eigen::Vector3i& indices)
{
    size_t index =
        indices.z() * tsdf.resolution*tsdf.resolution +
        indices.y() * tsdf.resolution +
        indices.x();
    return tsdf.distances[index];
}

Eigen::Vector3i indexOf(const Tsdf<float>& tsdf, const Eigen::Vector3f& p)
{
    return (tsdf.voxel_length_inverse * p).cast<int>();
}

float evaluateAt(const Tsdf<float>& tsdf, const Eigen::Vector3f& p)
{
    return evaluateAt(tsdf, indexOf(tsdf, p));
}

bool isInside(const Tsdf<float>& tsdf, const Eigen::Vector3f& p)
{
    return
        p.x() > 0 && p.x() < tsdf.length &&
        p.y() > 0 && p.y() < tsdf.length &&
        p.z() > 0 && p.z() < tsdf.length;
}

bool intersect(const Tsdf<float>& tsdf, const Eigen::Vector3f& o, const Eigen::Vector3f& d, float& near, float& far)
{
    using namespace Eigen;
    Vector3f bounds_min(0, 0, 0);
    Vector3f bounds_max(tsdf.length, tsdf.length, tsdf.length);

    // 1. Find distance to left and right planes of cube along ray
    float tmin = (bounds_min.x() - o.x()) / d.x();
    float tmax = (bounds_max.x() - o.x()) / d.x();
    if (tmin > tmax) std::swap(tmin, tmax);

    // 2. Find distance to up and down planes of cube along ray
    float tymin = (bounds_min.y() - o.y()) / d.y();
    float tymax = (bounds_max.y() - o.y()) / d.y();
    if (tymin > tymax) std::swap(tymin, tymax);

    // Check if ray can intersect cube
    if ((tmin > tymax) || (tymin > tmax))
        return false;
    if (tymin > tmin)
        tmin = tymin;
    if (tymax < tmax)
        tmax = tymax;

    // 3. Find distance to far and near planes of cube along ray
    float tzmin = (bounds_min.z() - o.z()) / d.z();
    float tzmax = (bounds_max.z() - o.z()) / d.z();
    if (tzmin > tzmax) std::swap(tzmin, tzmax);

    // Check if ray can intersect cube
    if ((tmin > tzmax) || (tzmin > tmax))
        return false;
    if (tzmin > tmin)
        tmin = tzmin;
    if (tzmax < tmax)
        tmax = tzmax;

    // Return distance to point inside cube in units of ||d||
    near = tmin + std::numeric_limits<float>::epsilon();
    far = tmax;

    return true;
}

float TsdfRaytracer::trace(const Eigen::Vector3f& ray_origin, const Eigen::Vector3f ray_direction) const
{
    float near = 0, unused = 0;
    if (!intersect(tsdf_, ray_origin, ray_direction, near, unused))
    {
        return 0;
    }

    // k is how far along the ray_direction from the ray_origin we have traced
    float k = near;
    Eigen::Vector3f position(ray_origin + k * ray_direction);

    while (isInside(tsdf_, position))
    {
        float distance = evaluateAt(tsdf_, position);
        if (distance < 0)
        {
            //TODO(samuel): Interpolate distance from the two voxels containg zero crossing.
            return k;
        }
        k += tsdf_.voxel_length;
        // More aggressive step length, might give poor result for
        // inconsistent tsdfs.
        //k += std::max(tsdf.voxel_length / 2, distance);
        position = ray_origin + k * ray_direction;
    }
    // No zero-crossing found
    return 0;
}

void TsdfRaytracer::render(const Eigen::Affine3f& pose, float* depth, int width, int height)
{
    int c = 0;
    for (int y = 0; y < height; y++)
    {
        for (int x = 0; x < width; x++)
        {
            Eigen::Vector3f ray_direction =
                pose.rotation() * K_.inverse() * Eigen::Vector3f(x, y, 1);
            ray_direction.normalize();
            Eigen::Vector3f ray_origin(pose.translation());

            depth[c] = trace(ray_origin, ray_direction);
            c++;
        }
    }
}

}
