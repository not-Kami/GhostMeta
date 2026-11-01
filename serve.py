#!/usr/bin/env python3
"""
GhostMeta - Zero-Trace Metadata & AI Provenance Eraser
Local Python server (Port 8780)
"""

import http.server
import socketserver
import os
import sys

PORT = int(os.environ.get("PORT", 8780))
HOST = os.environ.get("HOST", "localhost")

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".js") or path.endswith(".mjs"):
            return "application/javascript; charset=utf-8"
        if path.endswith(".css"):
            return "text/css; charset=utf-8"
        if path.endswith(".html"):
            return "text/html; charset=utf-8"
        return super().guess_type(path)

if __name__ == "__main__":
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)
    
    with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
        print("=" * 56)
        print(" GhostMeta — Zero-Trace Metadata & Provenance Eraser")
        print(f" Python server running at: http://{HOST}:{PORT}")
        print(" Press Ctrl+C to stop")
        print("=" * 56)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            sys.exit(0)
