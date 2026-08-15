#!/usr/bin/env python3
"""Serve a local directory on loopback for one-time OAuth-link handoff."""
from __future__ import annotations

import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--port", type=int, default=8123)
    args = parser.parse_args()
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(args.directory))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
