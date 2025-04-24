#!/bin/bash

# Make the required directories
mkdir -p /home/site/wwwroot
mkdir -p /home/site/deployments

# Copy all files to the wwwroot directory
cp -r . /home/site/wwwroot/

# Install Python packages
cd /home/site/wwwroot
python -m pip install --upgrade pip
pip install -r requirements.txt

# Make the startup script executable
chmod +x startup.sh

# Start the application
./startup.sh 