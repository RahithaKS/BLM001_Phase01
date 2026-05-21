#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Start Python backend in the background
cd python_backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
PYTHON_PID=$!
echo "Started Python backend (PID: $PYTHON_PID)"

# Return to root directory
cd "$SCRIPT_DIR"

# Start Node.js server in the foreground
NODE_ENV=development tsx server/index.ts

# If Node.js server exits, kill Python backend
kill $PYTHON_PID 2>/dev/null
