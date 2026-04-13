#!/bin/bash
cd /home/runner/workspace/backend
uvicorn server:app --host localhost --port 8000 --reload
