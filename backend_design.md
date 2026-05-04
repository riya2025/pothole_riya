# Backend Developer Design Document

## 1. Overview
Backend built using FastAPI with PostgreSQL + PostGIS.

---

## 2. Architecture
- Controller Layer
- Service Layer
- Repository Layer

---

## 3. Tech Stack
- FastAPI
- PostgreSQL
- PostGIS
- SQLAlchemy

---

## 4. Folder Structure
/app
  /routes
  /services
  /repositories
  /models
  /schemas

---

## 5. Database Schema

### issues
- id
- type
- status
- location (PostGIS)
- address

### reports
- id
- issue_id
- user_id
- image_url

---

## 6. API Design

### POST /api/issues/report
- Handles upload, geocoding, deduplication

### GET /api/issues
- Returns all issues

### GET /api/users/{id}/issues
- Returns user-specific issues

---

## 7. Geospatial Query
- ST_DWithin for duplicate detection

---

## 8. Authentication
- JWT-based auth

---

## 9. Social Media Module
- Generate shareable content
- Optional API integration

---

## 10. Future Improvements

- AI classification service

