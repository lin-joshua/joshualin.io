// A still night sky behind the pages of text: faint stars, the band of a
// galaxy seen edge-on from inside it, with dark lanes of dust, and a few
// galaxies far beyond it. The pages show Gargantua instead (sky.js); this
// sky is drawn only where that cannot be, without WebGL 2 or if three.js
// does not load, when window.drawStarfield() is called. It is drawn once
// into a canvas fixed behind the page, and again when the window changes
// size (but not when a phone's toolbars come and go; see site.css).
// Nothing in it moves: stars twinkle only through air, and out here there
// is none.
//
// Stars are laid out in tiles of the window, each from its own seed, so a
// change of size shows more or less of the same sky instead of a new one.
// Their colours are those of blackbodies from about 3000 to 12000 kelvin,
// kept pale, as the eye sees faint stars; their brightness follows a power
// law, so there are many faint stars and few bright ones, as in the real sky.
(function () {
  var TILE = 256;                 // CSS px
  var STARS_PER_TILE = 46;        // away from the band
  var canvas = null;

  // A small fast random number generator, from a 32-bit seed (mulberry32).
  function random(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Smooth value noise in two dimensions, from a lattice of random values.
  function lattice(ix, iy) {
    var h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    var a = lattice(ix, iy), b = lattice(ix + 1, iy);
    var c = lattice(ix, iy + 1), d = lattice(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  function fractal(x, y, octaves) {
    var sum = 0, amplitude = 0.5, total = 0;
    for (var i = 0; i < octaves; i++) {
      sum += amplitude * noise(x, y);
      total += amplitude;
      x = x * 2.03 + 17.1;
      y = y * 2.03 - 9.7;
      amplitude *= 0.5;
    }
    return sum / total;
  }

  // The galaxy's band: a gently bowed stripe from the lower left to the upper
  // right. Its strength at a point, 0 to 1, from the distance to its midline.
  function bandShape(width, height) {
    var length = Math.hypot(width, height);
    var ux = width / length, uy = -height / length;      // along the band
    return function (x, y) {
      var dx = x - width * 0.5, dy = y - height * 0.55;
      var along = dx * ux + dy * uy;
      var across = -dx * uy + dy * ux;
      var bow = 0.08 * along * along / length;
      var d = (across - bow) / (length * 0.16);
      return Math.exp(-d * d);
    };
  }

  // The colour of a star: a blackbody's, from cool and orange to hot and
  // blue-white, made paler so that faint stars read as nearly white.
  function starColour(t) {
    var r, g, b;
    if (t < 0.5) {
      var k = t / 0.5;
      r = 255; g = 196 + 50 * k; b = 150 + 90 * k;
    } else {
      var j = (t - 0.5) / 0.5;
      r = 255 - 55 * j; g = 246 - 20 * j; b = 240 + 15 * j;
    }
    var pale = 0.45;
    return [r + (255 - r) * pale, g + (255 - g) * pale, b + (255 - b) * pale].map(Math.round);
  }

  // The canvas is as tall as the window at its tallest (site.css), so a
  // phone's toolbars coming and going do not change its size.
  function draw(width, height) {
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    var band = bandShape(width, height);

    // The dark of space: the page's own background, a little deeper towards
    // the edges.
    var base = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, Math.hypot(width, height) * 0.6);
    base.addColorStop(0, "#171717");
    base.addColorStop(1, "#0e0e0f");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    // The band's glow, worked out at a quarter of the size and scaled up,
    // which also softens it: unresolved stars and lit gas, crossed by lanes
    // of dust that hide what is behind them.
    var scale = 4;
    var w = Math.ceil(width / scale), h = Math.ceil(height / scale);
    var glow = document.createElement("canvas");
    glow.width = w;
    glow.height = h;
    var gctx = glow.getContext("2d");
    var image = gctx.createImageData(w, h);
    var data = image.data;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var px = x * scale, py = y * scale;
        var s = band(px, py);
        var i = (y * w + x) * 4;
        if (s < 0.01) {
          data[i + 3] = 0;
          continue;
        }
        var cloud = fractal(px / 260, py / 260, 5);
        var dust = fractal(px / 140 + 40, py / 140 - 25, 4);
        var lane = Math.max(0, Math.min(1, (dust - 0.48) * 4.5));
        var light = s * (0.25 + 1.3 * cloud * cloud) * (1 - 0.8 * lane * s);
        // Warmer at the band's heart, where older stars crowd; cooler at
        // its edges.
        data[i] = 255;
        data[i + 1] = Math.round(232 + 14 * (1 - s));
        data[i + 2] = Math.round(205 + 40 * (1 - s));
        data[i + 3] = Math.round(Math.min(1, light) * 46);
      }
    }
    gctx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(glow, 0, 0, width, height);

    // Galaxies far beyond our own: a few faint smudges, each tilted its own
    // way, away from the band where the dust would hide them.
    var far = random(Math.round(width / TILE) * 7919 + 13);
    for (var n = 0; n < 5; n++) {
      var gx = far() * width, gy = far() * height;
      if (band(gx, gy) > 0.2) continue;
      var size = 2.5 + far() * 5;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(far() * Math.PI);
      ctx.scale(1, 0.25 + far() * 0.5);
      var smudge = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
      smudge.addColorStop(0, "rgba(255, 238, 215, 0.22)");
      smudge.addColorStop(1, "rgba(255, 238, 215, 0)");
      ctx.fillStyle = smudge;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // The stars, tile by tile; more of them in the band.
    var columns = Math.ceil(width / TILE), rows = Math.ceil(height / TILE);
    for (var ty = 0; ty < rows; ty++) {
      for (var tx = 0; tx < columns; tx++) {
        var next = random(tx * 73856093 ^ ty * 19349663 ^ 0x5bd1e995);
        for (var k = 0; k < STARS_PER_TILE * 3; k++) {
          var sx = (tx + next()) * TILE;
          var sy = (ty + next()) * TILE;
          var pick = next();
          var colour = starColour(next());
          // Brightness from a power law: most stars at the edge of sight.
          var bright = Math.pow(next(), 3.2);
          // A third of the candidates everywhere; the rest only in the band.
          if (pick > 1 / 3 + 0.5 * band(sx, sy)) continue;
          if (sx > width || sy > height) continue;
          var alpha = 0.12 + 0.75 * bright;
          var radius = 0.35 + 0.75 * bright;
          var rgb = colour[0] + ", " + colour[1] + ", " + colour[2];
          if (bright > 0.55) {
            // A bright star's light spreads a little around it.
            var halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 5);
            halo.addColorStop(0, "rgba(" + rgb + ", " + (alpha * 0.35).toFixed(3) + ")");
            halo.addColorStop(1, "rgba(" + rgb + ", 0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(sx, sy, radius * 5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "rgba(" + rgb + ", " + alpha.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Behind the column of text the sky is a little darker, so the words
    // stay as easy to read as on a plain background.
    var column = Math.min(width, 760);
    var left = (width - column) / 2;
    var shade = ctx.createLinearGradient(left - 120, 0, left + column + 120, 0);
    shade.addColorStop(0, "rgba(23, 23, 23, 0)");
    shade.addColorStop(120 / (column + 240), "rgba(23, 23, 23, 0.5)");
    shade.addColorStop(1 - 120 / (column + 240), "rgba(23, 23, 23, 0.5)");
    shade.addColorStop(1, "rgba(23, 23, 23, 0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);

    canvas.classList.add("is-drawn");
  }

  var pending = null;
  var drawnSize = "";
  function redraw() {
    // A window not yet laid out has no size; its first resize draws it.
    var width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    var size = width + "x" + height + "@" + window.devicePixelRatio;
    if (size === drawnSize) return;
    drawnSize = size;
    draw(width, height);
  }
  window.drawStarfield = function () {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.className = "starfield";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);
    window.addEventListener("resize", function () {
      clearTimeout(pending);
      pending = setTimeout(redraw, 150);
    });
    redraw();
  };
})();
