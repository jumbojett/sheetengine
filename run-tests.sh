#!/bin/bash

# SheetEngine Test Suite Quick Start Guide
# 
# This script provides quick access to common test commands

set -e

echo "SheetEngine Test Suite"
echo "====================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "Available Commands:"
echo ""
echo "  npm test              - Run all tests once"
echo "  npm run test:watch    - Run tests in watch mode (re-run on changes)"
echo "  npm run test:ui       - Open interactive test UI in browser"
echo ""
echo "Test Filters (use with npm test):"
echo "  npx vitest -t 'rotation'     - Run only rotation tests"
echo "  npx vitest -t 'movement'     - Run only movement tests"
echo "  npx vitest -t 'geometry'     - Run only geometry tests"
echo ""
echo "Running: npm test"
echo ""

npm test
