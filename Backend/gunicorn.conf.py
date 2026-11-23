import os

bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
# Small Railway instances OOM if every CPU spawns many processes. Prefer a few
# threaded workers so peak mobile traffic shares connections instead of crashing.
workers = int(os.getenv('WEB_CONCURRENCY', '2'))
threads = int(os.getenv('GUNICORN_THREADS', '8'))
worker_class = os.getenv('GUNICORN_WORKER_CLASS', 'gthread')
timeout = int(os.getenv('GUNICORN_TIMEOUT', '60'))
keepalive = int(os.getenv('GUNICORN_KEEPALIVE', '30'))
max_requests = int(os.getenv('GUNICORN_MAX_REQUESTS', '1000'))
max_requests_jitter = int(os.getenv('GUNICORN_MAX_REQUESTS_JITTER', '100'))
accesslog = '-'
errorlog = '-'
capture_output = True
