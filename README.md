# joshualin.io

Joshua Lin's personal website. It is a static site with no build step: the
HTML, CSS and JavaScript in this repository are served exactly as written by
GitHub Pages, at the domain in `CNAME`.

## Pages

| Address           | File             | What it is                                                     |
| ----------------- | ---------------- | -------------------------------------------------------------- |
| `/`               | `index.html`     | Home: a short introduction, with Gargantua behind it.          |
| `/anthology.html` | `anthology.html` | Anthology: favourite music, books, films and quotes, as a list. |
| `/library.html`   | `library.html`   | Forwards to the anthology, so old links still work.            |

The pages stay at the top level so that their addresses never change.

## Folders

```
index.html, anthology.html, library.html   the pages
CNAME                                      the domain, for GitHub Pages
serve.py                                   a local server for working on the site (see below)
favicon.ico, favicon.svg,                  icons; browsers look for these at the top level
apple-touch-icon.png

assets/css/
  fonts.css         the fonts, served from assets/fonts/ (see "Design")
  site.css          shared by every page: palette, type, layout, scrollbar, the table of contents
  anthology.css     the anthology's list: links to recordings, years, series that open

assets/js/
  scrollbar.js      the slim scrollbar on every page
  sky.js            Gargantua behind the pages, and the fall from one page to the next
  gargantua.js      the black hole: its light traced through curved space
  starfield.js      a still night sky, only where sky.js cannot draw (no WebGL 2)
  vendor/three.min.js  three.js, only the parts the site uses (see "three.js")

assets/fonts/
  alegreya/         Alegreya and Alegreya SC, as Google Fonts serves them, with their licence
  lxgw-wenkai/      LXGW WenKai GB Screen, only the characters the site sets in it, with its licence

tools/
  three.sh          rebuilds assets/js/vendor/three.min.js (see "three.js")
  fonts.py          rebuilds the small copy of LXGW WenKai, after adding Chinese text (see "Design")
```

## Running it locally

From the repository's folder:

```bash
python3 serve.py
```

Then open <http://localhost:8123/>. A server is needed, rather than opening the
files directly, because the pages use JavaScript modules.

`serve.py` is Python's own file server, set to tell the browser not to keep
any file, so a reload always shows your latest edits. With plain
`python3 -m http.server`, the browser can go on showing an old copy of a file
you have just changed. It answers only this computer; for another port, give
it as `python3 serve.py 8000`.

## The anthology

`anthology.html` is a list of favourites, set like a book's table of
contents: music, books (short stories first), films and quotes. A series is
one line that opens to its volumes, and a piece of music links to a
recording of it on YouTube.

The list is plain HTML in the page, edited by hand; copying a line like the
one wanted and changing it is the easiest way to add one. Each part of it:

- A work is an `<li>` in a `<ul class="contents">`: its title in `<i>` (a
  short story upright, in curly quotes), its year in `<span class="year">`,
  an empty `<span class="leader">` for the dotted line, and its maker in
  `<span class="creator">`.
- A series is an `<li class="series">` holding a `<details>`: its `<summary>`
  is the line, and an `<ol class="vol-list">` lists its volumes, numbered in
  Roman numerals when it opens.
- A piece of music names its composer first, links its title to a recording
  (`<a class="recording">`), and names its performer on the right.
- A quote is a `<blockquote class="epigraph">`, its source in
  `<span class="author">`.

The headings' ids (`anthology/films` and so on) are kept so that links to
each part go on working.

## three.js

Gargantua is drawn with [three.js](https://threejs.org) 0.187.0, kept in the
repository as `assets/js/vendor/three.min.js` rather than loaded from another
site: minified, and holding only the parts of three.js that the scripts name
(each `THREE.Something`). Each page maps the name `three` to it in its import
map. After using a part of three.js that the site has not used before, or to
move to another version, rebuild it (this needs Node.js):

```bash
sh tools/three.sh
```

A part used but not in the file shows up as `undefined` in the browser's
console.

## Gargantua

Behind the pages is a black hole that spins almost as fast as a black hole
can, with a thin disk of glowing gas, drawn as the physics says it would look
(`gargantua.js`). Light is followed through the curved space around a
spinning black hole, so the far side of the disk shows bent up over the hole
and under it. The side of the disk that comes towards you is far brighter and
bluer than the side going away, as it would really be; the film
*Interstellar* left that out. The disk's colours are those of a blackbody at
the temperature a thin disk has at each radius, at most that of the surface
of the Sun.

The reader stands at rest 26 M from the hole (M is the hole's mass, as a
length): just outside the edge of the disk, 2.7 M above its plane. The disk
spans the whole view, and the stars all around are bent round the hole. The
hole sits a little below the middle of the window, under the opening lines
of a page; the view is at least 52° high and 66° wide, so that on a phone
held upright the whole disk still fits across.

The reader is at rest, so where each pixel's light comes from never changes.
That is traced once when the page opens, a ray for every pixel, a strip at a
time over the first frames, and again only when the window changes size; the
stars, which do not move, are worked out with it. Each frame then only
lights the disk's orbiting gas, 30 times a second. With reduced motion the
gas stands still, and the sky is drawn only when it changes.

The sky is as tall as the window at its tallest (`100lvh` in `site.css`). A
phone's browser shows and hides its toolbars as the page scrolls, and the
window's height changes each time; a sky as tall as the window would be
traced afresh each time, in the middle of the scroll. While the toolbars
show, they cover the foot of the sky, and the hole sits a little lower in
what is seen.

Behind the column of text, the picture's brightest light is held down, so
the words always stand out from it by at least 6.8 to 1 (`CAP` in `sky.js`).
Faint light, such as the stars, is hardly changed, and beyond the column, or
below the text on a short page, the hole is as bright as the exposure shows
it. This is the one place where the picture is not as a camera would show
it.

Without WebGL 2 the pages show instead a still night sky drawn on a 2D
canvas (`assets/js/starfield.js`): faint stars, a galaxy's band crossed by
lanes of dust, and a few galaxies beyond it, all very dim and darker still
behind the column of text.

### Falling in

Leaving a page for another page of the site, the reader falls into
Gargantua, and the next page fades in from the dark (`createFall` in
`gargantua.js`). The page's words fade away, the view turns to face the
hole, and the reader falls from rest, as a stone let go would: slowly at
first, then faster and faster. The path is a free fall in the curved space
of the spinning hole, from rest, with no angular momentum: the spin drags the
reader round it, faster near the horizon. Each frame traces a ray for every
pixel, from where the reader is and as fast as they are going, so the hole
and its disk are seen with the aberration and Doppler shift of the reader's
own speed, which nears the speed of light. The stars' light is bent
round the hole: they crowd round the shadow, show twice, and brighten where
it magnifies the sky.

The fall's time is chosen rather than worked out: it is played as fast as
it can be at first, so that it is seen to gather speed, and slower near the
hole, so that the last plunge can be seen at all (`FALL_KNEE` in
`gargantua.js`). From 26 M it takes about 3 seconds. A click or a key skips
to the end; with reduced motion the view only fades. Links to other sites,
links within the page, and clicks with a key held go at once.

A page that the fall leads to fades in from the dark if the page fallen from
left it a mark in `sessionStorage` (the line in the `<head>` of each page,
and `html.is-arriving` in `site.css`); a new page of the site needs the same
line. Coming back with the browser's back button, the page is as it was
before the fall.

On the pages, `?debug` gives `window.__sky`, with `fallIn(() => {})` to start
the fall without leaving, `DEBUG.fallTime = 3` to hold it 3 seconds in, and
`land()` to end it, for the browser console.

### How much it draws

On an Apple M4 Pro, in a window 1440 by 900 CSS pixels drawn at 1.5 pixels
per CSS pixel, a frame takes about half a millisecond of the graphics chip,
30 times a second; tracing the picture takes about 6 milliseconds in all,
spread over the first frames. Falling, every pixel is traced every frame, at
no more than 1 pixel per CSS pixel, about 3.5 milliseconds a frame for those
3 seconds, and fewer pixels if frames run late.

An old phone's graphics chip can be a hundred times slower than that. A
frame that runs long holds up more than the sky: the browser's own drawing
and scrolling of the page wait for it too. So no frame is to take more than
a thirtieth of a second (`FRAME_BUDGET` in `sky.js`):

- The picture is traced in strips sized to the chip. The first strips are
  small, and each is twice as large as the last while frames keep to time.
  Once one is late, the strips are about as large as fit, and grow no more
  (`tune`).
- The fall starts with about as many pixels as the chip traced in a frame
  on time, so a slow chip's first frames do not stall. It draws fewer if its
  frames still run late.
- The shaders are compiled before their first use, off the page's own
  thread where the browser can. The fall's shader is compiled once the
  picture shows, so that following a link does not wait for it.
- The listeners that skip to the end of a fall can stop a touch or the
  wheel, so while they are there, the browser waits for the page's script
  before it scrolls. They are there only during the fall.
- A phone's browser may take the graphics chip away from a page, as when it
  is in the background, and give it back later. The sky then fades to the
  plain background, and is traced afresh once the chip is back.

A minute after the reader last did anything, the gas slows to a standstill
over 3 seconds, and then nothing is drawn at all; while the window is not
focused it stands still at once (`sky.js`, "Idle" and "Unwatched"). Anything
the reader does brings it back. A page left open costs nothing to draw. To
see a page go idle without waiting a minute, open it with `?debug` and set
`__sky.clock.input` to `performance.now() - 60000`.

## Design

The site is dark only. Its palette is two colours, `--background` and `--text`
in `assets/css/site.css`. Text is set in Alegreya and Alegreya SC, with LXGW
WenKai for Chinese.

The fonts are served from the site itself (`assets/fonts/`, declared in
`assets/css/fonts.css`), so the first paint waits on no other server. Each
of Alegreya's files holds one range of characters, as Google Fonts serves
them, and a browser fetches only the ones a page uses; each page fetches the
few it opens with at once (`<link rel="preload">` in its head). WenKai is
many megabytes whole, so the site keeps only the characters it sets in it,
the Chinese on the home page, in one file of a few kilobytes. After adding
Chinese text anywhere, rebuild it, and its range in `fonts.css`:

```bash
uv run tools/fonts.py
```

## Publishing

GitHub Pages publishes the `main` branch. Pushing to `main` updates the site.
