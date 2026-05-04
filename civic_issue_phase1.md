# Phase 1 Implementation Plan – Civic Issue Reporting System

## 1. Objective

Build a working system that allows users to:

* Upload civic issue images
* Automatically classify issues using description
* Capture location from browser
* Detect duplicate issues using geospatial queries
* Visualize issues on a map
* Share complaints via social platforms and official channels

---

## 2. End-to-End Flow

### Step 1: User Reports Issue

User opens the “Report Issue” page and:

* Uploads an image
* Enters a short description
* Allows browser location access

---

### Step 2: Location Capture (Frontend)

* Use Browser geolocation to capture:
  * Latitude
  * Longitude
* Send coordinates to backend along with request

---

### Step 3: Backend Processing

#### 3.1 Image Storage

* Store uploaded image:
  * Local storage (Phase 1)
* Save file path in database

---

#### 3.2 Issue Classification

* Use **Groq** API
* Input: user description
* Output:
  * pothole
  * garbage
  * streetlight

---

#### 3.3 Reverse Geocoding 

* Convert lat/lng → human-readable address
* Store address in DB

---

#### 3.4 Deduplication Logic (Core Feature)

Use PostGIS with **PostgreSQL**

Logic:

* Check if any issue exists within 10 meters radius
* Use:
  * ST_DWithin (geospatial query)

Outcome:

* If found → attach report to existing issue
* Else → create new issue

---

#### 3.5 Data Storage

Store in two tables:

**Issues Table (canonical issue):**

* id
* type (classified)
* status (active)
* location (POINT)
* address

**Reports Table:**

* id
* issue_id
* image_url
* description

---

## 3. API Flow (Fastapi)

### 3.1 Report Issue API

**Endpoint:**
POST /api/issues/report

**Request:**

* image (file)
* description (text)
* latitude (float)
* longitude (float)

**Response:**

```json
{
  "issue_id": 123,
  "status": "created" | "attached"
}
```

---

### 3.2 Get All Issues (Map API)

**Endpoint:**
GET /api/issues

**Response:**(Map API)

```json
[
  {
    "id": 1,
    "type": "pothole",
    "status": "active",
    "lat": 12.97,
    "lng": 77.59
  }
]
```

---

### 3.3 Get User Tickets

**Endpoint:**
GET /api/users/{id}/issues

---

### 3.4 Social Share API

**Endpoint:**
POST /api/social/share

---

## 4. Frontend Implementation (React)

### 4.1 Report Issue Page

* Image upload field
* Text input
* Submit button

---

### 4.2 User Tickets (Dashboard)

* Issue type
* Status
* Date/time
* Location/address

---

### 4.3 Map View (Leaflet Integration)

* Show all issues as markers
* Cluster dense areas
* Highlight hotspots

---

## 5. Deduplication Visualization

* Do NOT create new marker for duplicates
* Increase report count
* Show aggregated complaints

---

## 6. Social Sharing Integration

* Twitter (X) sharing
* Redirect to GHMC portals

---

## 7. Deployment Architecture

### Frontend
* Vercel

### Backend
* FastAPI (Render)

### Database
* PostgreSQL (Supabase )

---

## 8. System Behavior Summary

| Action    | System Response     |
|-----------|-------------------|
| New issue | Create new record |
| Duplicate | Attach existing  |
| Map view  | Cluster markers  |


