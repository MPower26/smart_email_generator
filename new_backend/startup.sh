#!/bin/bash
gunicorn app.main:app --config gunicorn.conf.py 