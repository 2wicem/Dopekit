"""Django email backend that sends via Resend HTTPS API (Railway-safe)."""

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)

RESEND_API_URL = 'https://api.resend.com/emails'


class EmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        api_key = (getattr(settings, 'RESEND_API_KEY', '') or '').strip()
        if not api_key:
            raise RuntimeError('RESEND_API_KEY is not set.')

        sent = 0
        timeout = getattr(settings, 'EMAIL_TIMEOUT', 10)

        for message in email_messages:
            payload = {
                'from': message.from_email or settings.DEFAULT_FROM_EMAIL,
                'to': list(message.to),
                'subject': message.subject,
                'text': message.body or ' ',
            }
            if message.cc:
                payload['cc'] = list(message.cc)
            if message.bcc:
                payload['bcc'] = list(message.bcc)
            if message.reply_to:
                payload['reply_to'] = list(message.reply_to)

            request = urllib.request.Request(
                RESEND_API_URL,
                data=json.dumps(payload).encode('utf-8'),
                method='POST',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=timeout) as response:
                    if response.status >= 400:
                        body = response.read().decode('utf-8', errors='replace')
                        raise RuntimeError(f'Resend HTTP {response.status}: {body}')
            except urllib.error.HTTPError as exc:
                body = exc.read().decode('utf-8', errors='replace')
                raise RuntimeError(f'Resend HTTP {exc.code}: {body}') from exc

            sent += 1

        return sent
