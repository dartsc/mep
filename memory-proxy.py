#!/usr/bin/env python3
"""
Memory Scanner Proxy - Standalone Desktop App
Handles large memory scan requests and forwards to Vercel
"""

import socket
import json
import requests
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import sys

VERCEL_URL = 'https://mep-lyart.vercel.app'
PORT = 3334

class ProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        """Custom logging"""
        print(f"[{self.log_date_time_string()}] {format % args}")
        sys.stdout.flush()  # Force immediate output
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                'status': 'ok',
                'message': 'Memory Scanner Proxy is running',
                'vercel_server': VERCEL_URL
            }
            self.wfile.write(json.dumps(response).encode())
            print("✅ Health check OK")
            sys.stdout.flush()  # Force immediate output
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/scan':
            try:
                # Read request data
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                print("\n" + "="*70)
                print("📥 INCOMING REQUEST")
                print("="*70)
                print(f"Payload size: {len(post_data):,} bytes")
                print(f"Search value: '{data.get('searchValue', 'N/A')}'")
                print(f"Search type: {data.get('searchType', 'N/A')}")
                print(f"Data keys: {list(data.keys())}")
                print("\nRequest payload:")
                print(json.dumps(data, indent=2)[:500] + "..." if len(json.dumps(data)) > 500 else json.dumps(data, indent=2))
                sys.stdout.flush()  # Force immediate output
                
                # Forward to Vercel
                print("\n📤 Forwarding to Vercel...")
                
                vercel_response = requests.post(
                    f'{VERCEL_URL}/scan',
                    json=data,
                    headers={'Content-Type': 'application/json'},
                    timeout=120
                )
                
                result = vercel_response.json()
                
                # Send response back
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
                
                print("\n" + "="*70)
                print("📤 RESPONSE FROM VERCEL")
                print("="*70)
                print(f"Success: {result.get('success', 'N/A')}")
                print(f"Matches found: {result.get('filtered', 0)} out of {result.get('total', 0)}")
                print(f"Elapsed time: {result.get('elapsed', 'N/A')}s")
                print("\nFull response:")
                print(json.dumps(result, indent=2))
                print("="*70 + "\n")
                sys.stdout.flush()  # Force immediate output
                
            except requests.exceptions.Timeout:
                print("⏱️ Vercel timeout")
                sys.stdout.flush()
                self.send_error(504, "Server timeout")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                sys.stdout.flush()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                error_response = {'success': False, 'error': str(e)}
                self.wfile.write(json.dumps(error_response).encode())
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    """Run the proxy server"""
    server = HTTPServer(('127.0.0.1', PORT), ProxyHandler)
    
    print("=" * 70, flush=True)
    print("🚀 MEMORY SCANNER PROXY - RUNNING", flush=True)
    print("=" * 70, flush=True)
    print(f"📡 Vercel Server: {VERCEL_URL}", flush=True)
    print(f"🌐 Local Address: http://localhost:{PORT}", flush=True)
    print(f"✅ Status: Ready to receive requests", flush=True)
    print("=" * 70, flush=True)
    print("\nPress Ctrl+C to stop the server\n", flush=True)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Shutting down server...")
        server.shutdown()
        print("✅ Server stopped")

if __name__ == '__main__':
    try:
        run_server()
    except OSError as e:
        if "address already in use" in str(e).lower():
            print(f"\n❌ ERROR: Port {PORT} is already in use!")
            print(f"   Please close any other application using port {PORT}")
        else:
            print(f"\n❌ ERROR: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
