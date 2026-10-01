import os


def env_bool(name, default='False'):
    return os.getenv(name, default).strip().lower() in ('1', 'true', 'yes', 'on')


def env_int(name, default):
    raw = os.getenv(name, str(default)).strip()
    try:
        return int(raw)
    except ValueError:
        return default


def build_cookie_settings(
    *,
    debug: bool,
    use_https: bool,
    cross_origin: bool,
    auto_cookie_domain: str | None = None,
) -> dict:
    """
    Session + CSRF cookie defaults for local HTTP, production HTTPS,
    and split frontend/API deployments.
    """
    if use_https:
        secure_default = True
        samesite_default = 'None' if cross_origin and not debug else 'Lax'
    else:
        secure_default = False
        samesite_default = 'Lax'

    session_secure = env_bool('SESSION_COOKIE_SECURE', 'True' if secure_default else 'False')
    csrf_secure = env_bool('CSRF_COOKIE_SECURE', 'True' if secure_default else 'False')
    session_samesite = os.getenv('SESSION_COOKIE_SAMESITE', samesite_default).strip() or samesite_default
    csrf_samesite = os.getenv('CSRF_COOKIE_SAMESITE', samesite_default).strip() or samesite_default

    if session_samesite not in ('Lax', 'Strict', 'None'):
        session_samesite = samesite_default
    if csrf_samesite not in ('Lax', 'Strict', 'None'):
        csrf_samesite = samesite_default

    # Split frontend + API (e.g. dopekit.co.ke → *.railway.app): Lax cookies are not
    # sent on cross-site fetch(..., credentials: 'include'), which causes login loops.
    if cross_origin and use_https:
        if session_samesite == 'Lax':
            session_samesite = 'None'
        if csrf_samesite == 'Lax':
            csrf_samesite = 'None'

    if session_samesite == 'None' and not session_secure:
        session_secure = True
    if csrf_samesite == 'None' and not csrf_secure:
        csrf_secure = True

    cookie_domain = os.getenv('COOKIE_DOMAIN', '').strip() or auto_cookie_domain or None

    settings = {
        'SESSION_COOKIE_NAME': os.getenv('SESSION_COOKIE_NAME', 'dopekit_session').strip()
        or 'dopekit_session',
        'SESSION_COOKIE_AGE': env_int('SESSION_COOKIE_AGE', 60 * 60 * 24 * 14),
        'SESSION_COOKIE_PATH': os.getenv('SESSION_COOKIE_PATH', '/').strip() or '/',
        'SESSION_COOKIE_HTTPONLY': env_bool('SESSION_COOKIE_HTTPONLY', 'True'),
        'SESSION_COOKIE_SECURE': session_secure,
        'SESSION_COOKIE_SAMESITE': session_samesite,
        'SESSION_SAVE_EVERY_REQUEST': env_bool('SESSION_SAVE_EVERY_REQUEST', 'False'),
        'SESSION_EXPIRE_AT_BROWSER_CLOSE': env_bool('SESSION_EXPIRE_AT_BROWSER_CLOSE', 'False'),
        'CSRF_COOKIE_NAME': os.getenv('CSRF_COOKIE_NAME', 'csrftoken').strip() or 'csrftoken',
        'CSRF_COOKIE_PATH': os.getenv('CSRF_COOKIE_PATH', '/').strip() or '/',
        'CSRF_COOKIE_HTTPONLY': env_bool('CSRF_COOKIE_HTTPONLY', 'False'),
        'CSRF_COOKIE_SECURE': csrf_secure,
        'CSRF_COOKIE_SAMESITE': csrf_samesite,
        'CSRF_USE_SESSIONS': False,
    }

    if cookie_domain and cookie_domain not in ('localhost', '127.0.0.1'):
        settings['SESSION_COOKIE_DOMAIN'] = cookie_domain
        settings['CSRF_COOKIE_DOMAIN'] = cookie_domain

    return settings
