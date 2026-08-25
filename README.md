# Nails-service

Streamlining nail care and beauty services through *dope kit** — indoor/outdoor beauty services in Kenya.

## Stack

- **Frontend:** React + Vite + Bootstrap 5
- **Backend:** Django 5 + PostgreSQL

## Project structure

```
Nails-service/
├── Frontend/     # React app (customer-facing site)
└── Backend/      # Django API + admin
```

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (3.12+)

### Backend

```bash
cd Backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API runs at `http://localhost:8000`.

- Health check: `http://localhost:8000/products/`
- Create booking: `POST http://localhost:8000/products/bookings/`

Example booking payload:

```json
{
  "name": "Jane Doe",
  "phone": "0712345678",
  "location": "Wangige Mall",
  "service": "Gel"
}
```

To view bookings in admin, create a superuser first:

```bash
python manage.py createsuperuser
```

Then open `http://localhost:8000/admin/`.

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

The site runs at `http://localhost:5173`.

Make sure the Django backend is running when testing the booking form.

## Features

- Service listing with pricing (KSH)
- Booking modal (name, phone, location, service)
- About and Contact pages
- Django admin to manage bookings

## Next steps (ideas)

- Add service images to `Frontend/src/components/images/`
- Email/SMS notifications on new bookings
- User authentication for staff dashboard
- Deploy frontend and backend to production
