// The sky behind the pages of text (the home page and the anthology):
// Gargantua, the black hole beyond the library, seen from nearer in.
//
// The library sees the hole from 45 M away (M is its mass, as a length),
// through a gap in the lattice. The pages of text stand at rest 26 M from
// it, on the same line of sight, in open space: just outside the edge of its
// disk and 2.7 M above the disk's plane. The shadow looks nearly twice as
// wide as from the library, the disk spans the whole view, and the stars
// all around are bent round the hole. The hole, its disk and the camera's
// exposure are the library's own (gargantua.js): the same black hole,
// closer.
//
// How it is drawn. The viewer is at rest, so where each pixel's light comes
// from never changes: that is traced once, a strip at a time over the first
// frames, a ray for every pixel through the curved space of the spinning
// hole, and again only when the window changes size. (The sky is as tall as
// the window at its tallest, so a phone's toolbars coming and going do not
// change it; see site.css.) Each strip is as large as the graphics chip can
// trace in a frame without holding up the page. For each pixel it
// keeps the point of the disk its light left, the hole, or, for empty sky,
// the light of the stars there (which do not move). Each frame then only
// lights the disk's gas, which orbits, at 30 frames a second. With reduced
// motion the gas stands still, and the sky is drawn only when it changes.
//
// The words stay readable. Behind the column of text, the picture's
// brightest light is held down, the bright gas most and the faint stars
// hardly at all, so the words always stand out by at least 6.8 to 1; beyond
// the column, and below the text on a short page, the hole is as bright as
// the camera's exposure shows it.
//
// Leaving the page for another page of the site, the reader falls into the
// hole, as from the library: they turn
// to face it and fall from rest, each frame tracing a ray for every pixel
// from where they are and as fast as they are going, until the view goes
// dark at the horizon. The fall is shown at the library's pace, and from
// here takes about 3 seconds. A click or a key skips to the end; with
// reduced motion the view only fades.
//
// Without WebGL 2, the page keeps the still night sky of starfield.js.

import * as THREE from "three";
import {
  EXPOSURE, INCLINATION, KERR_GLSL, LIGHT_GLSL, STARS_GLSL, TRACE_VERTEX,
  colourTable, createFall, placeViewer, temperatureTable, viewerUniforms
} from "./gargantua.js";

THREE.ColorManagement.enabled = false;

const root = document.documentElement;
// ?debug: window.__sky holds fallIn and land, and DEBUG.fallTime holds the
// fall at that moment, in seconds.
const DEBUG = new URLSearchParams(location.search).has("debug") ? { fallTime: null } : null;
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduceMotion = motionQuery.matches;

// ---------- Where the viewer stands, and the camera ----------
// At rest, 26 M from the hole, on the same line of sight as the library.
const DISTANCE = 26;
// The view is at least this many degrees high, and this many wide, so that
// on a phone held upright the hole and the bright arc of its disk still fit.
const MIN_HEIGHT = 52;
const MIN_WIDTH = 66;
// The camera looks a little above the hole, so that the hole sits below the
// middle of the window, under the opening lines of a page; as a fraction of
// the half-height.
const HOLE_DROP = 0.22;
// Pixels per CSS pixel. At rest the picture is drawn at up to 1.5: the thin
// rings of light that hug the shadow stay sharp, and a frame costs little,
// as it only looks the picture up. Falling, every pixel is traced every
// frame, at no more than 1, as the library's fall is.
const REST_DENSITY = Math.min(window.devicePixelRatio || 1, 1.5);
const FALL_DENSITY = Math.min(window.devicePixelRatio || 1, 1);

// ---------- Keeping frames short ----------
// While the picture is traced, and while falling, a frame should take no
// more than FRAME_BUDGET milliseconds (30 frames a second), however slow the
// graphics chip. An old phone's chip can be a hundred times slower than a
// desktop's. A frame that runs long also holds up the browser's own drawing
// of the page, so that text scrolled into view shows late.
const FRAME_BUDGET = 1000 / 30;
// A frame is late once it takes this many times the budget.
const LATE = 1.15;
// How many pixels are traced in a frame while the picture is made: at first
// TRACE_START, then twice as many after each frame that kept to the budget,
// until one is late; then fewer, in proportion, and no more growth (see
// tune).
const TRACE_START = 1 << 16;
const TRACE_MIN = 1 << 14;
const TRACE_MAX = 1 << 21;

// ---------- The words over it ----------
// Behind the column of text, a colour's brightest channel c (0 to 1, as
// shown) becomes c / (1 + c (1 / CAP − 1)): faint light is kept, and the
// brightest is held to CAP. The text, #e8e6df, then stands out by at least
// 6.8 to 1. FEATHER is how far, in CSS pixels, the hold fades out beyond
// the column.
const CAP = 0.3;
const FEATHER = 72;

// ---------- Idle ----------
// A minute after the reader last did anything, the gas slows to a
// standstill over a few seconds, and then nothing is drawn; anything they do
// sets it going again, up to speed in under a second.
const IDLE_AFTER = 60000;       // ms without input
const SLOW_DOWN = 3;            // s to come to a standstill
const SPEED_UP = 0.8;           // s to get going again

// ---------- Falling in ----------
const FALL_TURN = 1.1;          // s to turn and face the hole, as in the library
const TEXT_FADE = 0.45;         // s, as the words fade (site.css, .is-falling)

const SKY_GLSL = /* glsl */ `
  uniform vec4 uText;           // the column of text: left, bottom, right, top, in pixels
  uniform float uFeather;
  uniform float uTextShow;      // 1 while the words show; 0 once they have faded
  const float EXPOSURE = ${EXPOSURE.toFixed(3)};
  const float CAP = ${CAP.toFixed(3)};

  // Exposed as the library exposes it, like a photograph: the hottest gas
  // burns out to white, and the cool outer disk still shows.
  vec3 expose(vec3 light) {
    return pow(1.0 - exp(-EXPOSURE * light), vec3(1.0 / 2.2));
  }

  // Behind the words, the brightest light held down (see CAP).
  vec3 behindText(vec3 c) {
    vec2 p = gl_FragCoord.xy;
    vec2 outside = max(max(uText.xy - p, p - uText.zw), 0.0);
    float m = (1.0 - smoothstep(0.0, uFeather, length(outside))) * uTextShow;
    float peak = max(c.r, max(c.g, c.b));
    float held = peak / (1.0 + peak * (1.0 / CAP - 1.0));
    return c * mix(1.0, held / max(peak, 1e-5), m);
  }

  // The direction a pixel looks in, in the viewer's frame: (right, up,
  // towards the hole), as kerrTrace takes it.
  uniform vec2 uSize;           // what is drawn, in pixels
  uniform vec2 uTan;            // tangents of half the view's width and height
  uniform mat3 uView;           // the camera's right, up and forward
  vec3 looking() {
    vec2 ndc = gl_FragCoord.xy / uSize * 2.0 - 1.0;
    return normalize(uView * vec3(ndc * uTan, 1.0));
  }
`;

// The picture, traced once: for each pixel, (r, φ, T, limb) of the point of
// the disk its light left (see kerrTrace), (−1, 0, 0, 0) for the hole, or
// (0, the stars' light) for empty sky.
const TRACE_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp int;
  uniform highp sampler3D uNoise;
  uniform float uTime;
  ${KERR_GLSL}
  ${LIGHT_GLSL}
  ${STARS_GLSL}
  ${SKY_GLSL}
  void main() {
    vec4 sky;
    vec4 hit = kerrTrace(looking(), U_FAR, sky);
    vec3 dx = dFdx(sky.xyz);
    vec3 dy = dFdy(sky.xyz);
    if (hit.x > -0.5 && hit.x < 0.5) hit = vec4(0.0, min(bhStars(sky.xyz, dx, dy, sky.w), vec3(4000.0)));
    gl_FragColor = hit;
  }
`;

// Each frame at rest: the picture, lit.
const LIGHT_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp int;
  uniform highp sampler3D uNoise;
  uniform float uTime;
  uniform sampler2D uPicture;
  uniform vec2 uPictureScale;   // the picture's size over what is drawn, while a new one is traced
  ${LIGHT_GLSL}
  ${SKY_GLSL}
  void main() {
    ivec2 last = textureSize(uPicture, 0) - 1;
    vec4 hit = texelFetch(uPicture, clamp(ivec2(gl_FragCoord.xy * uPictureScale), ivec2(0), last), 0);
    vec3 light = hit.x > 0.5 ? bhLight(hit) : hit.x > -0.5 ? hit.yzw : vec3(0.0);
    gl_FragColor = vec4(behindText(expose(light)), 1.0);
  }
`;

// Falling: every pixel traced afresh, from where the viewer is and as fast
// as it is going.
const FALL_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp int;
  uniform highp sampler3D uNoise;
  uniform float uTime;
  ${KERR_GLSL}
  ${LIGHT_GLSL}
  ${STARS_GLSL}
  ${SKY_GLSL}
  void main() {
    vec4 sky;
    vec4 hit = kerrTrace(looking(), U_FAR, sky);
    vec3 dx = dFdx(sky.xyz);
    vec3 dy = dFdy(sky.xyz);
    vec3 light = vec3(0.0);
    if (hit.x > 0.5) light = bhLight(hit);
    else if (hit.x > -0.5) light = bhStars(sky.xyz, dx, dy, sky.w);
    gl_FragColor = vec4(behindText(expose(min(light, vec3(4000.0)))), 1.0);
  }
`;

// The noise the disk's gas is drawn from, as in the library: a small tiling
// block of random values that the graphics chip blends between.
function noiseBlock() {
  const N = 32;
  const data = new Uint8Array(N * N * N);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(Math.random() * 256);
  const texture = new THREE.Data3DTexture(data, N, N, N);
  texture.format = THREE.RedFormat;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

const ease = (t) => t * t * (3 - 2 * t);
const smoothstep = (x, a, b) => ease(Math.min(1, Math.max(0, (x - a) / (b - a))));

function createSky() {
  const canvas = document.createElement("canvas");
  canvas.className = "sky";
  canvas.setAttribute("aria-hidden", "true");
  document.body.insertBefore(canvas, document.body.firstChild);
  let veil = document.querySelector(".fall-veil");
  if (!veil) {
    veil = document.createElement("div");
    veil.className = "fall-veil";
    veil.setAttribute("aria-hidden", "true");
    document.body.appendChild(veil);
  }
  const shell = document.querySelector(".page-shell");

  // The graphics are set up the first time the sky shows.
  let gl = null;
  let failed = false;
  let running = false;
  let fall = null;
  let fallPath = null;
  // The gas's own time; when a frame was last drawn; whether the canvas is to
  // be sized for rest, and whether a frame is owed, at the next frame.
  // How fast the gas moves, 0 to 1 (see "Idle"), and when the reader last
  // did anything; opening the page counts.
  // lastFrame is when the last frame of any kind began.
  const clock = { elapsed: 0, lastDraw: 0, lastFrame: 0, rest: false, pending: false, speed: 1, input: performance.now() };
  // The column of text, in CSS pixels from the window's top left.
  const column = { padLeft: 0, padRight: 0, padTop: 0, padBottom: 0 };

  function showing() {
    return canvas.isConnected && canvas.getClientRects().length > 0;
  }

  function setUp() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        // As in the library: no request for the faster of two graphics
        // chips, which draws the most power.
        powerPreference: "default"
      });
    } catch (error) {
      return null;
    }
    renderer.autoClear = false;
    renderer.setPixelRatio(1);
    // The passes write their values as they are, with no change of colour
    // space, whether into the picture or onto the screen. Set alike, each
    // shader is compiled once, ahead of its first use (see compile).
    renderer.outputColorSpace = THREE.ColorManagement.workingColorSpace;

    const shared = {
      uTemperature: { value: temperatureTable(512) },
      uBHColour: { value: colourTable(256) },
      uNoise: { value: noiseBlock() },
      uTime: { value: 0 },
      uText: { value: new THREE.Vector4(0, 0, -1, -1) },
      uFeather: { value: FEATHER },
      uTextShow: { value: 1 },
      uSize: { value: new THREE.Vector2(1, 1) },
      uTan: { value: new THREE.Vector2(1, 1) },
      uView: { value: new THREE.Matrix3() }
    };
    const still = viewerUniforms();
    placeViewer(still, DISTANCE, Math.cos(INCLINATION), 0, 0, 0);
    const moving = viewerUniforms();

    const camera = new THREE.Camera();
    const pass = (fragmentShader, uniforms) => {
      const scene = new THREE.Scene();
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
        uniforms: Object.assign({}, shared, uniforms),
        depthTest: false,
        depthWrite: false,
        vertexShader: TRACE_VERTEX,
        fragmentShader
      }));
      quad.frustumCulled = false;
      scene.add(quad);
      return { scene, uniforms: quad.material.uniforms };
    };
    const picture = { value: null };
    const trace = pass(TRACE_FRAGMENT, still);
    const light = pass(LIGHT_FRAGMENT, { uPicture: picture, uPictureScale: { value: new THREE.Vector2(1, 1) } });
    const falling = pass(FALL_FRAGMENT, moving);

    return {
      renderer, shared, moving, camera, trace, light, falling, picture,
      // The picture shown, and the one being traced, which replaces it once
      // it is done.
      shown: null,
      next: null,
      row: 0,
      width: 0,
      height: 0,
      density: 0,
      pitch: 0,
      // Whether the shaders for the picture are compiled, and whether the
      // fall's is being compiled.
      compiled: false,
      fallCompiling: false,
      // Pixels to trace in the next frame (see "Keeping frames short"), how
      // many the last frame traced, and whether a frame has yet run late.
      budget: TRACE_START,
      traced: 0,
      limited: false,
      // While falling, the resolution may step down if frames run late.
      fallScale: 1,
      late: 0
    };
  }

  // The shaders are compiled before their first use. Where the browser can
  // compile them off the page's own thread (KHR_parallel_shader_compile),
  // the page is not held up: the ray tracer is long, and compiling it can
  // take a second or more on a phone.
  function compile() {
    const { renderer, camera } = gl;
    Promise.all([
      renderer.compileAsync(gl.trace.scene, camera),
      renderer.compileAsync(gl.light.scene, camera)
    ]).then(() => {
      // The first time three.js uses a shader, it asks the browser about it,
      // and the page waits for the answer. Asked now, while the chip is
      // idle, the answer comes at once; asked after the first strips of the
      // picture, it waits until the chip has traced them. (The canvas does
      // not show yet.)
      renderer.render(gl.light.scene, camera);
      gl.compiled = true;
      wake();
    });
  }

  // The fall's shader is compiled once the picture shows and the page is
  // quiet, so that following a link starts the fall at once, rather than
  // after the wait for it.
  function prepareFall() {
    if (gl.fallCompiling) return;
    gl.fallCompiling = true;
    const go = () => gl.renderer.compileAsync(gl.falling.scene, gl.camera);
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2000 });
    else setTimeout(go, 500);
  }

  function picturePlan(width, height) {
    const aspect = width / height;
    const tanHeight = Math.max(Math.tan(MIN_HEIGHT * Math.PI / 360), Math.tan(MIN_WIDTH * Math.PI / 360) / aspect);
    return { tan: [tanHeight * aspect, tanHeight], pitch: Math.atan(HOLE_DROP * tanHeight) };
  }

  // The camera's axes, in the viewer's frame, looking pitch above the hole.
  function aim(pitch) {
    const c = Math.cos(pitch), s = Math.sin(pitch);
    gl.shared.uView.value.set(
      1, 0, 0,
      0, c, s,
      0, -s, c
    );
  }

  // Sizes the canvas for drawing at density, and the camera for it.
  function size(density) {
    const width = Math.max(1, Math.round(canvas.clientWidth * density));
    const height = Math.max(1, Math.round(canvas.clientHeight * density));
    if (gl.renderer.domElement.width !== width || gl.renderer.domElement.height !== height) {
      gl.renderer.setSize(width, height, false);
    }
    gl.width = width;
    gl.height = height;
    gl.density = density;
    const plan = picturePlan(width, height);
    gl.shared.uSize.value.set(width, height);
    gl.shared.uTan.value.set(...plan.tan);
    return plan;
  }

  // At rest: the canvas at its resting density; a new picture is traced if
  // the window's size has changed since the last.
  function rest() {
    const plan = size(REST_DENSITY);
    gl.pitch = plan.pitch;
    aim(gl.pitch);
    const target = gl.next || gl.shown;
    if (target && target.width === gl.width && target.height === gl.height) return;
    if (gl.next) gl.next.dispose();
    gl.next = new THREE.WebGLRenderTarget(gl.width, gl.height, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false
    });
    gl.row = 0;
  }

  // Traces the next strip of the picture; once it is whole, it is shown.
  function traceStrip() {
    const next = gl.next;
    const rows = Math.min(next.height - gl.row, Math.max(2, Math.floor(gl.budget / next.width / 2) * 2));
    next.scissor.set(0, gl.row, next.width, rows);
    next.scissorTest = true;
    gl.renderer.setRenderTarget(next);
    gl.renderer.render(gl.trace.scene, gl.camera);
    gl.renderer.setRenderTarget(null);
    // The first strip of a picture also pays for setting the picture up, so
    // its frame says little about the chip, and is not measured (see tune).
    gl.traced = gl.row === 0 ? 0 : next.width * rows;
    gl.row += rows;
    if (gl.row < next.height) return;
    next.scissorTest = false;
    if (gl.shown) gl.shown.dispose();
    gl.shown = next;
    gl.next = null;
    gl.picture.value = gl.shown.texture;
    canvas.classList.add("is-drawn");
    prepareFall();
  }

  // After a frame that traced gl.traced pixels in ms, the budget for the
  // next. If the frame was late, it is fewer pixels than were traced, in
  // proportion, and from then on the chip's limit is known: the budget grows
  // no more. Until then, a frame on time doubles it. A last strip much
  // shorter than the budget neither lowers nor raises it, since a frame that
  // traced so little and was late was held up by something else. Nor does a
  // frame far longer than any trace, as when the tab was hidden.
  function tune(ms) {
    if (ms > 250 || gl.traced < gl.budget / 2) return;
    let budget = gl.budget;
    if (ms > FRAME_BUDGET * LATE) {
      budget = gl.traced * Math.max(0.5, FRAME_BUDGET / ms);
      gl.limited = true;
    } else if (!gl.limited) {
      budget = gl.traced * 2;
    }
    gl.budget = Math.min(TRACE_MAX, Math.max(TRACE_MIN, Math.round(budget)));
  }

  // Where the column of text is, for the hold behind it, in the canvas's
  // pixels from its bottom left.
  function measureColumn() {
    if (!shell) return;
    const style = getComputedStyle(shell);
    column.padLeft = parseFloat(style.paddingLeft) || 0;
    column.padRight = parseFloat(style.paddingRight) || 0;
    column.padTop = parseFloat(style.paddingTop) || 0;
    column.padBottom = parseFloat(style.paddingBottom) || 0;
  }
  function placeColumn() {
    const text = gl.shared.uText.value;
    if (!shell) {
      text.set(0, 0, -1, -1);
      return;
    }
    const box = shell.getBoundingClientRect();
    const d = gl.density;
    const top = box.top + column.padTop;
    const bottom = box.bottom - column.padBottom;
    text.set(
      (box.left + column.padLeft) * d,
      gl.height - bottom * d,
      (box.right - column.padRight) * d,
      gl.height - top * d
    );
    gl.shared.uFeather.value = FEATHER * d;
  }

  function draw(now) {
    placeColumn();
    if (fall && !fall.quick) {
      stepFall(now);
      gl.renderer.setRenderTarget(null);
      gl.renderer.render(gl.falling.scene, gl.camera);
      return;
    }
    if (!gl.shown) return;
    gl.light.uniforms.uPictureScale.value.set(gl.shown.width / gl.width, gl.shown.height / gl.height);
    gl.renderer.setRenderTarget(null);
    gl.renderer.render(gl.light.scene, gl.camera);
  }

  // Moves the gas on, by the time since the last frame drawn.
  function advance(now) {
    const dt = Math.max(0, Math.min(0.1, (now - clock.lastDraw) / 1000));
    // Idle: the gas slows to a standstill.
    clock.speed = idle(now) ? Math.max(0, clock.speed - dt / SLOW_DOWN) : Math.min(1, clock.speed + dt / SPEED_UP);
    if (!reduceMotion) clock.elapsed += dt * ease(clock.speed);
    clock.lastDraw = now;
    gl.shared.uTime.value = clock.elapsed;
    return dt;
  }

  function frame(now) {
    running = false;
    if (gl && gl.traced) {
      tune(now - clock.lastFrame);
      gl.traced = 0;
    }
    clock.lastFrame = now;
    if (fall) {
      if (fall.quick) {
        stepFall(now);
      } else if (now - clock.lastDraw >= 1000 / 60 - 4) {
        // At most 60 frames a second. A canvas is cleared when its size is
        // set, so it is sized here, just before it is drawn.
        if (!fall.sized) {
          size(FALL_DENSITY * gl.fallScale);
          fall.sized = true;
        } else {
          adjustFall(now - clock.lastDraw);
        }
        advance(now);
        draw(now);
      }
      if (fall && !fall.done) schedule();
      return;
    }
    if (!showing() || !gl.compiled) return;
    if (clock.rest) {
      rest();
      clock.rest = false;
    }
    // At rest: 30 frames a second while the gas moves, and the picture is
    // traced a strip a frame until it is whole. Unwatched, the gas stands
    // still once the picture is whole; idle, once it has slowed to a stop.
    const tracing = Boolean(gl.next);
    if (tracing) traceStrip();
    if (tracing || clock.pending || (!reduceMotion && now - clock.lastDraw >= 1000 / 30 - 4)) {
      advance(now);
      draw(now);
      clock.pending = false;
    }
    if (gl.next || (!reduceMotion && watched(now) && (!idle(now) || clock.speed > 0))) schedule();
  }

  // Unwatched: while the window is not focused, as when the reader is in
  // another window or app, the gas stands still and nothing is drawn, rather
  // than 30 frames a second that no one is looking at. Focusing the window
  // wakes it, and so does pointing or scrolling at it, for a few seconds.
  // Anything the reader does also ends being idle.
  let unwatched = !document.hasFocus();
  function watched(now) {
    return !unwatched || now - clock.input < 3000;
  }
  function idle(now) {
    return now - clock.input >= IDLE_AFTER;
  }
  window.addEventListener("blur", () => { unwatched = true; });
  window.addEventListener("focus", () => {
    unwatched = false;
    clock.input = performance.now();
    if (gl && !fall) wake();
  });
  for (const type of ["pointermove", "pointerdown", "wheel", "keydown", "touchstart", "scroll"]) {
    window.addEventListener(type, () => {
      clock.input = performance.now();
      if (gl && !fall && !running && showing()) schedule();
    }, { capture: true, passive: true });
  }

  function schedule() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  // Starts drawing, if the sky shows.
  function wake() {
    if (failed || !showing()) return;
    if (!gl) {
      gl = setUp();
      if (!gl) {
        failed = true;
        canvas.remove();
        if (window.drawStarfield) window.drawStarfield();
        return;
      }
      measureColumn();
      if (document.fonts) document.fonts.ready.then(measureColumn);
      watchContext();
      compile();
      return;
    }
    clock.rest = true;
    clock.pending = true;
    schedule();
  }

  // A phone's browser may take the graphics chip away from the page, as when
  // the page is in the background or memory runs short, and give it back
  // later. The picture is lost with it. The sky fades to the plain
  // background, and is traced afresh once the chip is back. (These are heard
  // after three.js's own, which set it up again first.)
  function watchContext() {
    canvas.addEventListener("webglcontextlost", () => {
      canvas.classList.remove("is-drawn");
    });
    canvas.addEventListener("webglcontextrestored", () => {
      gl.shown = gl.next = null;
      gl.picture.value = null;
      gl.compiled = false;
      gl.fallCompiling = false;
      gl.traced = 0;
      compile();
    });
  }

  // ---------- Falling in ----------
  // then() is called once the view has gone dark.
  function fallIn(then) {
    if (fall) return;
    const quick = reduceMotion || !gl || !showing();
    if (!quick && !fallPath) fallPath = createFall(DISTANCE);
    fall = { start: performance.now(), then, done: false, skip: null, quick, sized: false };
    root.classList.add("is-falling");
    veil.classList.remove("is-lifting");
    listenForSkip(true);
    if (!quick) {
      // Falling, every pixel is traced every frame. The fall starts with
      // about as many as the chip traced in a frame, on time, while making
      // the picture, so that a slow chip's first frames do not stall.
      const pixels = canvas.clientWidth * canvas.clientHeight * FALL_DENSITY * FALL_DENSITY;
      gl.fallScale = Math.min(1, Math.max(0.5, Math.sqrt(gl.budget / pixels)));
      gl.late = 0;
    }
    schedule();
  }

  function stepFall(now) {
    const t = DEBUG?.fallTime ?? (now - fall.start) / 1000;
    let dark;
    if (fall.quick) {
      dark = t / 0.35;
    } else {
      const state = fallPath.at(t);
      placeViewer(gl.moving, state.r, state.mu, state.phi, state.vr, state.vth);
      aim(gl.pitch * (1 - ease(Math.min(1, t / FALL_TURN))));
      gl.shared.uTextShow.value = 1 - smoothstep(t, 0, TEXT_FADE);
      // Dark by the horizon, as in the library.
      dark = 1 - smoothstep(state.r, fallPath.end + 0.03, 2.6);
    }
    if (fall.skip !== null) dark = Math.max(dark, (now - fall.skip) / 300);
    dark = Math.min(1, dark);
    veil.style.opacity = dark.toFixed(3);
    if (dark >= 1 && !fall.done) {
      fall.done = true;
      fall.then();
    }
  }

  // Falling, every pixel is traced every frame: if frames keep running late,
  // fewer pixels are drawn, about as many fewer as the frames were late, down
  // to half as many across. ms is the time since the last frame drawn. A
  // frame far longer than any trace (the tab was hidden, say) is passed over.
  function adjustFall(ms) {
    if (ms > 1000) return;
    if (ms > FRAME_BUDGET * LATE) gl.late++;
    else gl.late = Math.max(0, gl.late - 1);
    if (gl.late >= 2 && gl.fallScale > 0.5) {
      gl.fallScale = Math.max(0.5, gl.fallScale * Math.min(0.8, Math.sqrt(FRAME_BUDGET / ms)));
      gl.late = 0;
      size(FALL_DENSITY * gl.fallScale);
    }
  }

  // Back from a fall, as if it had not happened. With reveal, the dark then
  // lifts from what is showing; without, it goes at once.
  function land({ reveal = false } = {}) {
    fall = null;
    listenForSkip(false);
    root.classList.remove("is-falling");
    veil.classList.toggle("is-lifting", reveal);
    veil.style.opacity = "0";
    if (gl) {
      gl.shared.uTextShow.value = 1;
      wake();
    }
  }

  // While falling, the pointer and the keys do nothing but skip to the end;
  // keys held with Cmd, Ctrl or Alt still reach the browser.
  function skipFall(event) {
    if (!fall || fall.done) return;
    if (event.type === "keydown" && (event.metaKey || event.ctrlKey || event.altKey)) return;
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
    if (event.type === "pointermove") return;
    if (fall.skip === null) fall.skip = performance.now();
  }
  // These listeners can cancel a touch or the wheel, so while they are there
  // the browser must wait for the page's script before it scrolls. They are
  // there only during a fall, when there is nothing to scroll.
  function listenForSkip(on) {
    for (const type of ["pointerdown", "pointermove", "wheel", "keydown", "touchstart"]) {
      if (on) window.addEventListener(type, skipFall, { capture: true, passive: false });
      else window.removeEventListener(type, skipFall, { capture: true });
    }
  }

  // Leaving for another page of the site, the reader falls in first, and
  // the page they go to fades in from the dark (it reads the mark left
  // here). Links that open elsewhere, or are clicked with a key held, go at
  // once, as do links within the page.
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || !showing() || failed) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element && event.target.closest("a[href]");
    if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault();
    if (fall) return;
    fallIn(() => {
      try { sessionStorage.setItem("arriving-from-fall", String(Date.now())); } catch (error) {}
      location.assign(url.href);
    });
  });

  // Coming back with the browser's back button, the page may be shown as it
  // was left, fallen in: put the reader back where they stood.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) land();
  });

  let resizing = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizing);
    resizing = setTimeout(() => {
      if (!gl) return;
      measureColumn();
      if (!fall) wake();
    }, 150);
  });
  // The hold behind the words follows them as the page scrolls; at reduced
  // motion, when nothing else draws, the scroll does.
  window.addEventListener("scroll", () => {
    if (!gl || !reduceMotion) return;
    clock.pending = true;
    schedule();
  }, { passive: true });
  motionQuery.addEventListener("change", (event) => {
    reduceMotion = event.matches;
    if (gl) wake();
  });

  wake();
  if (DEBUG) window.__sky = { DEBUG, clock, fallIn, land, get fallPath() { return fallPath; } };
  return {
    fallIn,
    land,
    wake,
    // Whether the sky can fall: it is drawn, and showing.
    get ready() { return Boolean(gl && !failed && showing()); }
  };
}

export const sky = createSky();
