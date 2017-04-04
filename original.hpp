// Copyright 2017 Volumental AB. CONFIDENTIAL. DO NOT REDISTRIBUTE.
#pragma once

#include <Eigen/Geometry>

#include <mesh_toolbox/Tsdf.hpp>

namespace komb {

class TsdfRaytracer
{
public:
    EIGEN_MAKE_ALIGNED_OPERATOR_NEW

    ///
    /// Constructs a raytracer instance.
    /// @param tsdf The tsdf to render
    /// @param K The camera matrix K describing the internal camera
    ///        parameters.
    ///
    TsdfRaytracer(const Tsdf<float>& tsdf, const Eigen::Matrix3f& K):
        K_(K), tsdf_(tsdf) {}

    ///
    /// Renders a depth image of a tsdf to the supplied target image. The
    /// camera matrix K is not scaled to match the output pixel dimensions.
    /// @param pose The pose from which the render should be done.
    /// @param depth Target depth image. Must hold at least width*height floats.
    /// @param width Width of the target image.
    /// @param height Height of target image.
    ///
    void render(const Eigen::Affine3f& pose, float* depth, int width, int height); // NOLINT

private:
    float trace(const Eigen::Vector3f& ray_origin, const Eigen::Vector3f ray_direction) const;

    const Eigen::Matrix3f K_;
    const Tsdf<float>& tsdf_;
};

float evaluateAt(const Tsdf<float>& tsdf, const Eigen::Vector3i& indices);

Eigen::Vector3i indexOf(const Tsdf<float>& tsdf, const Eigen::Vector3f& p);

///
/// Evaluates a tsdf. Using nearest neighbor interpolation
/// @param tsdf The tsdf to evaluate.
/// @param p The position in space where to evaluate.
///
float evaluateAt(const Tsdf<float>& tsdf, const Eigen::Vector3f& p);

///
/// Checks whether a point is inside a tsdf volume
///
bool isInside(const Tsdf<float>& tsdf, const Eigen::Vector3f& p);

///
/// Checks whether a ray intersects with a tsdf volume.
/// @param tsdf the tsdf volume
/// @param o origin of ray
/// @param d direction of ray
/// @param near parameter containing the distance k to the tsdf volume such that o+d*k is
///     the closest point inside the volume.
///
bool intersect(const Tsdf<float>& tsdf, const Eigen::Vector3f& o,
    const Eigen::Vector3f& d, float& near);

} // namespace komb
