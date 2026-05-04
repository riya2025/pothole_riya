# Frontend Developer Design Document

## 1. Overview
Frontend built using React + Leaflet for civic issue visualization and reporting.

---

## 2. Tech Stack
- React.js
- Leaflet.js
- Leaflet MarkerCluster
- Axios (API calls)

---

## 3. Folder Structure
/src
  /components
    MapView.js
    IssueMarker.js
    ReportForm.js
    Navbar.js
  /pages
    Home.js
    ReportIssue.js
    Dashboard.js
  /services
    api.js
  /utils
    helpers.js

---

## 4. Core Features

### Map View
- Display issues using markers
- Cluster markers for performance
- Zoom-based expansion

### Report Issue
- Upload image
- Select issue type
- Capture geolocation

### Dashboard
- List user-reported issues
- Show status updates

---

## 5. API Integration



### POST /api/issues/report
- Handles upload, geocoding, deduplication

### GET /api/issues
- Returns all issues

### GET /api/users/{id}/issues
- Returns user-specific issues


---

## 6. State Management
- useState / useEffect
- Optional: Redux for scaling

---

## 7. Social Sharing
- Generate dynamic tweet
- Redirect to intent URL

---

## 8. UI Enhancements
- Hotspot highlighting
- Notifications

