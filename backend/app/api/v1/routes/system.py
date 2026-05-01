"""
System & Logging Routes.
"""

import os
import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from app.core.config import get_settings

router = APIRouter(prefix="/system", tags=["System"])
settings = get_settings()

def get_log_path():
    return os.path.join(settings.log_dir, settings.log_file)

@router.get("/logs", response_class=HTMLResponse)
async def view_logs(request: Request):
    """
    A simple HTML page to view streaming logs with latest on top.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>CSAgent Live Logs</title>
        <style>
            body { 
                background-color: #0f172a; 
                color: #e2e8f0; 
                font-family: 'Cascadia Code', 'Courier New', Courier, monospace; 
                margin: 0; 
                padding: 20px; 
            }
            .header {
                position: sticky;
                top: 0;
                background: #1e293b;
                padding: 10px 20px;
                margin: -20px -20px 20px -20px;
                border-bottom: 1px solid #334155;
                display: flex;
                justify-content: space-between;
                align-items: center;
                z-index: 100;
            }
            h1 { margin: 0; font-size: 1.2rem; color: #38bdf8; }
            #log-container { 
                display: flex; 
                flex-direction: column; 
            }
            .log-entry { 
                padding: 4px 8px; 
                border-bottom: 1px solid #1e293b;
                white-space: pre-wrap;
                word-break: break-all;
                animation: fadeIn 0.3s ease-out;
            }
            .log-entry:hover { background-color: #1e293b; }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .timestamp { color: #94a3b8; margin-right: 10px; font-size: 0.85rem; }
            .level-info { color: #22c55e; font-weight: bold; }
            .level-error { color: #ef4444; font-weight: bold; }
            .level-warning { color: #f59e0b; font-weight: bold; }
            .status { font-size: 0.8rem; color: #94a3b8; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚀 CSAgent Live Logs</h1>
            <div class="status" id="connection-status">Connecting...</div>
        </div>
        <div id="log-container"></div>

        <script>
            const container = document.getElementById('log-container');
            const status = document.getElementById('connection-status');
            
            function addLog(text) {
                if (!text.trim()) return;
                
                const entry = document.createElement('div');
                entry.className = 'log-entry';
                
                // Simple colorizing
                let formattedText = text;
                if (text.includes('| INFO')) {
                    formattedText = text.replace('| INFO', '| <span class="level-info">INFO</span>');
                } else if (text.includes('| ERROR')) {
                    formattedText = text.replace('| ERROR', '| <span class="level-error">ERROR</span>');
                } else if (text.includes('| WARNING')) {
                    formattedText = text.replace('| WARNING', '| <span class="level-warning">WARNING</span>');
                }
                
                entry.innerHTML = formattedText;
                // Prepend to show latest on top
                container.insertBefore(entry, container.firstChild);
                
                // Keep only last 500 lines to prevent browser lag
                if (container.children.length > 500) {
                    container.removeChild(container.lastChild);
                }
            }

            const eventSource = new EventSource(window.location.pathname + "/stream");
            
            eventSource.onmessage = function(event) {
                addLog(event.data);
            };
            
            eventSource.onopen = function() {
                status.innerText = 'Connected';
                status.style.color = '#22c55e';
            };
            
            eventSource.onerror = function() {
                status.innerText = 'Disconnected - Retrying...';
                status.style.color = '#ef4444';
            };
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.get("/logs/stream")
async def stream_logs(request: Request):
    """
    SSE endpoint to stream logs.
    """
    log_path = get_log_path()
    
    async def log_generator():
        if not os.path.exists(log_path):
            yield "data: Log file not found yet...\\n\\n"
            # Wait for file to be created
            while not os.path.exists(log_path):
                if await request.is_disconnected():
                    return
                await asyncio.sleep(1)
        
        # 1. Send last 50 lines initially
        with open(log_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for line in lines[-50:]:
                yield f"data: {line.strip()}\\n\\n"
        
        # 2. Tail the file for new content
        file = open(log_path, 'r', encoding='utf-8')
        file.seek(0, os.SEEK_END)
        
        while True:
            if await request.is_disconnected():
                file.close()
                break
            
            line = file.readline()
            if not line:
                await asyncio.sleep(0.5)
                continue
            
            yield f"data: {line.strip()}\\n\\n"


    return StreamingResponse(log_generator(), media_type="text/event-stream")
