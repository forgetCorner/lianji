export const kineticVertexShader = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

export const kineticFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uMode;
  uniform float uIntensity;
  uniform float uProgress;
  uniform float uPulse;
  uniform float uAspect;
  uniform float uQuality;
  uniform vec2 uPointer;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float lineMask(float value, float width) {
    return 1.0 - smoothstep(width, width * 2.2, abs(value));
  }

  float glowPoint(vec2 p, vec2 center, float size) {
    float distanceToPoint = length(p - center);
    return size / max(distanceToPoint * distanceToPoint, 0.0003);
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= uAspect;

    float modeWave = sin(uMode * 1.731) * 0.13;
    vec2 pointerOffset = vec2(uPointer.x * 0.055, uPointer.y * 0.04);
    p -= pointerOffset;

    float vignette = smoothstep(1.45, 0.15, length(vec2(p.x / max(uAspect, 1.0), p.y)));
    vec3 background = vec3(0.022, 0.034, 0.027);
    background += vec3(0.012, 0.024, 0.015) * vignette;

    vec3 color = background;

    float trackOneY = sin(p.x * 1.8 + uTime * 0.13 + uMode * 0.27) * 0.18 - 0.03;
    float trackTwoY = sin(p.x * 1.15 - uTime * 0.09 + 2.1) * 0.28 + 0.2 + modeWave;
    float trackThreeY = sin(p.x * 2.35 + uTime * 0.07 + 4.2) * 0.11 - 0.42 + modeWave * 0.5;
    float trackOne = lineMask(p.y - trackOneY, 0.0025);
    float trackTwo = lineMask(p.y - trackTwoY, 0.0014);
    float trackThree = lineMask(p.y - trackThreeY, 0.0012);

    vec3 lime = vec3(0.69, 0.98, 0.24);
    vec3 orange = vec3(1.0, 0.43, 0.12);
    color += lime * trackOne * (0.13 + uIntensity * 0.08);
    color += vec3(0.24, 0.42, 0.30) * (trackTwo * 0.24 + trackThree * 0.18);

    vec2 core = vec2(sin(uMode * 0.9) * 0.18, cos(uMode * 0.63) * 0.11 - 0.03);
    float radial = length(p - core);
    float coreAura = exp(-radial * 4.2) * (0.025 + uIntensity * 0.028);
    color += mix(lime, orange, uIntensity * 0.46) * coreAura;
    float contour = lineMask(fract(radial * 5.2 - uTime * 0.025) - 0.5, 0.025);
    color += lime * contour * smoothstep(1.1, 0.05, radial) * 0.055;

    float energyRibbon = lineMask(p.y - sin(p.x * 0.76 - uTime * 0.12 + uMode) * 0.42, 0.012);
    color += mix(vec3(0.12, 0.23, 0.16), lime, 0.18) * energyRibbon * smoothstep(1.35, 0.1, abs(p.x)) * 0.11;

    float particles = 0.0;
    float orangeParticles = 0.0;
    for (int i = 0; i < 18; i++) {
      float fi = float(i);
      float seed = hash(fi * 12.91 + 3.7);
      float speed = mix(0.018, 0.055, hash(fi * 4.17));
      float travel = fract(seed + uTime * speed + uMode * 0.019);
      vec2 particle = vec2(
        mix(-uAspect - 0.12, uAspect + 0.12, travel),
        sin((travel + seed) * 8.0 + fi) * 0.22 + mix(-0.54, 0.52, hash(fi * 8.3)) * 0.62
      );
      particle.y += sin(particle.x * 1.5 + uTime * 0.12) * 0.08;
      float visible = step(fi, mix(6.0, 18.0, uQuality));
      float spark = glowPoint(p, particle, 0.000018 + hash(fi) * 0.000012) * visible;
      particles += spark;
      orangeParticles += spark * step(0.82, hash(fi * 2.37));
    }
    color += lime * particles * 0.48;
    color += orange * orangeParticles * 0.82;

    float travel = fract(uTime * 0.095 + uMode * 0.07);
    vec2 energyPoint = vec2(mix(-uAspect * 0.72, uAspect * 0.74, travel), 0.0);
    energyPoint.y = sin(energyPoint.x * 1.8 + uTime * 0.13 + uMode * 0.27) * 0.18 - 0.03;
    float energyGlow = glowPoint(p, energyPoint, 0.000055);
    color += orange * min(energyGlow, 1.85) * (0.3 + uIntensity * 0.23);

    float pulseRadius = uPulse * 1.15;
    float pulseRing = lineMask(length(p - core) - pulseRadius, 0.008 + uPulse * 0.012);
    color += mix(lime, orange, smoothstep(0.48, 1.0, uIntensity)) * pulseRing * (1.0 - uPulse) * 0.52;

    float progressBeam = lineMask(p.y + 0.73, 0.002);
    float beamMask = 1.0 - smoothstep(uProgress - 0.03, uProgress + 0.03, uv.x);
    color += lime * progressBeam * beamMask * 0.18;

    color *= 0.92 + vignette * 0.08;
    gl_FragColor = vec4(color, 1.0);
  }
`;
