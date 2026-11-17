def client_ip(request) -> str:
    """Use the last X-Forwarded-For hop so clients cannot spoof the rate-limit key."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        parts = [part.strip() for part in forwarded.split(',') if part.strip()]
        if parts:
            return parts[-1]
    return (request.META.get('REMOTE_ADDR') or 'unknown').strip() or 'unknown'
