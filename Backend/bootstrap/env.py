import os
from urllib.parse import urlparse


def env_bool(name, default='False'):
    return os.getenv(name, default).strip().lower() in ('1', 'true', 'yes', 'on')


def env_int(name, default):
    raw = os.getenv(name, '').strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def env_list(name, default=''):
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(',') if item.strip()]


def host_from_url(url: str) -> str:
    if not url:
        return ''
    parsed = urlparse(url if '://' in url else f'https://{url}')
    return (parsed.hostname or '').strip()


def origin_from_url(url: str) -> str:
    if not url:
        return ''
    parsed = urlparse(url if '://' in url else f'https://{url}')
    if not parsed.scheme or not parsed.netloc:
        return ''
    return f'{parsed.scheme}://{parsed.netloc}'


def unique_nonempty(values):
    seen = set()
    result = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def expand_site_origins(url: str) -> list[str]:
    """Build CORS/CSRF origins from a site URL, including www/non-www variants."""
    origins = []
    base = origin_from_url(url)
    if not base:
        return origins

    origins.append(base)
    parsed = urlparse(base)
    host = parsed.hostname or ''
    scheme = parsed.scheme

    if host.startswith('www.'):
        bare = host[4:]
        if bare:
            origins.append(f'{scheme}://{bare}')
    elif host and not host.replace('.', '').isdigit() and host not in ('localhost', '127.0.0.1'):
        origins.append(f'{scheme}://www.{host}')

    return unique_nonempty(origins)


def platform_origins() -> list[str]:
    origins = []
    for key in (
        'RENDER_EXTERNAL_URL',
        'RAILWAY_PUBLIC_DOMAIN',
        'RAILWAY_STATIC_URL',
        'VERCEL_URL',
        'DEPLOYMENT_URL',
        'FRONTEND_URL',
    ):
        value = os.getenv(key, '').strip()
        if value:
            origins.extend(expand_site_origins(value))

    for key in ('RENDER_EXTERNAL_HOSTNAME', 'RAILWAY_PUBLIC_DOMAIN', 'DEPLOYMENT_HOST'):
        value = os.getenv(key, '').strip()
        if not value:
            continue
        host = host_from_url(value) if '://' in value else value.split(':')[0]
        if host and host not in ('localhost', '127.0.0.1'):
            origins.extend(expand_site_origins(f'https://{host}'))

    fly_app = os.getenv('FLY_APP_NAME', '').strip()
    if fly_app:
        origins.extend(expand_site_origins(f'https://{fly_app}.fly.dev'))

    return unique_nonempty(origins)


def origins_from_hosts(hosts, *, debug=False) -> list[str]:
    origins = []
    for host in hosts:
        if not host or host == '0.0.0.0':
            continue
        if host in ('localhost', '127.0.0.1'):
            if debug:
                origins.extend(
                    [
                        f'http://{host}:5173',
                        f'http://{host}:8000',
                    ]
                )
            continue
        origins.extend(expand_site_origins(f'https://{host}'))
    return unique_nonempty(origins)


def deployment_hosts(*, site_url='', extra_hosts=None, debug=False):
    hosts = []

    site_host = host_from_url(site_url)
    if site_host:
        hosts.append(site_host)

    for key in (
        'RENDER_EXTERNAL_HOSTNAME',
        'RAILWAY_PUBLIC_DOMAIN',
        'VERCEL_URL',
        'DEPLOYMENT_HOST',
    ):
        value = os.getenv(key, '').strip()
        if not value:
            continue
        host = host_from_url(value) if '://' in value else value.split(':')[0]
        if host:
            hosts.append(host)

    fly_app = os.getenv('FLY_APP_NAME', '').strip()
    if fly_app:
        hosts.append(f'{fly_app}.fly.dev')

    if extra_hosts:
        hosts.extend(extra_hosts)

    if debug:
        hosts.extend(['localhost', '127.0.0.1', '0.0.0.0'])

    return unique_nonempty(hosts)


def deployment_origins(
    *,
    site_url='',
    frontend_url='',
    extra_origins=None,
    allowed_hosts=None,
    debug=False,
):
    origins = []

    for url in (frontend_url, site_url):
        origins.extend(expand_site_origins(url))

    origins.extend(platform_origins())

    if extra_origins:
        for item in extra_origins:
            origins.extend(expand_site_origins(item) if '://' in item or '.' in item else [item])

    if allowed_hosts:
        origins.extend(origins_from_hosts(allowed_hosts, debug=debug))

    if debug:
        origins.extend(
            [
                'http://localhost:5173',
                'http://127.0.0.1:5173',
            ]
        )

    return unique_nonempty(origins)


def origins_are_cross_site(*urls) -> bool:
    normalized = unique_nonempty([origin_from_url(url) for url in urls])
    return len(normalized) > 1
