# DopeKit — Project Brief
**Full-stack nail salon booking platform · Kenya**

---

## Overview

DopeKit is a web platform that helps nail salons and mobile technicians take bookings online instead of coordinating everything through WhatsApp or Instagram. Clients browse services, pick a technician and time slot, and manage appointments. Staff use a mobile-friendly dashboard to manage schedules and accept bookings.

---

## Problem

- Double bookings and lost messages on social media  
- No shared calendar between client and salon  
- Hard to discover nearby salons and freelance technicians  
- Owners lack tools to manage multiple branches and staff  

---

## Solution

| User | Features |
|------|----------|
| **Clients** | Services & pricing, map discovery, slot booking, cancel/reschedule |
| **Technicians** | Installable PWA, schedule management, booking alerts |
| **Salon owners** | Branch management, invite codes, application review |
| **Admins** | Platform stats, user roles, technician approval, CSV reports |

---

## Architecture

**Frontend:** React 18 + Vite 5 + Bootstrap 5 + Leaflet  
**Backend:** Django 5 REST-style JSON API  
**Database:** PostgreSQL (production)  
**Auth:** Session cookies + CSRF  
**Notifications:** Email (SMTP) + SMS (Africa's Talking)  
**Deploy:** Render / Railway / VPS (Gunicorn + nginx)

---

## Technical highlights

- Multi-role permission system (client, worker, salon owner, admin)  
- Concurrent booking protection with database row locks  
- Split frontend/API deployment with secure cross-origin cookies  
- Technician verification: phone OTP, salon invite codes, owner + admin approval  
- Geocoding for salon branches and mobile service areas  

---

## Links

- **GitHub:** https://github.com/2wicem/Nails-service  
- **Live site:** *(add your deployed URL if available, e.g. https://dopekit.co.ke)*  

---

## Built by

Michael Munga · Full-stack developer  
Contact: dopekit@gmail.com
