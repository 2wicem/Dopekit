"""
Django settings for bootstrap project.
"""

from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .cookie_config import build_cookie_settings
from .db_config import build_databases
from .env import (
    deployment_hosts,
    deployment_origins,
    env_bool,
    env_list,
    host_from_url,
    origin_from_url,
    origins_are_cross_site,
    unique_nonempty,
)

BASE_DIR = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / '.env')
except ImportError:
    pass

import os  # noqa: E402

try:
    import whitenoise  # noqa: F401

    HAS_WHITENOISE = True
except ImportError:
    HAS_WHITENOISE = False

# --- Core ---

DEBUG = env_bool('DEBUG', 'True')

SECRET_KEY = os.getenv('SECRET_KEY', '').strip()
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'django-insecure-dev-only-change-before-production'
    else:
        raise ImproperlyConfigured('Set the SECRET_KEY environment variable in production.')

SITE_URL = os.getenv('SITE_URL', '').strip().rstrip('/')
FRONTEND_URL = os.getenv(
    'FRONTEND_URL',
    SITE_URL or 'http://localhost:5173',
).strip().rstrip('/')

_extra_hosts = env_list('ALLOWED_HOSTS')
ALLOWED_HOSTS = deployment_hosts(
    site_url=SITE_URL or FRONTEND_URL,
    extra_hosts=_extra_hosts,
    debug=DEBUG,
)
if not DEBUG and not ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        'Set SITE_URL or ALLOWED_HOSTS to your live domain in production.'
    )

# --- Application ---

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'products',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
]
if HAS_WHITENOISE:
    MIDDLEWARE.append('whitenoise.middleware.WhiteNoiseMiddleware')
MIDDLEWARE.extend(
    [
        'corsheaders.middleware.CorsMiddleware',
        'django.contrib.sessions.middleware.SessionMiddleware',
        'django.middleware.common.CommonMiddleware',
        'django.middleware.csrf.CsrfViewMiddleware',
        'django.contrib.auth.middleware.AuthenticationMiddleware',
        'django.contrib.messages.middleware.MessageMiddleware',
        'django.middleware.clickjacking.XFrameOptionsMiddleware',
    ]
)

ROOT_URLCONF = 'bootstrap.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'bootstrap.wsgi.application'

# --- Database ---

DATABASES = build_databases(base_dir=BASE_DIR, debug=DEBUG)

# --- Auth ---

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# --- i18n ---

LANGUAGE_CODE = 'en-us'
TIME_ZONE = os.getenv('TIME_ZONE', 'Africa/Nairobi')
USE_I18N = True
USE_TZ = True

# --- Static files ---

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
_static_backend = 'django.contrib.staticfiles.storage.StaticFilesStorage'
if HAS_WHITENOISE and not DEBUG:
    _static_backend = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': _static_backend,
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- CORS / CSRF ---

_explicit_origins = env_list('CORS_ALLOWED_ORIGINS')
_explicit_csrf = env_list('CSRF_TRUSTED_ORIGINS')

CORS_ALLOWED_ORIGINS = deployment_origins(
    site_url=SITE_URL,
    frontend_url=FRONTEND_URL,
    extra_origins=_explicit_origins,
    allowed_hosts=_extra_hosts,
    debug=DEBUG,
)
CSRF_TRUSTED_ORIGINS = unique_nonempty(
    deployment_origins(
        site_url=SITE_URL,
        frontend_url=FRONTEND_URL,
        extra_origins=_explicit_csrf or _explicit_origins,
        allowed_hosts=_extra_hosts,
        debug=DEBUG,
    )
    + CORS_ALLOWED_ORIGINS
)

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
CORS_EXPOSE_HEADERS = ['content-type']

if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r'^http://192\.168\.\d+\.\d+(:\d+)?$',
        r'^http://10\.\d+\.\d+\.\d+(:\d+)?$',
    ]
else:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r'^https://[\w-]+\.onrender\.com$',
        r'^https://[\w-]+\.railway\.app$',
        r'^https://[\w-]+\.vercel\.app$',
        r'^https://[\w-]+\.fly\.dev$',
    ]

_cross_origin_frontend = origins_are_cross_site(SITE_URL, FRONTEND_URL)

# --- HTTPS / cookies ---

_default_https = 'False' if DEBUG else 'True'
if origin_from_url(SITE_URL or FRONTEND_URL).startswith('https://'):
    _default_https = 'True'

USE_HTTPS = env_bool('USE_HTTPS', _default_https)

_auto_cookie_domain = None
if _cross_origin_frontend and SITE_URL and FRONTEND_URL:
    site_host = host_from_url(SITE_URL)
    frontend_host = host_from_url(FRONTEND_URL)
    if site_host and frontend_host and site_host != frontend_host:
        site_parts = site_host.split('.')
        frontend_parts = frontend_host.split('.')
        if len(site_parts) >= 2 and len(frontend_parts) >= 2:
            site_suffix = '.'.join(site_parts[-2:])
            frontend_suffix = '.'.join(frontend_parts[-2:])
            if site_suffix == frontend_suffix:
                _auto_cookie_domain = f'.{site_suffix}'

globals().update(
    build_cookie_settings(
        debug=DEBUG,
        use_https=USE_HTTPS,
        cross_origin=_cross_origin_frontend,
        auto_cookie_domain=_auto_cookie_domain,
    )
)

if USE_HTTPS:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = env_bool('SECURE_SSL_REDIRECT', 'False')
    SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
    SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
    SECURE_HSTS_PRELOAD = not DEBUG
else:
    SECURE_SSL_REDIRECT = False

if SESSION_COOKIE_SAMESITE == 'None' and not SESSION_COOKIE_SECURE:
    raise ImproperlyConfigured(
        'SESSION_COOKIE_SECURE must be True when SESSION_COOKIE_SAMESITE is None.'
    )

if CSRF_COOKIE_SAMESITE == 'None' and not CSRF_COOKIE_SECURE:
    raise ImproperlyConfigured(
        'CSRF_COOKIE_SECURE must be True when CSRF_COOKIE_SAMESITE is None.'
    )

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'

# --- App config ---

SALON_LOCATION = os.getenv('SALON_LOCATION', 'Dopekit Studio, Kikuyu Town')

ALLOW_TECHNICIAN_SELF_SIGNUP = env_bool(
    'ALLOW_TECHNICIAN_SELF_SIGNUP',
    'True' if DEBUG else 'False',
)

REQUIRE_TECHNICIAN_APPROVAL = env_bool(
    'REQUIRE_TECHNICIAN_APPROVAL',
    'True',
)

TECHNICIAN_SIGNUP_CODE = os.getenv('TECHNICIAN_SIGNUP_CODE', '').strip()

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'dopekit-rate-limit',
    }
}

_redis_url = os.getenv('REDIS_URL', '').strip()
if _redis_url:
    CACHES['default'] = {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': _redis_url,
    }

# (max requests, window seconds)
RATE_LIMITS = {
    'auth_register': (5, 3600),
    'auth_login': (10, 900),
    'auth_forgot_password': (5, 3600),
    'auth_reset_password': (5, 3600),
    'booking_create': (20, 3600),
    'contact_create': (10, 3600),
}

BOOKING_NOTIFY_EMAIL = os.getenv('BOOKING_NOTIFY_EMAIL', 'mungaimichael638@gmail.com')
BOOKING_NOTIFY_PHONE = os.getenv('BOOKING_NOTIFY_PHONE', '+254790331108')

PASSWORD_RESET_OTP_LENGTH = int(os.getenv('PASSWORD_RESET_OTP_LENGTH', '6'))
PASSWORD_RESET_OTP_TTL = int(os.getenv('PASSWORD_RESET_OTP_TTL', '600'))
PASSWORD_RESET_OTP_MAX_ATTEMPTS = int(os.getenv('PASSWORD_RESET_OTP_MAX_ATTEMPTS', '5'))

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = env_bool('EMAIL_USE_TLS', 'True')
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '').strip()
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '').replace(' ', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER or 'noreply@dopekit.local').strip()

AT_USERNAME = os.getenv('AT_USERNAME', 'sandbox')
AT_API_KEY = os.getenv('AT_API_KEY', '')
AT_SENDER_ID = os.getenv('AT_SENDER_ID', '')
