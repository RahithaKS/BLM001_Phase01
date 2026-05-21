#!/bin/bash

# Start Python FastAPI backend on port 8000
echo "Starting LedgerLM Python Backend..."

cd "$(dirname "$0")"

# Install dependencies if not already installed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt --quiet

echo "Starting FastAPI server on port 8000..."
python3 main.py
