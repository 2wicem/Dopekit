import json
import logging
import re

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .auth_utils import signup_role_from_account_type, user_to_dict
from .models import TechnicianApprovalStatus, UserProfile, UserRole
from .notifications import (
    notify_technician_application,
    send_password_reset_email,
    send_password_reset_otp_sms,
)
from .password_reset_otp import (
    find_user_by_phone,
    mask_email,
    mask_phone,
    store_otp,
    verify_otp,
)
from .password_utils import PASSWORD_HINT, password_strength_error
from .geo_utils import parse_coordinate, validate_latitude, validate_longitude
from .technician_showcase import parse_portfolio_urls, portfolio_urls_to_text
from .technician_verification import is_valid_ke_phone, validate_technician_application
from .rate_limit import rate_limit

logger = logging.getLogger(__name__)
User = get_user_model()
EMAIL_PATTERN = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9._]{3,30}$')


def _find_user_by_login(login):
    login = login.strip().lower()
    if not login:
        return None

    user = User.objects.filter(email__iexact=login).first()
    if user:
        return user

    return User.objects.filter(username__iexact=login).first()


def _find_user_by_email(email):
    email = email.strip().lower()
    if not email:
        return None
    return User.objects.filter(email__iexact=email).first()


def _validate_new_password(password, user=None):
    strength_error = password_strength_error(password)
    if strength_error:
        return strength_error

    try:
        validate_password(password, user=user)
    except ValidationError as exc:
        return ' '.join(exc.messages)

    return None


def _password_reset_url(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f'{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}'


def _validate_username(username: str):
    username = username.strip()
    if not username:
        return 'Username is required.'
    if len(username) < 3 or len(username) > 30:
        return 'Username must be 3–30 characters.'
    if not USERNAME_PATTERN.match(username):
        return 'Username can only use letters, numbers, dots, and underscores.'
    if User.objects.filter(username__iexact=username).exists():
        return 'That username is already taken.'
    return None


@csrf_exempt
@require_http_methods(['POST'])
@rate_limit('auth_register')
def register(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    username = data.get('username', '').strip() or data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')
    account_type = data.get('account_type', 'client')

    if not username or not email or not phone or not password or not confirm_password:
        return JsonResponse({'error': 'All fields are required.'}, status=400)

    username_error = _validate_username(username)
    if username_error:
        return JsonResponse({'error': username_error}, status=400)

    role = signup_role_from_account_type(account_type)
    if role is None:
        return JsonResponse({'error': 'Invalid account type.'}, status=400)

    if role == UserRole.WORKER and not settings.ALLOW_TECHNICIAN_SELF_SIGNUP:
        return JsonResponse(
            {
                'error': (
                    'Technician self-signup is disabled. '
                    'Ask the salon admin to create your account.'
                ),
            },
            status=403,
        )

    if not EMAIL_PATTERN.match(email):
        return JsonResponse({'error': 'Enter a valid email address.'}, status=400)

    if password != confirm_password:
        return JsonResponse({'error': 'Passwords do not match.'}, status=400)

    if User.objects.filter(email=email).exists():
        return JsonResponse({'error': 'An account with this email already exists.'}, status=400)

    password_error = _validate_new_password(
        password,
        user=User(username=username, email=email, first_name=username),
    )
    if password_error:
        return JsonResponse({'error': password_error}, status=400)

    application_data = None
    if role == UserRole.WORKER:
        application_data, application_error = validate_technician_application(data)
        if application_error:
            return JsonResponse({'error': application_error}, status=400)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=username,
    )

    if role == UserRole.WORKER:
        profile_fields = application_data or {}
        if settings.REQUIRE_TECHNICIAN_APPROVAL:
            UserProfile.objects.create(
                user=user,
                phone=phone,
                role=UserRole.CLIENT,
                technician_approval=TechnicianApprovalStatus.PENDING,
                **profile_fields,
            )
            auth_login(request, user)
            try:
                notify_technician_application(user)
            except Exception:
                pass
            return JsonResponse(
                {
                    'message': (
                        'Application received. An admin will verify your details '
                        'and approve your technician account soon.'
                    ),
                    'user': user_to_dict(user),
                },
                status=201,
            )

        profile = UserProfile.objects.create(
            user=user,
            phone=phone,
            role=UserRole.WORKER,
            technician_approval=TechnicianApprovalStatus.APPROVED,
            **profile_fields,
        )
    elif role == UserRole.SALON_OWNER:
        profile = UserProfile.objects.create(
            user=user,
            phone=phone,
            role=UserRole.SALON_OWNER,
            technician_approval=TechnicianApprovalStatus.NOT_APPLICABLE,
        )
    else:
        profile = UserProfile.objects.create(
            user=user,
            phone=phone,
            role=UserRole.CLIENT,
            technician_approval=TechnicianApprovalStatus.NOT_APPLICABLE,
        )

    auth_login(request, user)

    success_message = (
        'Welcome to the team! Your technician account is ready.'
        if profile.role == UserRole.WORKER
        else 'Salon owner account created. Add your first branch from My salons.'
        if profile.role == UserRole.SALON_OWNER
        else 'Account created successfully.'
    )

    return JsonResponse(
        {
            'message': success_message,
            'user': user_to_dict(user),
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(['POST'])
@rate_limit('auth_login')
def login_view(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return JsonResponse({'error': 'Email and password are required.'}, status=400)

    account = _find_user_by_login(email)
    if account is None:
        return JsonResponse({'error': 'Invalid email or password.'}, status=401)

    user = authenticate(request, username=account.username, password=password)
    if user is None:
        return JsonResponse({'error': 'Invalid email or password.'}, status=401)

    auth_login(request, user)

    return JsonResponse(
        {
            'message': 'Logged in successfully.',
            'user': user_to_dict(user),
        }
    )


@csrf_exempt
@require_http_methods(['POST'])
def logout_view(request):
    auth_logout(request)
    return JsonResponse({'message': 'Logged out successfully.'})


def _find_user_for_password_reset(identifier: str, channel: str):
    identifier = (identifier or '').strip()
    if not identifier:
        return None

    if channel == 'phone':
        if not is_valid_ke_phone(identifier):
            return None
        return find_user_by_phone(identifier)

    email = identifier.lower()
    if not EMAIL_PATTERN.match(email):
        return None
    return _find_user_by_email(email)


@csrf_exempt
@require_http_methods(['POST'])
@rate_limit('auth_forgot_password')
def forgot_password(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    channel = (data.get('channel') or 'email').strip().lower()
    if channel not in ('email', 'phone'):
        return JsonResponse({'error': 'Invalid reset channel.'}, status=400)

    identifier = data.get('identifier', '').strip()
    if not identifier:
        if channel == 'phone':
            identifier = data.get('phone', '').strip()
        else:
            identifier = data.get('email', '').strip().lower()

    if channel == 'email':
        if not identifier or not EMAIL_PATTERN.match(identifier):
            return JsonResponse({'error': 'Enter the email on your account.'}, status=400)
    elif not identifier or not is_valid_ke_phone(identifier):
        return JsonResponse({'error': 'Enter the phone number on your account.'}, status=400)

    user = _find_user_for_password_reset(identifier, channel)
    response = {
        'message': (
            'If an account exists for that '
            f'{"phone number" if channel == "phone" else "email"}, '
            'we sent a reset code.'
        ),
        'channel': channel,
    }

    if user:
        otp = store_otp(user.id)
        reset_url = _password_reset_url(user)

        if channel == 'phone':
            sms_sent = send_password_reset_otp_sms(user, otp)
            profile = getattr(user, 'profile', None)
            response['masked_destination'] = mask_phone(profile.phone if profile else identifier)
            if settings.DEBUG and not sms_sent:
                response['debug_otp'] = otp
            elif not sms_sent:
                logger.warning(
                    'Password reset SMS was not delivered for user %s (check AT_API_KEY).',
                    user.id,
                )
        else:
            email_sent = send_password_reset_email(user, reset_url, otp=otp)
            response['masked_destination'] = mask_email(user.email)
            if settings.DEBUG and not email_sent:
                response['debug_otp'] = otp
                response['debug_reset_link'] = reset_url

    return JsonResponse(response)


def _reset_password_with_otp(data):
    identifier = data.get('identifier', '').strip()
    channel = (data.get('channel') or '').strip().lower()
    otp = data.get('otp', '').strip()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    if not identifier:
        if channel == 'phone':
            identifier = data.get('phone', '').strip()
        else:
            identifier = data.get('email', '').strip().lower()

    if not channel:
        channel = 'phone' if identifier and is_valid_ke_phone(identifier) else 'email'

    if not identifier or not otp or not password or not confirm_password:
        return JsonResponse({'error': 'All fields are required.'}, status=400)

    if password != confirm_password:
        return JsonResponse({'error': 'Passwords do not match.'}, status=400)

    user = _find_user_for_password_reset(identifier, channel)
    if user is None:
        return JsonResponse({'error': 'Invalid or expired reset code.'}, status=400)

    otp_ok, otp_error = verify_otp(user.id, otp)
    if not otp_ok:
        return JsonResponse({'error': otp_error}, status=400)

    password_error = _validate_new_password(password, user=user)
    if password_error:
        return JsonResponse({'error': password_error}, status=400)

    user.set_password(password)
    user.save(update_fields=['password'])

    return JsonResponse({'message': 'Password updated. You can log in now.'})


@csrf_exempt
@require_http_methods(['POST'])
@rate_limit('auth_reset_password')
def reset_password(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    if data.get('otp'):
        return _reset_password_with_otp(data)

    uid = data.get('uid', '').strip()
    token = data.get('token', '').strip()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    if not uid or not token or not password or not confirm_password:
        return JsonResponse({'error': 'All fields are required.'}, status=400)

    if password != confirm_password:
        return JsonResponse({'error': 'Passwords do not match.'}, status=400)

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return JsonResponse({'error': 'This reset link is invalid or expired.'}, status=400)

    if not default_token_generator.check_token(user, token):
        return JsonResponse({'error': 'This reset link is invalid or expired.'}, status=400)

    password_error = _validate_new_password(password, user=user)
    if password_error:
        return JsonResponse({'error': password_error}, status=400)

    user.set_password(password)
    user.save(update_fields=['password'])

    return JsonResponse({'message': 'Password updated. You can log in now.'})


@require_http_methods(['GET'])
@ensure_csrf_cookie
def csrf_bootstrap(request):
    return JsonResponse({'ok': True})


@require_http_methods(['GET'])
def signup_config(request):
    return JsonResponse(
        {
            'allow_technician_signup': settings.ALLOW_TECHNICIAN_SELF_SIGNUP,
            'require_technician_approval': settings.REQUIRE_TECHNICIAN_APPROVAL,
            'require_technician_invite_code': bool(settings.TECHNICIAN_SIGNUP_CODE),
            'password_hint': PASSWORD_HINT,
        }
    )


@require_http_methods(['GET'])
@ensure_csrf_cookie
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({'user': None})

    return JsonResponse({'user': user_to_dict(request.user)})


@csrf_exempt
@require_http_methods(['PATCH'])
@rate_limit('auth_register')
def update_profile(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required.'}, status=401)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    phone = data.get('phone', '').strip()
    default_location = data.get('default_location', '').strip()

    if not phone:
        return JsonResponse({'error': 'Phone is required.'}, status=400)

    if not is_valid_ke_phone(phone):
        return JsonResponse({'error': 'Enter a valid Kenyan phone number.'}, status=400)

    if len(default_location) > 200:
        return JsonResponse({'error': 'Address is too long (max 200 characters).'}, status=400)

    profile, _ = UserProfile.objects.get_or_create(
        user=request.user,
        defaults={'phone': phone},
    )

    update_fields = ['phone', 'default_location']
    profile.phone = phone
    profile.default_location = default_location

    if profile.role in (UserRole.WORKER, UserRole.ADMIN):
        if 'technician_work_summary' in data:
            work_summary = data.get('technician_work_summary', '').strip()
            if len(work_summary) > 500:
                return JsonResponse({'error': 'Work summary is too long (max 500 characters).'}, status=400)
            profile.technician_work_summary = work_summary
            update_fields.append('technician_work_summary')

        if 'technician_portfolio_urls' in data:
            raw_portfolio = data.get('technician_portfolio_urls', '')
            if isinstance(raw_portfolio, list):
                portfolio_text = portfolio_urls_to_text(raw_portfolio)
            else:
                portfolio_text = portfolio_urls_to_text(str(raw_portfolio or ''))
            if len(portfolio_text) > 2000:
                return JsonResponse({'error': 'Portfolio list is too long (max 2000 characters).'}, status=400)
            profile.technician_portfolio_urls = portfolio_text
            update_fields.append('technician_portfolio_urls')

        if 'service_latitude' in data or 'service_longitude' in data:
            latitude = validate_latitude(parse_coordinate(data.get('service_latitude')))
            longitude = validate_longitude(parse_coordinate(data.get('service_longitude')))
            if data.get('service_latitude') not in (None, '') and latitude is None:
                return JsonResponse({'error': 'Enter a valid service latitude.'}, status=400)
            if data.get('service_longitude') not in (None, '') and longitude is None:
                return JsonResponse({'error': 'Enter a valid service longitude.'}, status=400)
            profile.service_latitude = latitude
            profile.service_longitude = longitude
            update_fields.extend(['service_latitude', 'service_longitude'])

    profile.save(update_fields=update_fields)

    return JsonResponse(
        {
            'user': user_to_dict(request.user),
            'message': 'Profile updated.',
        }
    )
