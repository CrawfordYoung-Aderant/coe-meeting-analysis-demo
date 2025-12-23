#!/bin/bash
# Script to run the Flask backend server

export FLASK_APP=app.py
export FLASK_ENV=development

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt || pip install -r ../requirements.txt

# Run the server
python app.py

