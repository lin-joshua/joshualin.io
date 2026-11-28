// Gargantua: the black hole beyond the tesseract.
//
// Far out past the lattice, in one direction, a black hole that spins almost
// as fast as a black hole can, with a thin disk of hot gas around it. The
// lattice is all but solid, so its light shows only in the odd gap, except
// in one place: from the anthology's hall, the lattice is cleared in a cone
// towards it (see bhCleared), and the reader who stands back to see the
// whole arc of bookcases sees Gargantua behind them.
//
// It is drawn as the physics says it would look:
//   - Light bends around it. Every ray is followed through the curved space
//     of a spinning black hole (the Kerr metric), so the far side of the
//     disk shows above and below the hole, the dark shadow is flattened on
//     one side by the spin, and thin rings of light hug the shadow.
//   - The gas orbits. The side coming towards the viewer is shifted blue and
//     is far brighter; the side going away is shifted red and dim
//     (Doppler beaming). Light climbing out of the hole's pull is shifted
//     red as well.
//   - Each ring of the disk glows as a blackbody at the temperature a thin
//     disk has at that radius (Novikov and Thorne's model), and orbits at its
//     own speed, so the pattern in the gas winds up into spirals.
// The disk is a few thousand kelvin at its hottest, like the surface of the
// Sun: the cool disk that the film's science adviser, Kip Thorne, gave
// Gargantua. The film itself left out the Doppler shifts, so that the disk
// looked even on both sides; here they are kept.
//
// How it is drawn. The hole is so far away that it does not shift as the
// view moves: like the Moon, it is always in the same direction. So what the
// hole looks like from here is the same picture from anywhere in the
// library. That picture is worked out once, a strip at a time over the first
// frames: for each point of it, where its ray came from (the disk, the hole,
// or empty space) and, on the disk, the radius and angle it came from and how
// much its light was shifted. Each frame then only looks the picture up, and
// lights it with the disk's moving pattern.
//
// The pages of text (the home page, the anthology) show the same hole
// from nearer in, and fall into it too: assets/js/sky.js, which uses the
// physics here.
//
// Leaving the library, the reader falls in (see createFall). Then the view
// moves towards the hole, and fast, so the picture no longer holds: each
// frame traces a ray for every pixel, from where the reader is and as fast
// as they are going. The hole grows; their own speed crowds what lies ahead
// into a smaller patch of sky and shifts its light blue (aberration, and the
// Doppler shift); and out of the lattice's haze the stars come out, their
// light bent round the hole.
//
// Units: lengths are in units of the hole's mass M (G = c = 1). The shadow
// of a hole that does not spin is 3√3 M ≈ 5.2 M in radius.

import * as THREE from "three";

// ---------- The black hole and its disk ----------
// a/M, from 0 to 1. A disk is thought to spin a hole up to about 0.998; the
// film's story asks for even nearer 1.
const SPIN = 0.999;
export const INCLINATION = 84 * Math.PI / 180;      // between the spin axis and the line of sight: nearly edge-on
const HORIZON = 1 + Math.sqrt(1 - SPIN * SPIN);
// The innermost orbit light can keep, turning with the hole: inside it,
// light heading in can only fall in (Bardeen, Press and Teukolsky 1972).
// For this spin it is barely outside the horizon, 1.053 M against 1.045 M.
const PHOTON_ORBIT = 2 * (1 + Math.cos(2 / 3 * Math.acos(-SPIN)));
// A ray is taken to have fallen in once it is between the two.
const CAPTURE = HORIZON + 0.4 * (PHOTON_ORBIT - HORIZON);
const DISK_IN = isco(SPIN);                  // the disk's inner edge: the innermost stable orbit
const DISK_OUT = 22;                         // its outer edge, where it fades out
const PEAK_KELVIN = 5800;                    // the disk's hottest ring
// The picture's half-width, in M, and how far off the hole seems, in M: the
// shadow, about 5 M in radius, then spans about 6.5 degrees each way.
const BOX = 26;
export const DISTANCE = 45;
// How long the picture is exposed for, as a photograph is: the gas coming
// towards the viewer burns out to white, and the cooler gas still shows.
export const EXPOSURE = 10;

// Kelvin range of the colour table.
const KELVIN_MIN = 300;
const KELVIN_MAX = 60000;

// The radius of the innermost stable circular orbit for spin a, prograde
// (Bardeen, Press and Teukolsky 1972).
function isco(a) {
  const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const z2 = Math.sqrt(3 * a * a + z1 * z1);
  return 3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
}

// The heat a thin disk gives off at radius r, up to a constant factor
// (Page and Thorne 1974). It is zero at the inner edge, peaks a little
// outside it, and falls as 1/r³ far out.
function diskFlux(r, a) {
  const x = Math.sqrt(r);
  const x0 = Math.sqrt(isco(a));
  const c = Math.acos(a) / 3;
  const x1 = 2 * Math.cos(c - Math.PI / 3);
  const x2 = 2 * Math.cos(c + Math.PI / 3);
  const x3 = -2 * Math.cos(c);
  const term = (xi, xj, xk) => 3 * (xi - a) ** 2 / (xi * (xi - xj) * (xi - xk)) * Math.log((x - xi) / (x0 - xi));
  const bracket = x - x0 - 1.5 * a * Math.log(x / x0) - term(x1, x2, x3) - term(x2, x1, x3) - term(x3, x1, x2);
  return Math.max(0, bracket / (x ** 4 * (x ** 3 - 3 * x + 2 * a)));
}

// The disk's temperature against radius, as a fraction of its hottest,
// over log r from the inner edge to the outer: a blackbody's heat goes as
// T⁴, so T goes as the fourth root of the flux.
export function temperatureTable(n) {
  const radii = Array.from({ length: n }, (_, i) => DISK_IN * (DISK_OUT / DISK_IN) ** (i / (n - 1)));
  const flux = radii.map((r) => diskFlux(r, SPIN));
  const peak = Math.max(...flux);
  const data = new Uint16Array(n * 4);
  radii.forEach((r, i) => {
    data[i * 4] = THREE.DataUtils.toHalfFloat((flux[i] / peak) ** 0.25);
    data[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  });
  return halfFloatTexture(data, n);
}

// The colour and brightness of a blackbody against its temperature, as the
// eye would see it, over log T. A blackbody's light, shifted by a factor g,
// is the light of a blackbody at g times the temperature, so this one table
// covers every shift. Linear sRGB, with 1 the brightness at PEAK_KELVIN.
// Colours outside what a screen can show are moved towards grey until they
// fit, keeping their brightness.
export function colourTable(n) {
  // The CIE 1931 colour matching functions, fitted with Gaussians (Wyman,
  // Sloan and Shirley 2013); l in nanometres.
  const lobe = (l, mu, s1, s2) => Math.exp(-0.5 * ((l - mu) / (l < mu ? s1 : s2)) ** 2);
  const cmf = (l) => [
    1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2),
    0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1),
    1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8)
  ];
  const xyz = (kelvin) => {
    const sum = [0, 0, 0];
    for (let l = 380; l <= 780; l += 5) {
      const planck = 1 / (l ** 5 * (Math.exp(1.4388e7 / (l * kelvin)) - 1));
      cmf(l).forEach((v, i) => { sum[i] += planck * v; });
    }
    return sum;
  };
  const reference = xyz(PEAK_KELVIN)[1];
  const data = new Uint16Array(n * 4);
  for (let i = 0; i < n; i++) {
    const kelvin = KELVIN_MIN * (KELVIN_MAX / KELVIN_MIN) ** (i / (n - 1));
    const [X, Y, Z] = xyz(kelvin).map((v) => v / reference);
    let rgb = [
      3.2406 * X - 1.5372 * Y - 0.4986 * Z,
      -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
      0.0557 * X - 0.2040 * Y + 1.0570 * Z
    ];
    const low = Math.min(...rgb);
    if (low < 0) rgb = rgb.map((v) => Y + (v - Y) * Y / (Y - low));
    rgb.forEach((v, c) => { data[i * 4 + c] = THREE.DataUtils.toHalfFloat(Math.min(60000, Math.max(0, v))); });
    data[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  return halfFloatTexture(data, n);
}

function halfFloatTexture(data, n) {
  const texture = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

// ---------- The viewer ----------
// Light is traced back from a viewer at a finite distance, who may be
// moving. Where the viewer is: Boyer–Lindquist r, θ and φ, with mu = cos θ.
// Its frame is that of the observer at rest there with no angular momentum
// (the "ZAMO", whom the hole's spin carries round), boosted by the viewer's
// own velocity in that frame. In the library the viewer is at rest at
// DISTANCE; falling in, it moves (see createFall).
function frameAt(r, mu) {
  const a2 = SPIN * SPIN;
  const sigma = r * r + a2 * mu * mu;
  const delta = r * r - 2 * r + a2;
  const big = (r * r + a2) ** 2 - a2 * delta * (1 - mu * mu);
  return {
    sigma,
    delta,
    lapse: Math.sqrt(sigma * delta / big),
    omega: 2 * SPIN * r / big,
    varpi: Math.sqrt(big / sigma * (1 - mu * mu))
  };
}

export function viewerUniforms() {
  return {
    uObsPlace: { value: new THREE.Vector4() },
    uObsFrame: { value: new THREE.Vector4() },
    uObsMotion: { value: new THREE.Vector4() },
    uObsGamma: { value: 1 }
  };
}

// A viewer at (r, mu, phi), moving at (vr, vth), as fractions of the speed of
// light, outwards and southwards, in the frame at rest there.
export function placeViewer(u, r, mu, phi, vr, vth) {
  const f = frameAt(r, mu);
  u.uObsPlace.value.set(r, mu, Math.sqrt(1 - mu * mu), phi);
  u.uObsFrame.value.set(f.lapse, f.omega, f.varpi, Math.sqrt(f.sigma / f.delta));
  u.uObsMotion.value.set(Math.sqrt(f.sigma), f.delta, vr, vth);
  u.uObsGamma.value = 1 / Math.sqrt(Math.max(1e-8, 1 - vr * vr - vth * vth));
}

// ---------- Tracing a ray ----------
// A ray the viewer sees is followed backwards from the viewer, in Mino time
// and in u = 1/r and mu = cos(theta), where the equations of motion of light
// around a spinning hole (Carter 1968) become
//   u'' = U'(u) / 2     U(u)  = (1 + (a² − aL) u²)² − K (u² − 2u³ + a²u⁴)
//   mu'' = M'(mu) / 2   M(mu) = Q − (Q + L² − a²) mu² − a² mu⁴
// with L and Q the ray's two constants (its angular momentum about the spin
// axis, and Carter's constant), for light of energy 1 far off, and
// K = Q + (L − a)². In this form nothing changes sign where the ray turns
// round, and nothing grows without bound.
//
// The ray's constants come from the direction it is seen in: its momentum
// in the viewer's frame is taken to the frame at rest by a Lorentz boost,
// and from there to the hole's coordinates. A viewer far off sees exactly
// what the picture showed when it was traced from infinity; at the library's
// distance, the shadow is about 1% smaller, and the light a little bluer
// (it gains energy falling to the viewer).
//
// It stops on the disk, inside the horizon, or once it is heading away with
// u below uEscape. Checked against a reference: the shadow of a hole that
// does not spin comes out 5.196 M in radius (3√3 = 5.196), and that of this
// one runs from −2.08 M to 7.0 M across, edge-on, as it should.
//
// It returns:
//   on the disk   (r, phi, T, limb):
//     r     the radius on the disk the ray came from
//     phi   the angle around the disk it came from, 0 to 2π, the way the
//           gas orbits
//     T     the temperature its light seems to have, as a fraction of the
//           hottest ring: the ring's own, times the shift g
//     limb  how much brighter the disk looks face-on than at a slant (an
//           atmosphere that scatters light, Chandrasekhar's 1 + 2.06 cos)
//   the hole      (−1, 0, 0, 0)
//   empty space   0, and in sky the direction the light came from, in the
//                 hole's frame (z along the spin axis), and in sky.w its
//                 shift: its energy on arrival over its energy far off.
export const KERR_GLSL = /* glsl */ `
  uniform sampler2D uTemperature;
  uniform vec4 uObsPlace;     // r, cos θ, sin θ, φ
  uniform vec4 uObsFrame;     // the frame at rest there: its lapse, its angular velocity, ϖ, √(Σ/Δ)
  uniform vec4 uObsMotion;    // √Σ, Δ, and the viewer's velocity in that frame: outwards, southwards
  uniform float uObsGamma;    // that velocity's Lorentz factor
  const float A = ${SPIN.toFixed(6)};
  const float R_IN = ${DISK_IN.toFixed(6)};
  const float R_OUT = ${DISK_OUT.toFixed(3)};
  const float U_HOLE = ${(1 / CAPTURE).toFixed(6)};
  const float U_AWAY = ${(1 / (DISK_OUT + 2)).toFixed(6)};
  const float U_FAR = 0.01;
  const int STEPS = 400;
  const float EPS = 0.05;
  const float TAU = 6.2831853;

  float L, K, C, S;

  // The rates of change of (u, u', mu, mu').
  vec4 rates(vec4 y) {
    float u = y.x, m = y.z;
    float au = 2.0 * S * u * (1.0 + S * u * u) - K * (u - 3.0 * u * u + 2.0 * A * A * u * u * u);
    float am = -C * m - 2.0 * A * A * m * m * m;
    return vec4(y.y, au, y.w, am);
  }
  // The rate of change of phi, for light going forwards in time.
  float turning(vec4 y) {
    float u = y.x;
    return A * (1.0 + S * u * u) / (1.0 - 2.0 * u + A * A * u * u) - A + L / max(1e-6, 1.0 - y.z * y.z);
  }

  // n is the direction seen, as (right, up, forward) in the viewer's frame:
  // right is the way the hole turns, up is north, forward is towards the hole.
  vec4 kerrTrace(vec3 n, float uEscape, out vec4 sky) {
    sky = vec4(0.0, 0.0, 1.0, 1.0);
    // The light arrives travelling against n. Its momentum in the viewer's
    // frame, with energy 1, along (r, θ, φ); then in the frame at rest.
    vec3 look = normalize(vec3(-n.z, -n.y, n.x));
    vec3 v = vec3(uObsMotion.zw, 0.0);
    float gamma = uObsGamma;
    float vn = dot(v, look);
    float energy = gamma * (1.0 - vn);
    vec3 p = -look + (gamma * gamma / (gamma + 1.0) * -vn + gamma) * v;
    // Its energy far off, E, its angular momentum and Carter's constant;
    // then scaled to energy 1.
    float lz = uObsFrame.z * p.z;
    float E = uObsFrame.x * energy + uObsFrame.y * lz;
    // Inside the ergosphere, light can have less than no energy far off.
    // Such light never comes from far off, but can from the inner disk.
    // It is followed as its reverse, which has energy above nought, forwards
    // in time; along the same path. back is 1 for light followed backwards
    // in time, as all of it is outside the ergosphere, and −1 otherwise.
    if (abs(E) < 1e-5) return vec4(-1.0, 0.0, 0.0, 0.0);
    float back = sign(E);
    float mu0 = uObsPlace.y, sin0 = uObsPlace.z;
    float pth = uObsMotion.x * p.y;
    float Q = (pth * pth + mu0 * mu0 * (lz * lz / (sin0 * sin0) - A * A * E * E)) / (E * E);
    L = lz / E;
    K = Q + (L - A) * (L - A);
    C = Q + L * L - A * A;
    S = A * A - A * L;
    float u0 = 1.0 / uObsPlace.x;
    vec4 y = vec4(u0, u0 * u0 * uObsMotion.y * uObsFrame.w * p.x / abs(E), mu0, sin0 * pth / abs(E));
    float most = 1.0 / (sqrt(L * L + max(Q, 0.0)) + 1.0);

    // turning is the rate of φ for light going forwards in time, so light
    // followed backwards came from the viewer's φ less phi.
    float phi = 0.0;
    vec4 result = vec4(-1.0, 0.0, 0.0, 0.0);
    for (int i = 0; i < STEPS; i++) {
      float h = EPS * min(y.x + 0.02, most);
      // Passing near the spin axis, a ray swings round it fast: shorter
      // steps there, a quarter of a radian round it at most.
      h = min(h, 0.25 * (1.0 - y.z * y.z) / max(abs(L), 1e-5));
      vec4 k1 = rates(y);
      float p1 = turning(y);
      vec4 y2 = y + 0.5 * h * k1;
      vec4 k2 = rates(y2);
      float p2 = turning(y2);
      vec4 y3 = y + 0.5 * h * k2;
      vec4 k3 = rates(y3);
      float p3 = turning(y3);
      vec4 y4 = y + h * k3;
      vec4 k4 = rates(y4);
      float p4 = turning(y4);
      vec4 next = y + h / 6.0 * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
      float nextPhi = phi + h / 6.0 * (p1 + 2.0 * p2 + 2.0 * p3 + p4);

      // Through the plane of the disk: on the disk, or through the gap
      // inside it, or past its edge.
      if (y.z * next.z < 0.0) {
        float t = y.z / (y.z - next.z);
        float r = 1.0 / mix(y.x, next.x, t);
        if (r > R_IN && r < R_OUT) {
          // The gas orbits at the speed of a circular orbit. emitted is
          // the light's shift from the gas to far off; the viewer adds
          // its own, 1 / E.
          float x = sqrt(r);
          float r15 = r * x;
          float omega = 1.0 / (r15 + A);
          float ut = (r15 + A) / (pow(r, 0.75) * sqrt(max(1e-6, r15 - 3.0 * x + 2.0 * A)));
          float emitted = 1.0 / (ut * (1.0 - omega * L));
          float along = log(r / R_IN) / log(R_OUT / R_IN);
          float kelvin = texture(uTemperature, vec2(along, 0.5)).r;
          float cosEmit = clamp(abs(emitted) * sqrt(max(Q, 0.0)) / r, 0.0, 1.0);
          float angle = mod(uObsPlace.w - back * mix(phi, nextPhi, t), TAU);
          result = vec4(r, angle, emitted / E * kelvin, (1.0 + 2.06 * cosEmit) / 2.03);
          break;
        }
      }
      y = next;
      phi = nextPhi;
      if (y.x > U_HOLE) break;
      if (y.y < 0.0 && y.x < uEscape) {
        // Far off and heading away: the way it is going is, near enough,
        // the way it came from.
        float mu = clamp(y.z, -0.99999, 0.99999);
        float st = sqrt(1.0 - mu * mu);
        float ph = uObsPlace.w - back * phi;
        float u = max(y.x, 1e-6);
        vec3 er = vec3(st * cos(ph), st * sin(ph), mu);
        vec3 et = vec3(mu * cos(ph), mu * sin(ph), -st);
        vec3 ep = vec3(-sin(ph), cos(ph), 0.0);
        vec3 way = -y.y / (u * u) * er + (-y.w / st * et - back * st * turning(y) * ep) / u;
        sky = vec4(normalize(way), 1.0 / E);
        result = vec4(0.0);
        break;
      }
    }
    return result;
  }
`;

export const TRACE_VERTEX = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// The picture, for the viewer at rest in the library: each texel is a point
// on the sky around the hole, at (alpha, beta) / DISTANCE across, as
// gargantua() below looks it up.
const TRACE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uSize;
  ${KERR_GLSL}
  const float BOX = ${BOX.toFixed(3)};
  const float DISTANCE = ${DISTANCE.toFixed(3)};
  void main() {
    vec2 ab = (gl_FragCoord.xy / uSize * 2.0 - 1.0) * BOX;
    vec4 sky;
    gl_FragColor = kerrTrace(vec3(ab / DISTANCE, 1.0), U_AWAY, sky);
  }
`;

// ---------- Lighting the disk ----------
// bhLight(hit) is the light of a point of the disk that kerrTrace found,
// linear and before exposure. It needs uTime and uNoise.
export const LIGHT_GLSL = /* glsl */ `
  uniform sampler2D uBHColour;
  const float BH_SPIN = ${SPIN.toFixed(6)};
  const float BH_KELVIN = ${PEAK_KELVIN.toFixed(1)};
  const float BH_LOG_MIN = ${Math.log(KELVIN_MIN).toFixed(6)};
  const float BH_LOG_SPAN = ${Math.log(KELVIN_MAX / KELVIN_MIN).toFixed(6)};
  const float BH_R_OUT = ${DISK_OUT.toFixed(3)};
  // The disk's pattern moves at uTime times this, in M per second, and
  // starts afresh every BH_CYCLE M, fading across, so that the spirals the
  // orbits wind it into never grow finer than the picture can show.
  const float BH_PACE = 1.6;
  const float BH_CYCLE = 90.0;

  // How bright the gas is at a point of the disk, around 1: clumps and
  // streaks, carried round by each ring at its own orbital speed.
  float bhGas(float r, float phi) {
    float omega = 1.0 / (r * sqrt(r) + BH_SPIN);
    float t = uTime * BH_PACE;
    float lr = log(r);
    float sum = 0.0;
    for (int k = 0; k < 2; k++) {
      float cycle = t / BH_CYCLE + float(k) * 0.5;
      float phase = fract(cycle);
      float weight = 1.0 - abs(2.0 * phase - 1.0);
      float psi = phi - omega * phase * BH_CYCLE;
      vec3 p = vec3(cos(psi) * 4.0, sin(psi) * 4.0, lr * 7.0) + floor(cycle) * vec3(5.3, 9.1, 3.7);
      float n = texture(uNoise, p / 32.0).r * 0.6 + texture(uNoise, (p * 2.7 + 11.0) / 32.0).r * 0.4;
      sum += weight * n;
    }
    return 0.25 + 1.5 * sum * sum;
  }

  // The colour of a blackbody at kelvin, linear, with 1 the brightness at
  // the disk's hottest.
  vec3 bhBlackbody(float kelvin) {
    return texture(uBHColour, vec2((log(kelvin) - BH_LOG_MIN) / BH_LOG_SPAN, 0.5)).rgb;
  }

  vec3 bhLight(vec4 hit) {
    float kelvin = hit.z * BH_KELVIN;
    if (kelvin < 300.0) return vec3(0.0);
    float edge = 1.0 - smoothstep(BH_R_OUT * 0.7, BH_R_OUT, hit.x);
    return bhBlackbody(kelvin) * hit.w * edge * bhGas(hit.x, hit.y);
  }
`;

// ---------- The stars, falling in ----------
// Out of the lattice, beyond its haze, the sky is dark and full of stars,
// and the hole's pull bends their light: they crowd round the shadow and
// show twice, once on each side, and brighten where the hole magnifies the
// sky. Each star is a point on the sky, in cells of a cube around the hole,
// one star to a cell. bhStars(d, dx, dy, shift) is the light reaching a
// pixel whose ray came from direction d; dx and dy are how far that
// direction moves from one pixel to the next. From them, a star's place on
// the sky is turned back into a place on the screen, where it is drawn as a
// point a pixel across, with all of its light: the star's own light over
// the sky one pixel covers there. So however the hole stretches the sky,
// a star stays a point, and is as much brighter as the sky around it is
// magnified. Each star is a blackbody, and its light is shifted as the
// disk's is.
export const STARS_GLSL = /* glsl */ `
  vec4 bhHash(uvec3 v) {
    uvec4 q = uvec4(v, v.x ^ v.y ^ v.z) * uvec4(1597334673u, 3812015801u, 2798796415u, 1979697957u);
    q = (q.yzwx ^ (q >> 16u)) * 2246822519u;
    q = (q.zwxy ^ (q >> 13u)) * 3266489917u;
    q ^= q >> 16u;
    return vec4(q) * (1.0 / 4294967296.0);
  }
  vec3 bhFaceDir(float face, vec2 st) {
    if (face < 0.5) return vec3(1.0, st);
    if (face < 1.5) return vec3(-1.0, st);
    if (face < 2.5) return vec3(st.y, 1.0, st.x);
    if (face < 3.5) return vec3(st.y, -1.0, st.x);
    if (face < 4.5) return vec3(st, 1.0);
    return vec3(st, -1.0);
  }
  vec3 bhStars(vec3 d, vec3 dx, vec3 dy, float shift) {
    // The sky one pixel covers, and the map from the screen to the sky.
    float covers = max(length(cross(dx, dy)), 1e-14);
    mat2 gram = mat2(dot(dx, dx), dot(dx, dy), dot(dx, dy), dot(dy, dy));
    if (abs(determinant(gram)) < 1e-28) return vec3(0.0);
    mat2 back = inverse(gram);
    vec3 a = abs(d);
    float face;
    vec2 st;
    if (a.x >= a.y && a.x >= a.z) { face = d.x > 0.0 ? 0.0 : 1.0; st = d.yz / a.x; }
    else if (a.y >= a.z) { face = d.y > 0.0 ? 2.0 : 3.0; st = d.zx / a.y; }
    else { face = d.z > 0.0 ? 4.0 : 5.0; st = d.xy / a.z; }
    vec3 sum = vec3(0.0);
    for (int layer = 0; layer < 2; layer++) {
      float cells = layer == 0 ? 36.0 : 100.0;
      vec2 cell = floor((st * 0.5 + 0.5) * cells);
      vec4 h = bhHash(uvec3(ivec3(cell, int(face) + 6 * layer) + 4096));
      // Kept off the cell's edges, so that its light stays in the cell.
      vec2 at = (cell + 0.25 + 0.5 * h.xy) / cells * 2.0 - 1.0;
      vec3 star = normalize(bhFaceDir(face, at));
      vec3 off = star - d;
      vec2 pixels = back * vec2(dot(dx, off), dot(dy, off));
      // Many faint stars, few bright ones; from 3000 to 12000 kelvin.
      float flux = (layer == 0 ? 8.0e-7 : 2.0e-7) * pow(h.z, 14.0);
      float kelvin = 3000.0 * pow(4.0, h.w);
      float seen = flux / covers * exp(-dot(pixels, pixels) / 0.72) / 2.26;
      vec3 own = bhBlackbody(kelvin);
      sum += seen * bhBlackbody(kelvin * shift) / max(1e-6, dot(own, vec3(0.2126, 0.7152, 0.0722)));
    }
    return sum;
  }
`;

// Falling in, the hole is traced afresh every frame, a ray for each pixel,
// from where the viewer is and as fast as it is going. Its output is the
// light (linear, before exposure) and, in alpha, 1 for the hole.
const LIVE_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp int;
  uniform highp sampler3D uNoise;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform mat4 uProjInv;
  uniform mat4 uCamWorld;
  uniform mat3 uBHAxes;
  uniform float uBHOut;
  ${KERR_GLSL}
  ${LIGHT_GLSL}
  ${STARS_GLSL}
  void main() {
    vec2 ndc = gl_FragCoord.xy / uResolution * 2.0 - 1.0;
    vec4 v = uProjInv * vec4(ndc, 1.0, 1.0);
    vec3 dir = normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
    vec4 sky;
    vec4 hit = kerrTrace(dir * uBHAxes, U_FAR, sky);
    // How far the direction the light came from moves from one pixel to
    // the next.
    vec3 dx = dFdx(sky.xyz);
    vec3 dy = dFdy(sky.xyz);
    vec3 light = vec3(0.0);
    if (hit.x > 0.5) light = bhLight(hit);
    else if (hit.x > -0.5 && uBHOut > 0.0) light = bhStars(sky.xyz, dx, dy, sky.w) * uBHOut;
    gl_FragColor = vec4(min(light, vec3(4000.0)), hit.x < -0.5 ? 1.0 : 0.0);
  }
`;

// ---------- Lighting the picture, every frame ----------
// GLSL for the structure shader (shaders.js): gargantua(dir, haze) is the
// light from far off along dir, in place of the plain haze, and
// bhCleared(cell) whether a cell of the lattice is cleared away for the
// opening towards it. It needs the structure shader's uTime and uNoise.
export const GARGANTUA_GLSL = /* glsl */ `
  uniform sampler2D uBHPicture;
  uniform mat3 uBHAxes;           // columns: the picture's right, its up, and towards the hole
  uniform float uBHShow;          // 0 to 1, as it fades in once traced
  uniform float uBHExposure;
  uniform vec4 uBHOpening;        // where the opening starts (xyz), and the cosine of its half-angle
  uniform float uBHCell;          // a cell's side
  // Falling in: the hole traced afresh, at the structure's own resolution,
  // and how far out of the lattice the viewer is, 0 to 1, as its haze gives
  // way to the dark.
  uniform sampler2D uBHLive;
  uniform float uBHLiveOn;
  uniform float uBHOut;

  ${LIGHT_GLSL}

  // Whether this pixel's ray passes near the opening at all; set once per
  // pixel by bhNearOpening, so that the many rays that do not are spared
  // the test at every wall.
  bool bhNear = false;

  // Whether a cell is cleared: its middle is inside a cone that starts at
  // the opening's start and widens towards the hole. Walls between two
  // cleared cells, and blocks inside one, are not there; the walls around
  // the cleared cells stay, and line the opening's sides.
  bool bhCleared(ivec3 cell) {
    if (!bhNear) return false;
    vec3 d = (vec3(cell) + 0.5) * uBHCell - uBHOpening.xyz;
    float along = dot(d, uBHAxes[2]);
    return along > uBHCell && along * along > uBHOpening.w * uBHOpening.w * dot(d, d);
  }

  // Whether the ray from o along unit dir, up to far, comes inside a cone
  // that holds every cell bhCleared could clear: the opening's cone, moved
  // back along its axis so that its sides stand half a cell's diagonal
  // further out. Along a line, the inside of a double cone is at most two
  // stretches, each ending where the line meets the cone or at an end of
  // the ray; the forward cone is the half where the axis points away from
  // the apex. So looking at both ends, and between the two meetings, is
  // enough.
  bool bhNearOpening(vec3 o, vec3 dir, float far) {
    float c = uBHOpening.w;
    if (c > 1.0) return false;
    vec3 axis = uBHAxes[2];
    float back = 0.87 * uBHCell / sqrt(max(1e-4, 1.0 - c * c));
    vec3 v = o - (uBHOpening.xyz - axis * back);
    float dv = dot(v, axis), dd = dot(dir, axis);
    float qa = dd * dd - c * c;
    float qb = 2.0 * (dv * dd - c * c * dot(v, dir));
    float qc = dv * dv - c * c * dot(v, v);
    #define BH_INSIDE(t) (qa * (t) * (t) + qb * (t) + qc >= 0.0 && dv + dd * (t) > 0.0)
    if (BH_INSIDE(0.0) || BH_INSIDE(far)) return true;
    float disc = qb * qb - 4.0 * qa * qc;
    if (disc < 0.0 || abs(qa) < 1e-6) return false;
    float root = sqrt(disc);
    float t1 = clamp((-qb - root) / (2.0 * qa), 0.0, far);
    float t2 = clamp((-qb + root) / (2.0 * qa), 0.0, far);
    float mid = 0.5 * (t1 + t2);
    return BH_INSIDE(mid);
    #undef BH_INSIDE
  }

  const float BH_DISTANCE = ${DISTANCE.toFixed(3)};
  const float BH_BOX = ${BOX.toFixed(3)};

  // One texel of the picture: its light (linear), and 1 if it is the hole.
  vec4 bhTexel(ivec2 at) {
    vec4 hit = texelFetch(uBHPicture, at, 0);
    if (hit.x < -0.5) return vec4(0.0, 0.0, 0.0, 1.0);
    if (hit.x < 0.5) return vec4(0.0);
    return vec4(bhLight(hit), 0.0);
  }

  vec3 gargantua(vec3 dir, vec3 haze) {
    if (uBHShow <= 0.0) return haze;
    vec4 s;
    if (uBHLiveOn > 0.5) {
      // Falling in: this pixel's own ray, traced this frame.
      s = texelFetch(uBHLive, ivec2(gl_FragCoord.xy), 0);
    } else {
      vec3 q = dir * uBHAxes;
      if (q.z <= 0.0) return haze;
      vec2 ab = q.xy / q.z * BH_DISTANCE;
      if (abs(ab.x) >= BH_BOX || abs(ab.y) >= BH_BOX) return haze;
      // Each of the four nearest texels is lit, then blended: blending what
      // they hold (a radius, an angle) would make light where there is none.
      ivec2 size = textureSize(uBHPicture, 0);
      vec2 st = (ab / BH_BOX * 0.5 + 0.5) * vec2(size) - 0.5;
      ivec2 i0 = ivec2(floor(st));
      vec2 f = st - floor(st);
      ivec2 hi = size - 1;
      vec4 s00 = bhTexel(clamp(i0, ivec2(0), hi));
      vec4 s10 = bhTexel(clamp(i0 + ivec2(1, 0), ivec2(0), hi));
      vec4 s01 = bhTexel(clamp(i0 + ivec2(0, 1), ivec2(0), hi));
      vec4 s11 = bhTexel(clamp(i0 + ivec2(1, 1), ivec2(0), hi));
      s = mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
    }
    // Exposed like a photograph: the hottest gas burns out to white, and the
    // cool outer disk still shows.
    vec3 light = pow(1.0 - exp(-uBHExposure * s.rgb), vec3(1.0 / 2.2));
    // The hole hides the faint light from beyond it, part of the haze; out
    // of the lattice, all of what is behind it.
    return haze * (1.0 - mix(0.45, 1.0, uBHOut) * s.a * uBHShow) + light * uBHShow;
  }
`;

// ---------- Falling in ----------
// Leaving the library, the reader falls into the hole: from rest at the
// library's distance, DISTANCE, with no angular momentum, as a stone let go
// would. Leaving a page of text (sky.js), they fall the same way from where
// that page stands, nearer in. The path is followed in Mino time, as the
// light's is:
//   r'' = R'(r) / 2      R(r)  = E²(r² + a²)² − Δ (r² + a²E² + Q)
//   mu'' = Z'(mu) / 2    Z(mu) = (1 − mu²)(Q − a²(1 − E²) mu²)
//   τ' = Σ,  φ' = 2aEr / Δ
// with E its energy (that of the observer at rest there, the lapse) and Q
// chosen so that it sets off with θ still. The spin pulls it a fifth of a
// degree towards the equator on the way down, and drags it round the hole,
// faster and faster near the horizon (φ').
//
// Its own time, τ, runs 334 M from the library to the horizon: for a hole
// of Gargantua's mass, about two days. It is shown sped up, and not evenly:
// at first time runs as fast as it can, so that the fall is seen to gather
// speed from rest; nearer the hole it slows, dτ/dt going as
// 1 / (1 + (KNEE / r)^1.5), so that the last plunge, which takes a hundredth
// of the time, can be seen at all. The fall from the library is shown in
// FALL_SECONDS; a fall from nearer in is shown at the same pace, and so
// takes less time. What the viewer sees at each point of the path is as the
// physics says; only how fast the path is played is chosen. The path ends at
// END, just outside the horizon (1.045 M), by when the view has gone dark.
const FALL_SECONDS = 4.6;
const FALL_KNEE = 20;
const FALL_END = 1.25;

// The path of a fall from rest at r0: along it, the time shown (before it is
// scaled to seconds), r, mu, φ, and the rates of r and mu.
function fallPath(r0) {
  const a = SPIN;
  const mu0 = Math.cos(INCLINATION);
  const E = frameAt(r0, mu0).lapse;
  const c = a * a * (1 - E * E);
  const Q = mu0 * mu0 * c;
  const rates = (r, dr, mu, dmu) => {
    const delta = r * r - 2 * r + a * a;
    const k = r * r + a * a * E * E + Q;
    return [
      dr,
      0.5 * (4 * E * E * r * (r * r + a * a) - (2 * r - 2) * k - 2 * r * delta),
      dmu,
      -mu * (Q - c * mu * mu) - c * mu * (1 - mu * mu),
      r * r + a * a * mu * mu,
      2 * a * E * r / delta
    ];
  };
  const time = [0], R = [r0], MU = [mu0], PHI = [0], DR = [0], DMU = [0];
  let s = [r0, 0, mu0, 0, 0, 0];
  let shown = 0;
  while (s[0] > FALL_END) {
    const h = 0.008 / (s[0] * Math.sqrt(s[0]));
    const k1 = rates(...s.slice(0, 4));
    const k2 = rates(...s.slice(0, 4).map((v, i) => v + h / 2 * k1[i]));
    const k3 = rates(...s.slice(0, 4).map((v, i) => v + h / 2 * k2[i]));
    const k4 = rates(...s.slice(0, 4).map((v, i) => v + h * k3[i]));
    const next = s.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    const middle = (s[0] + next[0]) / 2;
    shown += (next[4] - s[4]) * (1 + (FALL_KNEE / middle) ** 1.5);
    s = next;
    time.push(shown);
    R.push(s[0]);
    MU.push(s[2]);
    PHI.push(s[5]);
    DR.push(s[1]);
    DMU.push(s[3]);
  }
  return { E, shown, time, R, MU, PHI, DR, DMU };
}

// Seconds shown per unit of the time shown above: the library's pace.
let pace = null;

// A fall from rest at from, by default the library's distance.
export function createFall(from = DISTANCE) {
  const path = fallPath(from);
  if (pace === null) pace = FALL_SECONDS / (from === DISTANCE ? path : fallPath(DISTANCE)).shown;
  const { E, time, R, MU, PHI, DR, DMU } = path;
  for (let i = 0; i < time.length; i++) time[i] *= pace;

  // Where the viewer is t seconds in, and how fast it is going in the frame
  // at rest there.
  function at(t) {
    let lo = 0, hi = time.length - 1;
    t = Math.min(Math.max(t, 0), time[hi]);
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (time[mid] <= t) lo = mid;
      else hi = mid;
    }
    const k = (t - time[lo]) / Math.max(1e-9, time[hi] - time[lo]);
    const mix = (list) => list[lo] + (list[hi] - list[lo]) * k;
    const r = mix(R), mu = mix(MU), phi = mix(PHI);
    const f = frameAt(r, mu);
    const gamma = E / f.lapse;
    const ur = mix(DR) / Math.sqrt(f.sigma * f.delta);
    const uth = -mix(DMU) / Math.sqrt(1 - mu * mu) / Math.sqrt(f.sigma);
    return { r, mu, phi, vr: ur / gamma, vth: uth / gamma, fallen: from - r };
  }
  return { seconds: time[time.length - 1], at, from, end: FALL_END };
}

// ---------- The picture, traced a strip at a time ----------
// cell is the side of a cell of the lattice, for the opening. Falling in
// also needs the structure's view (its uProjInv and uCamWorld), the
// space's clock and noise, and the uniform for how far out of the lattice
// the viewer is.
export function createGargantua(renderer, { small, cell, view, time, noise, out }) {
  const N = small ? 512 : 1024;
  const ROWS = small ? 32 : 48;
  const picture = new THREE.WebGLRenderTarget(N, N, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false
  });
  const temperature = temperatureTable(512);
  const colour = colourTable(256);
  const still = viewerUniforms();
  placeViewer(still, DISTANCE, Math.cos(INCLINATION), 0, 0, 0);
  const traceScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: Object.assign({ uSize: { value: N }, uTemperature: { value: temperature } }, still),
    depthTest: false,
    depthWrite: false,
    vertexShader: TRACE_VERTEX,
    fragmentShader: TRACE_FRAGMENT
  }));
  quad.frustumCulled = false;
  traceScene.add(quad);
  const traceCamera = new THREE.Camera();

  // Falling in: the hole traced every frame, at the structure's resolution.
  const live = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false
  });

  const uniforms = {
    uBHPicture: { value: picture.texture },
    uBHColour: { value: colour },
    uBHAxes: { value: new THREE.Matrix3() },
    uBHShow: { value: 0 },
    uBHExposure: { value: EXPOSURE },
    // Until open() is called, no cell is cleared: a cosine above 1.
    uBHOpening: { value: new THREE.Vector4(0, 0, 0, 2) },
    uBHCell: { value: cell },
    uBHLive: { value: live.texture },
    uBHLiveOn: { value: 0 },
    uBHOut: out
  };

  const moving = viewerUniforms();
  const liveScene = new THREE.Scene();
  const liveQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: Object.assign({
      uTemperature: { value: temperature },
      uBHColour: uniforms.uBHColour,
      uBHAxes: uniforms.uBHAxes,
      uBHOut: out,
      uNoise: { value: noise },
      uTime: time,
      uResolution: { value: new THREE.Vector2(1, 1) },
      uProjInv: view.uProjInv,
      uCamWorld: view.uCamWorld
    }, moving),
    depthTest: false,
    depthWrite: false,
    vertexShader: TRACE_VERTEX,
    fragmentShader: LIVE_FRAGMENT
  }));
  liveQuad.frustumCulled = false;
  liveScene.add(liveQuad);

  // Where the viewer falling in is, and how fast it is going: a state from
  // createFall's at().
  function follow(state) {
    placeViewer(moving, state.r, state.mu, state.phi, state.vr, state.vth);
  }

  // Traces the hole for this frame, width by height, before the structure
  // is drawn.
  function drawLive(width, height) {
    if (live.width !== width || live.height !== height) live.setSize(width, height);
    liveQuad.material.uniforms.uResolution.value.set(width, height);
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(live);
    renderer.render(liveScene, traceCamera);
    renderer.setRenderTarget(previous);
  }

  // Which way the hole is, and which way its spin axis points, roughly.
  const forward = new THREE.Vector3();
  const up = new THREE.Vector3();
  const right = new THREE.Vector3();
  function aim(towards, axis = new THREE.Vector3(0, 1, 0)) {
    forward.copy(towards).normalize();
    up.copy(axis).addScaledVector(forward, -axis.dot(forward)).normalize();
    right.crossVectors(forward, up);
    uniforms.uBHAxes.value.set(
      right.x, up.x, forward.x,
      right.y, up.y, forward.y,
      right.z, up.z, forward.z
    );
  }

  // The opening: the lattice cleared in a cone from start towards the hole,
  // halfAngle (radians) about the line to it.
  function open(start, halfAngle) {
    uniforms.uBHOpening.value.set(start.x, start.y, start.z, Math.cos(halfAngle));
  }

  let row = 0;
  // Traces the next strip; afterwards fades the hole in. Whether anything
  // changed, so the structure is drawn again.
  function step(dt, instant) {
    if (row < N) {
      const autoClear = renderer.autoClear;
      const previous = renderer.getRenderTarget();
      renderer.autoClear = false;
      picture.scissor.set(0, row, N, Math.min(ROWS, N - row));
      picture.scissorTest = true;
      renderer.setRenderTarget(picture);
      renderer.render(traceScene, traceCamera);
      renderer.setRenderTarget(previous);
      renderer.autoClear = autoClear;
      row += ROWS;
      if (row >= N) picture.scissorTest = false;
      return false;
    }
    if (uniforms.uBHShow.value < 1) {
      uniforms.uBHShow.value = instant ? 1 : Math.min(1, uniforms.uBHShow.value + dt / 2.5);
      return true;
    }
    return false;
  }

  return {
    uniforms, step, aim, open, follow, drawLive,
    forward, up, right,
    get traced() { return row >= N; }
  };
}
