// A slim scrollbar that floats in from the window edge and fades out when the
// page is idle. It only draws the bar: wheel, trackpad, keyboard and touch
// scrolling stay native. A line in each page's <head> hides the browser's own
// scrollbar before the first paint.
(function () {
  var root = document.documentElement;
  var MIN_THUMB = 32;      // px, so the thumb stays easy to grab on long pages
  var HIDE_DELAY = 900;    // ms of stillness before the bar fades out

  var bar = document.createElement("div");
  var thumb = document.createElement("div");
  bar.className = "scrollbar";
  thumb.className = "scrollbar-thumb";
  bar.setAttribute("aria-hidden", "true");  // scrolling stays accessible natively
  bar.appendChild(thumb);
  document.body.appendChild(bar);

  var hovering = false;
  var dragging = false;
  var hideTimer = null;
  var frame = null;

  function measure() {
    var viewport = window.innerHeight;
    var content = root.scrollHeight;
    var track = bar.clientHeight;
    var maxScroll = content - viewport;
    var thumbHeight = Math.max(MIN_THUMB, track * viewport / content);
    return {
      maxScroll: maxScroll,
      travel: track - thumbHeight,
      thumbHeight: thumbHeight
    };
  }

  function render() {
    frame = null;
    var m = measure();
    bar.classList.toggle("is-unneeded", m.maxScroll <= 1);
    var progress = m.maxScroll > 0 ? window.scrollY / m.maxScroll : 0;
    progress = Math.min(1, Math.max(0, progress));
    thumb.style.height = m.thumbHeight + "px";
    thumb.style.transform = "translateY(" + (m.travel * progress) + "px)";
  }

  function scheduleRender() {
    if (frame === null) frame = requestAnimationFrame(render);
  }

  function show() {
    bar.classList.add("is-visible");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (!hovering && !dragging) bar.classList.remove("is-visible");
    }, HIDE_DELAY);
  }

  window.addEventListener("scroll", function () {
    scheduleRender();
    show();
  }, { passive: true });
  window.addEventListener("resize", scheduleRender);
  // Fonts loading or content changing alters the page height.
  if ("ResizeObserver" in window) new ResizeObserver(scheduleRender).observe(document.body);

  // Moving the pointer to the right edge reveals the bar, so it can be found and dragged.
  bar.addEventListener("pointerenter", function () { hovering = true; show(); });
  bar.addEventListener("pointerleave", function () { hovering = false; show(); });

  // Drag the thumb to scroll.
  thumb.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    event.preventDefault();
    var m = measure();
    var startY = event.clientY;
    var startScroll = window.scrollY;
    var pagesPerPixel = m.travel > 0 ? m.maxScroll / m.travel : 0;
    dragging = true;
    bar.classList.add("is-dragging");
    thumb.setPointerCapture(event.pointerId);

    function move(e) {
      window.scrollTo(0, startScroll + (e.clientY - startY) * pagesPerPixel);
    }
    function end() {
      dragging = false;
      bar.classList.remove("is-dragging");
      thumb.removeEventListener("pointermove", move);
      thumb.removeEventListener("pointerup", end);
      thumb.removeEventListener("pointercancel", end);
      show();
    }
    thumb.addEventListener("pointermove", move);
    thumb.addEventListener("pointerup", end);
    thumb.addEventListener("pointercancel", end);
  });

  // Click the empty track above or below the thumb to move one screen.
  bar.addEventListener("pointerdown", function (event) {
    if (event.target !== bar || event.button !== 0) return;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var direction = event.clientY < thumb.getBoundingClientRect().top ? -1 : 1;
    window.scrollBy({ top: direction * window.innerHeight * 0.9, behavior: reduceMotion ? "auto" : "smooth" });
  });

  render();
})();
