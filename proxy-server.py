#!/usr/bin/env python3
"""
Local Proxy Server for Memory Scanner
Receives large payloads from userscript and forwards to Vercel server
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Your Vercel server URL
VERCEL_URL = 'https://mep-lyart.vercel.app'

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'Local proxy server is running',
        'vercel_server': VERCEL_URL
    })

@app.route('/scan', methods=['POST', 'OPTIONS'])
def scan():
    """Proxy scan requests to Vercel server"""
    if request.method == 'OPTIONS':
        # Handle CORS preflight
        return '', 200
    
    try:
        # Get data from userscript
        data = request.get_json()
        
        print(f"📥 Received scan request")
        print(f"   Data size: {len(json.dumps(data))} bytes")
        print(f"   Search value: {data.get('searchValue', 'N/A')}")
        print(f"   Search type: {data.get('searchType', 'N/A')}")
        
        # Forward to Vercel server
        print(f"📤 Forwarding to Vercel: {VERCEL_URL}/scan")
        
        response = requests.post(
            f'{VERCEL_URL}/scan',
            json=data,
            headers={'Content-Type': 'application/json'},
            timeout=120  # 2 minute timeout for large scans
        )
        
        # Return Vercel's response
        result = response.json()
        
        print(f"✅ Scan complete: {result.get('filtered', 0)} matches found")
        
        return jsonify(result), response.status_code
        
    except requests.exceptions.Timeout:
        print("⏱️ Vercel server timeout")
        return jsonify({
            'success': False,
            'error': 'Server timeout - scan took too long'
        }), 504
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error forwarding to Vercel: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to connect to Vercel server: {str(e)}'
        }), 502
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("🚀 Starting Memory Scanner Proxy Server")
    print(f"📡 Vercel Server: {VERCEL_URL}")
    print(f"🌐 Local Server: http://localhost:3334")
    print("=" * 60)
    
    app.run(
        host='127.0.0.1',
        port=3334,
        debug=True
    )
