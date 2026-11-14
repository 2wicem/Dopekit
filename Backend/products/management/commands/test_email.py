from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Send a test email via Resend (or SMTP if Resend is not configured).'

    def handle(self, *args, **options):
        if not settings.EMAIL_CONFIGURED:
            self.stderr.write(
                self.style.ERROR(
                    'Set RESEND_API_KEY on the backend service (Railway Variables), then redeploy.'
                )
            )
            return

        recipient = settings.BOOKING_NOTIFY_EMAIL
        try:
            send_mail(
                subject='Dopekit — test booking alert',
                message=(
                    'This is a test email from your Dopekit booking app.\n\n'
                    'If you see this, Resend notifications are set up correctly.'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=False,
            )
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f'Email send failed: {exc}'))
            return

        provider = 'Resend' if settings.RESEND_API_KEY else 'SMTP'
        self.stdout.write(
            self.style.SUCCESS(f'Test email sent to {recipient} via {provider}')
        )
