"""Serve the site on this computer while working on it.

    python3 serve.py          # http://localhost:8123/
    python3 serve.py 8000     # on another port

This is Python's own file server (python3 -m http.server) with two changes:

- It tells the browser not to keep any file (Cache-Control: no-store), so
  every reload shows the files as they are now. Python's server says
  nothing about keeping files, and then the browser guesses how long a file
  stays fresh from how old it is: after an edit to a file that had not
  changed for a while, the browser can go on showing the old copy.
- It answers only this computer (127.0.0.1), not others on the network.

It serves this folder, wherever it is started from.
"""

import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent


class FreshFiles(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    handler = functools.partial(FreshFiles, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        print(f"Serving {ROOT} at http://localhost:{port}/ (Ctrl+C to stop)", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
