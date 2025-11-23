// ==UserScript==
// @name         Advanced Memory Editor Pro
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Professional memory scanner and editor with advanced filtering, fuzzy search, value tracking, and modern UI
// @author       You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      localhost
// @connect      127.0.0.1
// @connect      vercel.app
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // Local Python proxy server (forwards to Vercel)
    const SERVER_URL = 'http://localhost:3334';

    const state = {
        matches: [],
        filteredMatches: [],
        previousMatches: [],
        searchHistory: [],
        watchList: [],
        freezeList: [],
        scanning: false,
        autoRefresh: false,
        refreshInterval: null,
        freezeInterval: null,
        detectedFrames: [],
        detectedCanvases: [],
        detectedEmbeds: [],
        currentContext: window,
        contextName: 'Main Window',
        gameFrozen: false,
        frozenCallbacks: [],
        originalRAF: null,
        originalSetTimeout: null,
        originalSetInterval: null,
        scanProgress: 0,
        scanTotal: 0,
        scanAborted: false
    };

    const htmlPolicy = (() => {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
            try {
                return window.trustedTypes.createPolicy('memEditorPolicy', {
                    createHTML: (html) => html
                });
            } catch(e) {
                return null;
            }
        }
        return null;
    })();

    function createFragment(html) {
        const tempDiv = document.createElement('div');
        if (htmlPolicy) {
            tempDiv.innerHTML = htmlPolicy.createHTML(html);
        } else {
            tempDiv.innerHTML = html;
        }
        return tempDiv;
    }

    const style = document.createElement('style');
    style.textContent = `
        .mem-editor-gui {
            position: fixed;
            top: 10px;
            right: 10px;
            background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
            color: #e0e0e0;
            padding: 0;
            z-index: 999999;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            border-radius: 12px;
            width: 420px;
            max-height: 600px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.1);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .mem-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
        }
        .mem-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .mem-controls {
            display: flex;
            gap: 8px;
        }
        .mem-btn-icon {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .mem-btn-icon:hover {
            background: rgba(255,255,255,0.3);
            transform: scale(1.05);
        }
        .mem-content {
            padding: 15px;
            overflow-y: auto;
            flex: 1;
        }
        .mem-content::-webkit-scrollbar {
            width: 8px;
        }
        .mem-content::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.2);
            border-radius: 4px;
        }
        .mem-content::-webkit-scrollbar-thumb {
            background: rgba(102,126,234,0.5);
            border-radius: 4px;
        }
        .mem-content::-webkit-scrollbar-thumb:hover {
            background: rgba(102,126,234,0.7);
        }
        .mem-search-section {
            background: rgba(0,0,0,0.2);
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 12px;
        }
        .mem-input-group {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
            align-items: center;
        }
        .mem-input {
            flex: 1;
            padding: 8px 12px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px;
            color: white;
            font-size: 13px;
            transition: all 0.2s;
        }
        .mem-input:focus {
            outline: none;
            border-color: #667eea;
            background: rgba(255,255,255,0.15);
        }
        .mem-input::placeholder {
            color: rgba(255,255,255,0.5);
        }
        .mem-btn {
            padding: 8px 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
            white-space: nowrap;
        }
        .mem-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102,126,234,0.4);
        }
        .mem-btn:active {
            transform: translateY(0);
        }
        .mem-btn-secondary {
            background: rgba(255,255,255,0.1);
        }
        .mem-btn-danger {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .mem-select {
            padding: 8px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px;
            color: white;
            font-size: 13px;
        }
        .mem-checkbox-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            cursor: pointer;
            user-select: none;
        }
        .mem-checkbox {
            cursor: pointer;
        }
        .mem-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 8px;
        }
        .mem-stat {
            background: rgba(255,255,255,0.05);
            padding: 8px;
            border-radius: 6px;
            text-align: center;
        }
        .mem-stat-label {
            font-size: 11px;
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .mem-stat-value {
            font-size: 18px;
            font-weight: 600;
            color: #667eea;
            margin-top: 4px;
        }
        .mem-results {
            background: rgba(0,0,0,0.2);
            border-radius: 8px;
            padding: 8px;
            max-height: 300px;
            overflow-y: auto;
        }
        .mem-result-item {
            background: rgba(255,255,255,0.05);
            padding: 10px;
            margin-bottom: 6px;
            border-radius: 6px;
            border-left: 3px solid #667eea;
            transition: all 0.2s;
        }
        .mem-result-item:hover {
            background: rgba(255,255,255,0.1);
            transform: translateX(2px);
        }
        .mem-result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .mem-result-path {
            font-size: 11px;
            color: #667eea;
            font-family: monospace;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .mem-result-controls {
            display: flex;
            gap: 4px;
            align-items: center;
        }
        .mem-result-input {
            width: 80px;
            padding: 4px 8px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 4px;
            color: white;
            font-size: 12px;
        }
        .mem-result-btn {
            padding: 4px 10px;
            font-size: 11px;
            background: rgba(102,126,234,0.6);
            border: none;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .mem-result-btn:hover {
            background: rgba(102,126,234,0.8);
        }
        .mem-watch-btn {
            background: rgba(255,193,7,0.6);
        }
        .mem-watch-btn:hover {
            background: rgba(255,193,7,0.8);
        }
        .mem-tabs {
            display: flex;
            gap: 4px;
            margin-bottom: 12px;
        }
        .mem-tab {
            flex: 1;
            padding: 8px;
            background: rgba(255,255,255,0.05);
            border: none;
            color: rgba(255,255,255,0.6);
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
        }
        .mem-tab.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .mem-empty {
            text-align: center;
            padding: 20px;
            color: rgba(255,255,255,0.4);
            font-size: 13px;
        }
        .mem-loading {
            text-align: center;
            padding: 20px;
        }
        .mem-spinner {
            border: 3px solid rgba(255,255,255,0.1);
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .mem-minimized {
            max-height: 48px;
            width: 200px;
        }
        .mem-minimized .mem-content {
            display: none;
        }
        .mem-toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000000;
            animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        .mem-context-banner {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            padding: 8px 15px;
            text-align: center;
            font-size: 12px;
            font-weight: 600;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .mem-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 1000000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .mem-modal-content {
            background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
            padding: 20px;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.1);
            color: white;
        }
        .mem-modal-header {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #667eea;
        }
        .mem-modal-body {
            margin-bottom: 20px;
            font-size: 14px;
            line-height: 1.6;
        }
        .mem-modal-list {
            max-height: 200px;
            overflow-y: auto;
            background: rgba(0,0,0,0.2);
            border-radius: 6px;
            padding: 10px;
            margin: 10px 0;
        }
        .mem-modal-item {
            padding: 8px;
            margin: 4px 0;
            background: rgba(255,255,255,0.05);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .mem-modal-item:hover {
            background: rgba(102,126,234,0.3);
            transform: translateX(4px);
        }
        .mem-modal-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        .mem-context-info {
            background: rgba(102,126,234,0.2);
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 12px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .mem-badge {
            background: rgba(255,193,7,0.3);
            color: #ffc107;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }
    `;
    document.head.appendChild(style);

    const gui = document.createElement('div');
    gui.className = 'mem-editor-gui';

    const guiHTML = `
        <div class="mem-header">
            <h3>⚡ Memory Editor Pro</h3>
            <div class="mem-controls">
                <button class="mem-btn-icon" id="memMinimize" title="Minimize">−</button>
                <button class="mem-btn-icon" id="memClose" title="Close">×</button>
            </div>
        </div>
        <div class="mem-content">
            <div class="mem-context-info">
                <span>📍 Context: <strong id="memContextName">Main Window</strong></span>
                <button class="mem-btn-icon" id="memSwitchContext" title="Switch Context">🔄</button>
            </div>
            <div class="mem-tabs">
                <button class="mem-tab active" data-tab="search">🔍 Search</button>
                <button class="mem-tab" data-tab="watch">👁️ Watch</button>
                <button class="mem-tab" data-tab="freeze">❄️ Freeze</button>
                <button class="mem-tab" data-tab="game">🎮 Game</button>
                <button class="mem-tab" data-tab="contexts">🖼️ Contexts</button>
                <button class="mem-tab" data-tab="settings">⚙️ Settings</button>
            </div>
            <div class="mem-tab-content" data-content="search">
                <div class="mem-search-section">
                    <div class="mem-input-group">
                        <input id="memSearchValue" class="mem-input" type="text" placeholder="Search value (number, string, or regex)">
                        <button id="memSearchBtn" class="mem-btn">🔍 Scan</button>
                    </div>
                    <div class="mem-input-group" id="memNextScanGroup" style="display:none;">
                        <button id="memNextScanBtn" class="mem-btn" style="flex:1;background:linear-gradient(135deg, #4caf50 0%, #45a049 100%);">➡️ Next Scan</button>
                        <button id="memNewScanBtn" class="mem-btn mem-btn-secondary">🔄 New Scan</button>
                    </div>
                    <div class="mem-input-group">
                        <select id="memSearchType" class="mem-select">
                            <option value="exact">Exact Match</option>
                            <option value="range">Range</option>
                            <option value="fuzzy">Fuzzy</option>
                            <option value="increased">Increased</option>
                            <option value="decreased">Decreased</option>
                            <option value="unchanged">Unchanged</option>
                        </select>
                        <input id="memRangeMax" class="mem-input" type="number" placeholder="Max (for range)" style="display:none;">
                    </div>
                    <div class="mem-input-group">
                        <label class="mem-checkbox-label">
                            <input type="checkbox" id="memDeepScan" class="mem-checkbox">
                            Deep Scan (slower)
                        </label>
                        <label class="mem-checkbox-label">
                            <input type="checkbox" id="memStringSearch" class="mem-checkbox">
                            Include Strings
                        </label>
                    </div>
                    <div class="mem-stats">
                        <div class="mem-stat">
                            <div class="mem-stat-label">Total Found</div>
                            <div class="mem-stat-value" id="memTotalMatches">0</div>
                        </div>
                        <div class="mem-stat">
                            <div class="mem-stat-label">Filtered</div>
                            <div class="mem-stat-value" id="memFilteredMatches">0</div>
                        </div>
                    </div>
                </div>
                <div class="mem-input-group">
                    <input id="memFilterInput" class="mem-input" type="text" placeholder="Filter results by path...">
                    <button id="memClearBtn" class="mem-btn mem-btn-secondary">Clear</button>
                </div>
                <div id="memResults" class="mem-results"></div>
            </div>
            <div class="mem-tab-content" data-content="watch" style="display:none;">
                <div id="memWatchList" class="mem-results"></div>
            </div>
            <div class="mem-tab-content" data-content="freeze" style="display:none;">
                <div class="mem-search-section">
                    <div class="mem-input-group">
                        <label class="mem-checkbox-label">
                            <input type="checkbox" id="memFreezeActive" class="mem-checkbox">
                            Enable Freeze (locks values continuously)
                        </label>
                    </div>
                    <div class="mem-stats">
                        <div class="mem-stat">
                            <div class="mem-stat-label">Frozen Values</div>
                            <div class="mem-stat-value" id="memFrozenCount">0</div>
                        </div>
                        <div class="mem-stat">
                            <div class="mem-stat-label">Update Rate</div>
                            <div class="mem-stat-value">50ms</div>
                        </div>
                    </div>
                </div>
                <div id="memFreezeList" class="mem-results"></div>
            </div>
            <div class="mem-tab-content" data-content="game" style="display:none;">
                <div class="mem-search-section">
                    <div style="text-align:center;margin-bottom:15px;">
                        <h4 style="margin:0 0 10px 0;color:#667eea;">🎮 Game Time Control</h4>
                        <p style="font-size:12px;opacity:0.7;margin:0;">Freeze all game animations and timers</p>
                    </div>
                    <div class="mem-input-group" style="justify-content:center;">
                        <button id="memToggleGameFreeze" class="mem-btn" style="width:80%;font-size:16px;padding:12px;">
                            ⏸️ Freeze Game
                        </button>
                    </div>
                    <div class="mem-stats">
                        <div class="mem-stat">
                            <div class="mem-stat-label">Game State</div>
                            <div class="mem-stat-value" id="memGameState" style="color:#4caf50;">Running</div>
                        </div>
                        <div class="mem-stat">
                            <div class="mem-stat-label">Blocked Calls</div>
                            <div class="mem-stat-value" id="memBlockedCalls">0</div>
                        </div>
                    </div>
                    <div style="margin-top:15px;padding:10px;background:rgba(255,193,7,0.1);border-radius:6px;border-left:3px solid #ffc107;">
                        <div style="font-size:11px;opacity:0.9;">
                            <strong>⚠️ Note:</strong> Freezing blocks requestAnimationFrame, setTimeout, and setInterval. 
                            Some games may detect this. Use carefully!
                        </div>
                    </div>
                </div>
            </div>
            <div class="mem-tab-content" data-content="contexts" style="display:none;">
                <div class="mem-search-section">
                    <button id="memDetectContexts" class="mem-btn" style="width:100%;margin-bottom:10px;">🔍 Detect Frames/Embeds/Canvases</button>
                    <div class="mem-stats" style="grid-template-columns: 1fr 1fr 1fr;">
                        <div class="mem-stat">
                            <div class="mem-stat-label">Frames</div>
                            <div class="mem-stat-value" id="memFrameCount">0</div>
                        </div>
                        <div class="mem-stat">
                            <div class="mem-stat-label">Embeds</div>
                            <div class="mem-stat-value" id="memEmbedCount">0</div>
                        </div>
                        <div class="mem-stat">
                            <div class="mem-stat-label">Canvases</div>
                            <div class="mem-stat-value" id="memCanvasCount">0</div>
                        </div>
                    </div>
                </div>
                <div id="memContextsList" class="mem-results"></div>
            </div>
            <div class="mem-tab-content" data-content="settings" style="display:none;">
                <div class="mem-search-section">
                    <label class="mem-checkbox-label">
                        <input type="checkbox" id="memAutoRefresh" class="mem-checkbox">
                        Auto-refresh watch list (1s)
                    </label>
                    <div class="mem-input-group" style="margin-top:10px;">
                        <button id="memExportBtn" class="mem-btn">📥 Export Results</button>
                        <button id="memHistoryBtn" class="mem-btn">📜 History</button>
                    </div>
                    <div class="mem-input-group">
                        <button id="memResetBtn" class="mem-btn mem-btn-danger">🔄 Reset All</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const tempDiv = createFragment(guiHTML);
    while (tempDiv.firstChild) {
        gui.appendChild(tempDiv.firstChild);
    }

    document.body.appendChild(gui);

    let isDragging = false;
    let currentX, currentY, initialX, initialY;
    const header = gui.querySelector('.mem-header');

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.mem-btn-icon')) return;
        isDragging = true;
        initialX = e.clientX - gui.offsetLeft;
        initialY = e.clientY - gui.offsetTop;
    });
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            gui.style.left = currentX + 'px';
            gui.style.top = currentY + 'px';
            gui.style.right = 'auto';
        }
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    gui.querySelectorAll('.mem-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            gui.querySelectorAll('.mem-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            gui.querySelectorAll('.mem-tab-content').forEach(c => c.style.display = 'none');
            gui.querySelector(`[data-content="${tab.dataset.tab}"]`).style.display = 'block';
        });
    });

    gui.querySelector('#memSearchType').addEventListener('change', (e) => {
        const rangeMax = gui.querySelector('#memRangeMax');
        rangeMax.style.display = e.target.value === 'range' ? 'block' : 'none';
    });

    function showToast(message, duration = 2000) {
        const toast = document.createElement('div');
        toast.className = 'mem-toast';
        const textNode = document.createTextNode(message);
        toast.appendChild(textNode);
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    function showModal(title, content, actions) {
        const modal = document.createElement('div');
        modal.className = 'mem-modal';
        const actionsHTML = actions.map(action =>
            `<button class="mem-btn ${action.class || ''}" data-action="${action.id}">${action.text}</button>`
        ).join('');

        const modalHTML = `
            <div class="mem-modal-content">
                <div class="mem-modal-header">${title}</div>
                <div class="mem-modal-body">${content}</div>
                <div class="mem-modal-actions">
                    ${actionsHTML}
                </div>
            </div>
        `;

        const tempDiv = createFragment(modalHTML);
        while (tempDiv.firstChild) {
            modal.appendChild(tempDiv.firstChild);
        }

        document.body.appendChild(modal);

        return new Promise((resolve) => {
            modal.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    modal.remove();
                    resolve(action);
                });
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve('cancel');
                }
            });
        });
    }

    function detectContexts() {
        state.detectedFrames = [];
        state.detectedEmbeds = [];
        state.detectedCanvases = [];

        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((iframe, i) => {
            try {
                const src = iframe.src || 'about:blank';
                const id = iframe.id || `iframe-${i}`;
                const accessible = canAccessFrame(iframe);
                state.detectedFrames.push({
                    element: iframe,
                    type: 'iframe',
                    src: src,
                    id: id,
                    accessible: accessible,
                    window: accessible ? iframe.contentWindow : null
                });
            } catch(e) {
                state.detectedFrames.push({
                    element: iframe,
                    type: 'iframe',
                    src: iframe.src || 'unknown',
                    id: iframe.id || `iframe-${i}`,
                    accessible: false,
                    window: null
                });
            }
        });

        const frames = document.querySelectorAll('frame');
        frames.forEach((frame, i) => {
            try {
                const src = frame.src || 'about:blank';
                const id = frame.id || `frame-${i}`;
                const accessible = canAccessFrame(frame);
                state.detectedFrames.push({
                    element: frame,
                    type: 'frame',
                    src: src,
                    id: id,
                    accessible: accessible,
                    window: accessible ? frame.contentWindow : null
                });
            } catch(e) {
                state.detectedFrames.push({
                    element: frame,
                    type: 'frame',
                    src: frame.src || 'unknown',
                    id: frame.id || `frame-${i}`,
                    accessible: false,
                    window: null
                });
            }
        });

        const embeds = document.querySelectorAll('embed, object');
        embeds.forEach((embed, i) => {
            const src = embed.src || embed.data || 'unknown';
            const id = embed.id || `embed-${i}`;
            const type = embed.type || 'unknown';
            state.detectedEmbeds.push({
                element: embed,
                type: 'embed',
                src: src,
                id: id,
                embedType: type
            });
        });

        const canvases = document.querySelectorAll('canvas');
        canvases.forEach((canvas, i) => {
            const id = canvas.id || `canvas-${i}`;
            const context2d = canvas.getContext('2d');
            const contextWebGL = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            state.detectedCanvases.push({
                element: canvas,
                type: 'canvas',
                id: id,
                width: canvas.width,
                height: canvas.height,
                has2D: !!context2d,
                hasWebGL: !!contextWebGL,
                context2d: context2d,
                contextWebGL: contextWebGL
            });
        });

        updateContextsDisplay();

        const total = state.detectedFrames.length + state.detectedEmbeds.length + state.detectedCanvases.length;
        if (total > 0) {
            showContextDetectionModal();
        } else {
            showToast('ℹ️ No frames, embeds, or canvases detected');
        }
    }

    function canAccessFrame(frame) {
        try {
            const test = frame.contentWindow.document;
            return true;
        } catch(e) {
            return false;
        }
    }

    async function showContextDetectionModal() {
        const framesList = state.detectedFrames.map((f, i) =>
            `<div class="mem-modal-item" data-type="frame" data-index="${i}">
                <div>
                    <div style="font-weight:600;">🖼️ ${f.type.toUpperCase()}: ${f.id}</div>
                    <div style="font-size:11px;opacity:0.7;">${f.src}</div>
                </div>
                <span class="mem-badge">${f.accessible ? 'Accessible' : 'Blocked'}</span>
            </div>`
        ).join('');

        const embedsList = state.detectedEmbeds.map((e, i) =>
            `<div class="mem-modal-item" data-type="embed" data-index="${i}">
                <div>
                    <div style="font-weight:600;">📦 EMBED: ${e.id}</div>
                    <div style="font-size:11px;opacity:0.7;">${e.src} (${e.embedType})</div>
                </div>
            </div>`
        ).join('');

        const canvasList = state.detectedCanvases.map((c, i) =>
            `<div class="mem-modal-item" data-type="canvas" data-index="${i}">
                <div>
                    <div style="font-weight:600;">🎨 CANVAS: ${c.id}</div>
                    <div style="font-size:11px;opacity:0.7;">${c.width}x${c.height} - ${c.has2D ? '2D' : ''}${c.has2D && c.hasWebGL ? ' + ' : ''}${c.hasWebGL ? 'WebGL' : ''}</div>
                </div>
            </div>`
        ).join('');

        const content = `
            <strong>Detected ${state.detectedFrames.length} frame(s), ${state.detectedEmbeds.length} embed(s), and ${state.detectedCanvases.length} canvas(es).</strong>
            <p style="margin:10px 0;">Would you like to load the memory editor inside one of these contexts?</p>
            <div class="mem-modal-list">
                ${framesList}
                ${embedsList}
                ${canvasList}
            </div>
        `;

        const modal = document.createElement('div');
        modal.className = 'mem-modal';

        const modalHTML = `
            <div class="mem-modal-content">
                <div class="mem-modal-header">🔍 Contexts Detected</div>
                <div class="mem-modal-body">${content}</div>
                <div class="mem-modal-actions">
                    <button class="mem-btn mem-btn-secondary" data-action="stay">Stay in Main Window</button>
                    <button class="mem-btn" data-action="switch">Switch Context</button>
                </div>
            </div>
        `;

        const tempDiv = createFragment(modalHTML);
        while (tempDiv.firstChild) {
            modal.appendChild(tempDiv.firstChild);
        }

        document.body.appendChild(modal);

        let selectedContext = null;
        modal.querySelectorAll('.mem-modal-item').forEach(item => {
            item.addEventListener('click', () => {
                modal.querySelectorAll('.mem-modal-item').forEach(i => i.style.background = 'rgba(255,255,255,0.05)');
                item.style.background = 'rgba(102,126,234,0.5)';
                selectedContext = {
                    type: item.dataset.type,
                    index: parseInt(item.dataset.index)
                };
            });
        });

        modal.querySelector('[data-action="stay"]').addEventListener('click', () => {
            modal.remove();
            showToast('ℹ️ Staying in main window');
        });

        modal.querySelector('[data-action="switch"]').addEventListener('click', () => {
            if (!selectedContext) {
                showToast('⚠️ Please select a context first');
                return;
            }
            modal.remove();
            switchContext(selectedContext);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    function switchContext(context) {
        if (context.type === 'frame') {
            const frame = state.detectedFrames[context.index];
            if (!frame.accessible) {
                showToast('❌ Cannot access this frame (CORS policy)');
                return;
            }
            state.currentContext = frame.window;
            state.contextName = `Frame: ${frame.id}`;
            showToast(`✅ Switched to ${frame.type}: ${frame.id}`);
        } else if (context.type === 'canvas') {
            const canvas = state.detectedCanvases[context.index];
            state.currentContext = {
                canvas: canvas.element,
                context2d: canvas.context2d,
                contextWebGL: canvas.contextWebGL,
                _isCanvasContext: true
            };
            state.contextName = `Canvas: ${canvas.id}`;
            showToast(`✅ Switched to canvas: ${canvas.id}`);
        } else if (context.type === 'embed') {
            const embed = state.detectedEmbeds[context.index];
            state.currentContext = embed.element;
            state.contextName = `Embed: ${embed.id}`;
            showToast(`✅ Switched to embed: ${embed.id}`);
        }

        gui.querySelector('#memContextName').textContent = state.contextName;

        state.matches = [];
        state.filteredMatches = [];
        updateResults();
    }

    function updateContextsDisplay() {
        gui.querySelector('#memFrameCount').textContent = state.detectedFrames.length;
        gui.querySelector('#memEmbedCount').textContent = state.detectedEmbeds.length;
        gui.querySelector('#memCanvasCount').textContent = state.detectedCanvases.length;

        const listDiv = gui.querySelector('#memContextsList');
        const total = state.detectedFrames.length + state.detectedEmbeds.length + state.detectedCanvases.length;
        if (total === 0) {
            listDiv.textContent = '';
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'mem-empty';
            emptyDiv.textContent = 'Click "Detect" to scan for frames, embeds, and canvases';
            listDiv.appendChild(emptyDiv);
            return;
        }

        listDiv.textContent = '';

        state.detectedFrames.forEach((f, i) => {
            const item = document.createElement('div');
            item.className = 'mem-result-item';

            const itemHTML = `
                <div class="mem-result-header">
                    <span class="mem-result-path">🖼️ ${f.type.toUpperCase()}: ${f.id}</span>
                    <span class="mem-badge">${f.accessible ? 'OK' : 'Blocked'}</span>
                </div>
                <div style="font-size:11px;margin-bottom:8px;opacity:0.7;">${f.src}</div>
                <button class="mem-result-btn" data-type="frame" data-index="${i}" ${!f.accessible ? 'disabled' : ''}>
                    Switch to this Frame
                </button>
            `;

            const tempDiv = createFragment(itemHTML);
            while (tempDiv.firstChild) {
                item.appendChild(tempDiv.firstChild);
            }

            if (f.accessible) {
                item.querySelector('button').addEventListener('click', () => {
                    switchContext({ type: 'frame', index: i });
                });
            }

            listDiv.appendChild(item);
        });

        state.detectedEmbeds.forEach((e, i) => {
            const item = document.createElement('div');
            item.className = 'mem-result-item';

            const itemHTML = `
                <div class="mem-result-header">
                    <span class="mem-result-path">📦 EMBED: ${e.id}</span>
                </div>
                <div style="font-size:11px;margin-bottom:8px;opacity:0.7;">${e.src} (${e.embedType})</div>
                <button class="mem-result-btn" data-type="embed" data-index="${i}">
                    Switch to this Embed
                </button>
            `;

            const tempDiv = createFragment(itemHTML);
            while (tempDiv.firstChild) {
                item.appendChild(tempDiv.firstChild);
            }

            item.querySelector('button').addEventListener('click', () => {
                switchContext({ type: 'embed', index: i });
            });

            listDiv.appendChild(item);
        });

        state.detectedCanvases.forEach((c, i) => {
            const item = document.createElement('div');
            item.className = 'mem-result-item';

            const itemHTML = `
                <div class="mem-result-header">
                    <span class="mem-result-path">🎨 CANVAS: ${c.id}</span>
                </div>
                <div style="font-size:11px;margin-bottom:8px;opacity:0.7;">
                    ${c.width}x${c.height} - ${c.has2D ? '2D' : ''}${c.has2D && c.hasWebGL ? ' + ' : ''}${c.hasWebGL ? 'WebGL' : ''}
                </div>
                <button class="mem-result-btn" data-type="canvas" data-index="${i}">
                    Switch to this Canvas
                </button>
            `;

            const tempDiv = createFragment(itemHTML);
            while (tempDiv.firstChild) {
                item.appendChild(tempDiv.firstChild);
            }

            item.querySelector('button').addEventListener('click', () => {
                switchContext({ type: 'canvas', index: i });
            });

            listDiv.appendChild(item);
        });
    }

    // Serialize window object for server-side scanning
    function serializeForServer(obj, visited = new WeakSet(), depth = 0, maxDepth = 50) {
        if (depth > maxDepth) return null;
        if (!obj || typeof obj !== 'object') return obj;
        if (visited.has(obj)) return '[Circular]';
        
        visited.add(obj);
        
        try {
            if (Array.isArray(obj)) {
                return obj.slice(0, 100).map(item => serializeForServer(item, visited, depth + 1, maxDepth));
            }
            
            const serialized = {};
            const keys = Object.keys(obj);
            
            // Limit keys to prevent massive payloads
            for (let i = 0; i < Math.min(keys.length, 1000); i++) {
                const key = keys[i];
                try {
                    const val = obj[key];
                    const valType = typeof val;
                    
                    if (valType === 'function') continue;
                    if (key === 'window' || key === 'document' || key === 'parent' || key === 'top') continue;
                    
                    if (valType === 'object' && val !== null) {
                        serialized[key] = serializeForServer(val, visited, depth + 1, maxDepth);
                    } else {
                        serialized[key] = val;
                    }
                } catch(e) {}
            }
            
            return serialized;
        } catch(e) {
            return null;
        }
    }

    // Server-side deep scan
    async function serverScan(searchValue, searchType, includeStrings) {
        try {
            console.log('🔍 Starting server scan...');
            console.log('Server URL:', SERVER_URL);
            
            // Check if server is available using GM_xmlhttpRequest (bypasses CSP)
            await new Promise((resolve, reject) => {
                console.log('Testing server connection...');
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${SERVER_URL}/health`,
                    timeout: 5000,
                    onload: (response) => {
                        console.log('Health check response:', response.status, response.responseText);
                        if (response.status === 200) {
                            resolve();
                        } else {
                            reject(new Error('Server not available'));
                        }
                    },
                    onerror: (err) => {
                        console.error('Health check error:', err);
                        reject(new Error('Server not available'));
                    },
                    ontimeout: () => {
                        console.error('Health check timeout');
                        reject(new Error('Server timeout'));
                    }
                });
            });
            
            showToast('📡 Sending data to server for ultra-deep scan...');
            
            // Serialize window data
            const windowData = {};
            const windowKeys = Object.keys(window);
            
            for (let key of windowKeys) {
                try {
                    const val = window[key];
                    if (typeof val === 'object' && val !== null && 
                        !key.startsWith('webkit') && 
                        !key.startsWith('moz') &&
                        !key.startsWith('chrome') &&
                        !key.startsWith('HTML') &&
                        !key.startsWith('SVG') &&
                        !key.startsWith('Web') &&
                        key !== 'document' && 
                        key !== 'location') {
                        windowData[key] = serializeForServer(val);
                    }
                } catch(e) {}
            }
            
            // Add localStorage and sessionStorage
            try {
                windowData._localStorage = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    windowData._localStorage[key] = localStorage.getItem(key);
                }
            } catch(e) {}
            
            try {
                windowData._sessionStorage = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    windowData._sessionStorage[key] = sessionStorage.getItem(key);
                }
            } catch(e) {}
            
            const payload = {
                data: JSON.stringify(windowData),
                searchValue: searchValue,
                searchType: searchType,
                includeStrings: includeStrings,
                maxDepth: 100
            };
            
            const result = await new Promise((resolve, reject) => {
                console.log('Sending scan request with payload size:', JSON.stringify(payload).length, 'bytes');
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `${SERVER_URL}/scan`,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify(payload),
                    timeout: 60000, // 60 second timeout for deep scans
                    onload: (response) => {
                        console.log('Scan response:', response.status, response.responseText.substring(0, 200));
                        if (response.status === 200) {
                            try {
                                resolve(JSON.parse(response.responseText));
                            } catch(e) {
                                console.error('Parse error:', e);
                                reject(new Error('Invalid server response'));
                            }
                        } else {
                            reject(new Error('Server scan failed'));
                        }
                    },
                    onerror: (err) => {
                        console.error('Scan request error:', err);
                        reject(new Error('Server request failed'));
                    },
                    ontimeout: () => {
                        console.error('Scan request timeout');
                        reject(new Error('Server timeout'));
                    }
                });
            });
            
            if (result.success) {
                // Convert server matches back to our format
                const serverMatches = result.matches.map(m => ({
                    path: m.path,
                    val: m.val,
                    type: m.type,
                    obj: window, // Approximate - we can't reconstruct exact object reference
                    key: m.path.split('.').pop()
                }));
                
                showToast(`🚀 Server scan complete in ${result.elapsed}s - ${result.filtered} matches!`);
                return serverMatches;
            } else {
                throw new Error(result.error || 'Server scan failed');
            }
            
        } catch(err) {
            console.error('Server scan error:', err);
            showToast('⚠️ Server unavailable, using client-side deep scan...');
            return null; // Fall back to client-side
        }
    }

    function deepScan(obj, path = 'window', visited = new WeakSet(), depth = 0, maxDepth = 10) {
        if (state.scanAborted) return; // Check abort first
        if (!obj || typeof obj !== 'object') return;
        if (visited.has(obj)) return;
        if (depth > maxDepth) return;
        
        visited.add(obj);

        const deepScanEnabled = gui.querySelector('#memDeepScan').checked;
        const actualMaxDepth = deepScanEnabled ? 25 : 8;
        if (depth > actualMaxDepth) return;
        
        // Update progress less frequently for speed
        if (depth < 2 && state.scanProgress++ % 500 === 0) {
            updateScanProgress();
        }

        try {
            // Fast path: only scan enumerable properties
            for (let key in obj) {
                if (state.scanAborted) return;
                try {
                    const val = obj[key];
                    const fullPath = `${path}.${key}`;

                    if (checkMatch(val, fullPath, obj, key)) {
                        state.matches.push({
                            obj: obj,
                            key: key,
                            val: val,
                            path: fullPath,
                            type: typeof val
                        });
                    }

                    if (typeof val === 'object' && val !== null && !visited.has(val)) {
                        deepScan(val, fullPath, visited, depth + 1, actualMaxDepth);
                    }
                } catch(e) {}
            }
            
            // Only do expensive operations if deep scan enabled
            if (deepScanEnabled && depth < actualMaxDepth - 5) {
                try {
                    const proto = Object.getPrototypeOf(obj);
                    if (proto && proto !== Object.prototype && !visited.has(proto)) {
                        deepScan(proto, `${path}.__proto__`, visited, depth + 1, actualMaxDepth);
                    }
                } catch(e) {}
            }
        } catch(e) {}
    }

    function updateScanProgress() {
        try {
            const loadingText = gui.querySelector('.mem-loading p');
            if (loadingText && state.scanning) {
                loadingText.textContent = `Scanning memory... (${state.scanProgress} objects scanned)`;
            }
        } catch(e) {}
    }

    function scanCurrentContext() {
        if (state.currentContext._isCanvasContext) {
            scanCanvas(state.currentContext);
            return;
        }
        if (state.currentContext instanceof HTMLElement) {
            scanElement(state.currentContext);
            return;
        }
        
        state.scanProgress = 0;
        state.scanAborted = false;
        const deepScanEnabled = gui.querySelector('#memDeepScan').checked;
        
        // Priority 1: Scan all custom global variables (where games store data)
        try {
            const windowKeys = Object.keys(state.currentContext);
            windowKeys.forEach(key => {
                if (state.scanAborted) return;
                try {
                    const val = state.currentContext[key];
                    // Skip browser internals, focus on custom objects
                    if (typeof val === 'object' && val !== null && 
                        !key.startsWith('webkit') && 
                        !key.startsWith('moz') &&
                        !key.startsWith('chrome') &&
                        !key.startsWith('HTML') &&
                        !key.startsWith('SVG') &&
                        !key.startsWith('Web') &&
                        key !== 'document' && 
                        key !== 'location' &&
                        key !== 'history' &&
                        key !== 'navigator' &&
                        key !== 'performance' &&
                        key !== 'screen' &&
                        key !== 'CSS' &&
                        key !== 'visualViewport') {
                        deepScan(val, key);
                    }
                } catch(e) {}
            });
        } catch(e) {}
        
        if (state.scanAborted) return;
        
        // Priority 2: localStorage/sessionStorage (saved game data)
        try {
            if (state.currentContext.localStorage) {
                for (let i = 0; i < state.currentContext.localStorage.length; i++) {
                    const key = state.currentContext.localStorage.key(i);
                    const val = state.currentContext.localStorage.getItem(key);
                    const path = `localStorage['${key}']`;
                    if (checkMatch(val, path, state.currentContext.localStorage, key)) {
                        state.matches.push({
                            obj: state.currentContext.localStorage,
                            key: key,
                            val: val,
                            path: path,
                            type: 'string'
                        });
                    }
                }
            }
        } catch(e) {}
        
        try {
            if (state.currentContext.sessionStorage) {
                for (let i = 0; i < state.currentContext.sessionStorage.length; i++) {
                    const key = state.currentContext.sessionStorage.key(i);
                    const val = state.currentContext.sessionStorage.getItem(key);
                    const path = `sessionStorage['${key}']`;
                    if (checkMatch(val, path, state.currentContext.sessionStorage, key)) {
                        state.matches.push({
                            obj: state.currentContext.sessionStorage,
                            key: key,
                            val: val,
                            path: path,
                            type: 'string'
                        });
                    }
                }
            }
        } catch(e) {}
        
        // Priority 3: Canvas (only if deep scan)
        if (deepScanEnabled && !state.scanAborted) {
            try {
                const canvases = state.currentContext.document?.querySelectorAll('canvas') || [];
                const limit = Math.min(canvases.length, 20);
                for (let i = 0; i < limit; i++) {
                    if (state.scanAborted) break;
                    try {
                        const canvas = canvases[i];
                        deepScan(canvas, `canvas[${i}]`);
                        const ctx = canvas.getContext('2d') || canvas.getContext('webgl') || canvas.getContext('webgl2');
                        if (ctx) deepScan(ctx, `canvas[${i}].ctx`);
                    } catch(e) {}
                }
            } catch(e) {}
        }
    }

    function scanCanvas(canvasContext) {
        const canvas = canvasContext.canvas;
        const ctx2d = canvasContext.context2d;
        const ctxWebGL = canvasContext.contextWebGL;

        deepScan(canvas, 'canvas');

        if (ctx2d) {
            deepScan(ctx2d, 'canvas.2d');
        }

        if (ctxWebGL) {
            deepScan(ctxWebGL, 'canvas.webgl');
        }

        showToast('ℹ️ Canvas contexts scanned');
    }

    function scanElement(element) {
        deepScan(element, 'element');
        showToast('ℹ️ Element properties scanned');
    }

    function checkMatch(val, path, obj, key) {
        const searchType = gui.querySelector('#memSearchType').value;
        const searchValue = gui.querySelector('#memSearchValue').value;
        const includeStrings = gui.querySelector('#memStringSearch').checked;

        if (searchType === 'increased' || searchType === 'decreased' || searchType === 'unchanged') {
            if (state.previousMatches.length === 0) return false;
            
            const prevMatch = state.previousMatches.find(m => m.path === path);
            if (!prevMatch) return false;
            
            const prevVal = prevMatch.val;
            const currentVal = val;
            
            if (typeof prevVal !== 'number' || typeof currentVal !== 'number') return false;
            
            if (searchType === 'increased') return currentVal > prevVal;
            if (searchType === 'decreased') return currentVal < prevVal;
            if (searchType === 'unchanged') return currentVal === prevVal;
            
            return false;
        }

        if (searchType === 'exact') {
            const numValue = parseFloat(searchValue);
            if (!isNaN(numValue) && typeof val === 'number') {
                return val === numValue;
            }

            if (includeStrings && typeof val === 'string') {
                return val.includes(searchValue);
            }
        }

        if (searchType === 'range') {
            const min = parseFloat(searchValue);
            const max = parseFloat(gui.querySelector('#memRangeMax').value);
            if (!isNaN(min) && !isNaN(max) && typeof val === 'number') {
                return val >= min && val <= max;
            }
        }

        if (searchType === 'fuzzy') {
            if (typeof val === 'number') {
                const numValue = parseFloat(searchValue);
                if (!isNaN(numValue)) {
                    const tolerance = numValue * 0.1;
                    return Math.abs(val - numValue) <= tolerance;
                }
            }

            if (includeStrings && typeof val === 'string') {
                return val.toLowerCase().includes(searchValue.toLowerCase());
            }
        }

        return false;
    }

    function performScan(isNextScan = false) {
        const searchValue = gui.querySelector('#memSearchValue').value;
        const searchType = gui.querySelector('#memSearchType').value;
        
        if (!isNextScan && !searchValue) return showToast('⚠️ Enter a value to search!');
        if (isNextScan) {
            if (state.previousMatches.length === 0) {
                return showToast('⚠️ Need initial scan first!');
            }
            if ((searchType === 'increased' || searchType === 'decreased' || searchType === 'unchanged') && !searchValue) {
                // These types don't need a search value
            } else if (!searchValue && searchType !== 'increased' && searchType !== 'decreased' && searchType !== 'unchanged') {
                return showToast('⚠️ Enter a value to search!');
            }
        }

        const resultsDiv = gui.querySelector('#memResults');
        resultsDiv.textContent = '';
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'mem-loading';
        const spinner = document.createElement('div');
        spinner.className = 'mem-spinner';
        const loadingText = document.createElement('p');
        const deepScanEnabled = gui.querySelector('#memDeepScan').checked;
        loadingText.textContent = isNextScan ? 'Filtering results...' : (deepScanEnabled ? 'Deep scanning (5-15 seconds)...' : 'Fast scanning...');
        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(loadingText);
        resultsDiv.appendChild(loadingDiv);

        if (!isNextScan) {
            state.previousMatches = [];
            state.matches = [];
            state.filteredMatches = [];
        }
        state.scanning = true;
        state.scanAborted = false;

        setTimeout(async () => {
            // Use server-side scanning for initial deep scans
            if (!isNextScan && deepScanEnabled) {
                const serverMatches = await serverScan(searchValue, searchType, gui.querySelector('#memStringSearch').checked);
                
                if (serverMatches) {
                    state.matches = serverMatches;
                    state.filteredMatches = state.matches.slice();
                    state.searchHistory.push({
                        value: searchValue,
                        type: searchType,
                        count: state.matches.length,
                        timestamp: Date.now(),
                        context: state.contextName + ' (Server)',
                        isNextScan: false
                    });
                    
                    updateResults();
                    state.scanning = false;
                    
                    if (state.matches.length > 0) {
                        gui.querySelector('#memNextScanGroup').style.display = 'flex';
                        state.previousMatches = state.matches.map(m => ({
                            path: m.path,
                            val: m.val,
                            type: m.type,
                            obj: m.obj,
                            key: m.key
                        }));
                    }
                    return;
                }
                // If server failed, fall through to client-side scan
            }
            
            if (isNextScan) {
                // Store previous values for comparison
                const previousValues = new Map(state.previousMatches.map(m => [m.path, m.val]));
                
                const newMatches = [];
                state.matches.forEach(m => {
                    try {
                        const currentVal = m.obj[m.key];
                        m.val = currentVal;
                        
                        // Store previous value for comparison
                        const prevMatch = state.previousMatches.find(pm => pm.path === m.path);
                        if (prevMatch) {
                            m.previousVal = prevMatch.val;
                        }
                        
                        if (checkMatch(currentVal, m.path, m.obj, m.key)) {
                            newMatches.push(m);
                        }
                    } catch(e) {}
                });
                state.matches = newMatches;
            } else {
                // Clear everything for fresh scan
                state.matches = [];
                scanCurrentContext();
            }
            
            state.filteredMatches = state.matches.slice();
            state.searchHistory.push({
                value: searchValue,
                type: searchType,
                count: state.matches.length,
                timestamp: Date.now(),
                context: state.contextName,
                isNextScan: isNextScan
            });

            updateResults();
            state.scanning = false;
            
            if (state.matches.length > 0 && !isNextScan) {
                gui.querySelector('#memNextScanGroup').style.display = 'flex';
                state.previousMatches = state.matches.map(m => ({
                    path: m.path,
                    val: m.val,
                    type: m.type,
                    obj: m.obj,
                    key: m.key
                }));
            }

            showToast(`✅ Found ${state.matches.length} matches in ${state.contextName}!`);
        }, 100);
    }

    gui.querySelector('#memSearchBtn').addEventListener('click', () => {
        performScan(false);
    });

    gui.querySelector('#memNextScanBtn').addEventListener('click', () => {
        performScan(true);
    });

    gui.querySelector('#memNewScanBtn').addEventListener('click', () => {
        state.matches = [];
        state.filteredMatches = [];
        state.previousMatches = [];
        gui.querySelector('#memNextScanGroup').style.display = 'none';
        gui.querySelector('#memSearchValue').value = '';
        gui.querySelector('#memFilterInput').value = '';
        updateResults();
        showToast('🔄 Ready for new scan');
    });

    gui.querySelector('#memFilterInput').addEventListener('input', (e) => {
        const filter = e.target.value.toLowerCase();
        state.filteredMatches = state.matches.filter(m =>
            m.path.toLowerCase().includes(filter)
        );
        updateResults();
    });

    function updateResults() {
        const resultsDiv = gui.querySelector('#memResults');
        gui.querySelector('#memTotalMatches').textContent = state.matches.length;
        gui.querySelector('#memFilteredMatches').textContent = state.filteredMatches.length;
        if (state.filteredMatches.length === 0) {
            resultsDiv.textContent = '';
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'mem-empty';
            emptyDiv.textContent = 'No matches found. Try a different search!';
            resultsDiv.appendChild(emptyDiv);
            return;
        }

        resultsDiv.textContent = '';

        state.filteredMatches.slice(0, 100).forEach((m, i) => {
            const item = createResultItem(m, i);
            resultsDiv.appendChild(item);
        });

        if (state.filteredMatches.length > 100) {
            const more = document.createElement('div');
            more.className = 'mem-empty';
            const moreText = document.createTextNode(`+ ${state.filteredMatches.length - 100} more results (use filter to narrow down)`);
            more.appendChild(moreText);
            resultsDiv.appendChild(more);
        }
    }

    function createResultItem(match, index) {
        const div = document.createElement('div');
        div.className = 'mem-result-item';

        const valueStr = match.type === 'string' ? `"${match.val}"` : match.val;

        const itemHTML = `
            <div class="mem-result-header">
                <span class="mem-result-path" title="${match.path}">${match.path}</span>
            </div>
            <div class="mem-result-controls">
                <input type="${match.type === 'number' ? 'number' : 'text'}"
                       class="mem-result-input"
                       value="${match.val}"
                       data-index="${index}">
                <button class="mem-result-btn" data-index="${index}">Set</button>
                <button class="mem-result-btn mem-watch-btn" data-index="${index}">Watch</button>
                <button class="mem-result-btn" style="background:rgba(33,150,243,0.6)" data-index="${index}" data-action="freeze">Freeze</button>
            </div>
        `;

        const tempDiv = createFragment(itemHTML);
        while (tempDiv.firstChild) {
            div.appendChild(tempDiv.firstChild);
        }

        const input = div.querySelector('input');
        const setBtn = div.querySelector('.mem-result-btn:not(.mem-watch-btn)');
        const watchBtn = div.querySelector('.mem-watch-btn');

        setBtn.addEventListener('click', () => {
            const newVal = match.type === 'number' ? parseFloat(input.value) : input.value;
            if ((match.type === 'number' && !isNaN(newVal)) || match.type === 'string') {
                try {
                    match.obj[match.key] = newVal;
                    showToast(`✅ ${match.key} = ${newVal}`);
                } catch(e) {
                    showToast(`❌ Failed to update: ${e.message}`);
                }
            }
        });

        watchBtn.addEventListener('click', () => {
            if (!state.watchList.find(w => w.path === match.path)) {
                state.watchList.push({ ...match });
                showToast(`👁️ Added to watch list`);
                updateWatchList();
            }
        });

        const freezeBtn = div.querySelector('[data-action="freeze"]');
        freezeBtn.addEventListener('click', () => {
            if (!state.freezeList.find(f => f.path === match.path)) {
                const freezeValue = match.type === 'number' ? parseFloat(input.value) : input.value;
                state.freezeList.push({ ...match, freezeValue });
                showToast(`❄️ Added to freeze list`);
                updateFreezeList();
            }
        });

        return div;
    }

    function updateWatchList() {
        const watchDiv = gui.querySelector('#memWatchList');

        if (state.watchList.length === 0) {
            watchDiv.textContent = '';
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'mem-empty';
            emptyDiv.textContent = 'No items in watch list. Add items from search results!';
            watchDiv.appendChild(emptyDiv);
            return;
        }

        watchDiv.textContent = '';

        state.watchList.forEach((m, i) => {
            try {
                m.val = m.obj[m.key];
            } catch(e) {}

            const item = document.createElement('div');
            item.className = 'mem-result-item';

            const itemHTML = `
                <div class="mem-result-header">
                    <span class="mem-result-path" title="${m.path}">${m.path}</span>
                </div>
                <div class="mem-result-controls">
                    <span style="color:#667eea;font-weight:600;">${m.val}</span>
                    <button class="mem-result-btn mem-btn-danger" data-index="${i}">Remove</button>
                </div>
            `;

            const tempDiv = createFragment(itemHTML);
            while (tempDiv.firstChild) {
                item.appendChild(tempDiv.firstChild);
            }

            item.querySelector('button').addEventListener('click', () => {
                state.watchList.splice(i, 1);
                updateWatchList();
                showToast('🗑️ Removed from watch list');
            });

            watchDiv.appendChild(item);
        });
    }

    function updateFreezeList() {
        const freezeDiv = gui.querySelector('#memFreezeList');
        gui.querySelector('#memFrozenCount').textContent = state.freezeList.length;

        if (state.freezeList.length === 0) {
            freezeDiv.textContent = '';
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'mem-empty';
            emptyDiv.textContent = 'No frozen items. Add items from search results!';
            freezeDiv.appendChild(emptyDiv);
            return;
        }

        freezeDiv.textContent = '';

        state.freezeList.forEach((m, i) => {
            const item = document.createElement('div');
            item.className = 'mem-result-item';

            const itemHTML = `
                <div class="mem-result-header">
                    <span class="mem-result-path" title="${m.path}">${m.path}</span>
                    <span class="mem-badge" style="background:rgba(33,150,243,0.3);color:#2196f3;">FROZEN</span>
                </div>
                <div class="mem-result-controls">
                    <input type="${m.type === 'number' ? 'number' : 'text'}"
                           class="mem-result-input"
                           value="${m.freezeValue}"
                           data-index="${i}">
                    <button class="mem-result-btn" data-index="${i}">Update</button>
                    <button class="mem-result-btn mem-btn-danger" data-index="${i}" data-action="remove">Remove</button>
                </div>
            `;

            const tempDiv = createFragment(itemHTML);
            while (tempDiv.firstChild) {
                item.appendChild(tempDiv.firstChild);
            }

            const input = item.querySelector('input');
            const updateBtn = item.querySelector('.mem-result-btn:not(.mem-btn-danger)');
            const removeBtn = item.querySelector('[data-action="remove"]');

            updateBtn.addEventListener('click', () => {
                const newVal = m.type === 'number' ? parseFloat(input.value) : input.value;
                state.freezeList[i].freezeValue = newVal;
                showToast('❄️ Freeze value updated');
            });

            removeBtn.addEventListener('click', () => {
                state.freezeList.splice(i, 1);
                updateFreezeList();
                showToast('🗑️ Removed from freeze list');
            });

            freezeDiv.appendChild(item);
        });
    }

    function applyFreezes() {
        state.freezeList.forEach(m => {
            try {
                m.obj[m.key] = m.freezeValue;
            } catch(e) {}
        });
    }

    function freezeGame() {
        if (state.gameFrozen) return;
        
        // Save original functions if not already saved
        if (!state.originalRAF) state.originalRAF = window.requestAnimationFrame;
        if (!state.originalSetTimeout) state.originalSetTimeout = window.setTimeout;
        if (!state.originalSetInterval) state.originalSetInterval = window.setInterval;
        
        window.requestAnimationFrame = function(callback) {
            state.frozenCallbacks.push({ type: 'raf', callback });
            return state.frozenCallbacks.length;
        };
        
        window.setTimeout = function(callback, delay, ...args) {
            state.frozenCallbacks.push({ type: 'timeout', callback, delay, args });
            return state.frozenCallbacks.length;
        };
        
        window.setInterval = function(callback, delay, ...args) {
            state.frozenCallbacks.push({ type: 'interval', callback, delay, args });
            return state.frozenCallbacks.length;
        };
        
        state.gameFrozen = true;
        updateGameFreezeUI();
        showToast('⏸️ Game frozen!');
    }

    function unfreezeGame() {
        if (!state.gameFrozen) return;
        
        // Restore original functions
        if (state.originalRAF) {
            window.requestAnimationFrame = state.originalRAF;
        }
        if (state.originalSetTimeout) {
            window.setTimeout = state.originalSetTimeout;
        }
        if (state.originalSetInterval) {
            window.setInterval = state.originalSetInterval;
        }
        
        state.frozenCallbacks = [];
        state.gameFrozen = false;
        updateGameFreezeUI();
        showToast('▶️ Game resumed!');
    }

    function updateGameFreezeUI() {
        const btn = gui.querySelector('#memToggleGameFreeze');
        const stateDiv = gui.querySelector('#memGameState');
        const blockedDiv = gui.querySelector('#memBlockedCalls');
        
        if (state.gameFrozen) {
            btn.innerHTML = '▶️ Resume Game';
            btn.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
            stateDiv.textContent = 'Frozen';
            stateDiv.style.color = '#f5576c';
        } else {
            btn.innerHTML = '⏸️ Freeze Game';
            btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            stateDiv.textContent = 'Running';
            stateDiv.style.color = '#4caf50';
        }
        
        blockedDiv.textContent = state.frozenCallbacks.length;
    }

    setInterval(() => {
        if (state.gameFrozen) {
            gui.querySelector('#memBlockedCalls').textContent = state.frozenCallbacks.length;
        }
    }, 100);

    gui.querySelector('#memToggleGameFreeze').addEventListener('click', () => {
        if (state.gameFrozen) {
            unfreezeGame();
        } else {
            freezeGame();
        }
    });

    gui.querySelector('#memAutoRefresh').addEventListener('change', (e) => {
        if (e.target.checked) {
            state.refreshInterval = setInterval(updateWatchList, 1000);
            showToast('🔄 Auto-refresh enabled');
        } else {
            clearInterval(state.refreshInterval);
            showToast('⏸️ Auto-refresh disabled');
        }
    });

    gui.querySelector('#memFreezeActive').addEventListener('change', (e) => {
        if (e.target.checked) {
            state.freezeInterval = setInterval(applyFreezes, 50);
            showToast('❄️ Freeze enabled - values locked!');
        } else {
            clearInterval(state.freezeInterval);
            showToast('🔥 Freeze disabled');
        }
    });

    gui.querySelector('#memClearBtn').addEventListener('click', () => {
        state.matches = [];
        state.filteredMatches = [];
        state.previousMatches = [];
        gui.querySelector('#memNextScanGroup').style.display = 'none';
        updateResults();
        gui.querySelector('#memFilterInput').value = '';
        showToast('🗑️ Results cleared');
    });

    gui.querySelector('#memExportBtn').addEventListener('click', () => {
        const data = {
            matches: state.matches.map(m => ({
                path: m.path,
                value: m.val,
                type: m.type
            })),
            watchList: state.watchList.map(m => ({
                path: m.path,
                value: m.val,
                type: m.type
            })),
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `memory-scan-${Date.now()}.json`;
        a.click();
        showToast('📥 Exported to JSON');
    });

    gui.querySelector('#memHistoryBtn').addEventListener('click', () => {
        const history = state.searchHistory.map(h =>
            `${new Date(h.timestamp).toLocaleTimeString()} - ${h.type}: ${h.value} (${h.count} results)`
        ).join('\n');

        alert(history || 'No search history yet');
    });

    gui.querySelector('#memResetBtn').addEventListener('click', () => {
        if (confirm('Reset all data including watch list, freeze list, and history?')) {
            state.matches = [];
            state.filteredMatches = [];
            state.searchHistory = [];
            state.watchList = [];
            state.freezeList = [];
            clearInterval(state.freezeInterval);
            gui.querySelector('#memFreezeActive').checked = false;
            updateResults();
            updateWatchList();
            updateFreezeList();
            showToast('🔄 All data reset');
        }
    });

    gui.querySelector('#memMinimize').addEventListener('click', () => {
        gui.classList.toggle('mem-minimized');
    });

    gui.querySelector('#memClose').addEventListener('click', () => {
        gui.style.display = 'none';
    });

    gui.querySelector('#memDetectContexts').addEventListener('click', () => {
        detectContexts();
    });

    gui.querySelector('#memSwitchContext').addEventListener('click', () => {
        detectContexts();
    });

    updateFreezeList();

    setTimeout(() => {
        detectContexts();
    }, 1000);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'M') {
            gui.style.display = gui.style.display === 'none' ? 'flex' : 'none';
        }
    });

    showToast('⚡ Memory Editor Pro loaded! Press Ctrl+Shift+M to toggle');
})();