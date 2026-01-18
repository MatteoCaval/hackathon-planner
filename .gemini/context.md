# Gemini CLI Project Context

## Project: Hackathon Planner
**Created:** January 18, 2026
**Type:** Client-side React Web Application (Dockerized)

## Core Objective
A web interface to plan a company hackathon (remote week away).
Users need to balance a fixed budget against flight and accommodation costs for the team.

## Architecture & Tech Stack
- **Frontend:** React + TypeScript + Vite
- **Styling:** Bootstrap 5 (React-Bootstrap)
- **Maps:** React-Leaflet (OpenStreetMap)
- **Data Persistence:** `localStorage` (No backend required)
- **Deployment:** Docker (Node.js build stage -> Nginx serving static files)
- **Geocoding:** Nominatim API (OpenStreetMap) for auto-filling coordinates.

## Key Components
1.  **Sidebar:** Manages the list of destinations. Includes "Add Destination" modal with Nominatim geocoding.
2.  **DestinationView:** The main container for a selected destination.
3.  **MapComponent:** Visualizes the route (Polyline) from Dublin (Headquarters) to the destination.
4.  **BudgetCalculator:** Real-time math. Selects 1 Flight + 1 Accommodation + N People to calculate total vs Budget.
5.  **Managers:** `FlightManager` and `AccommodationManager` allow CRUD operations on options.

## Design Decisions
- **Client-Side Only:** To keep the app portable and simple (requested "no server required"), we use `localStorage` via a custom `useLocalStorage` hook. Data persists in the browser.
- **Docker:** Multi-stage build ensures the user only needs Docker to run the app. It serves the production build via Nginx on port 8080.
- **Dublin Centric:** The origin is hardcoded to Dublin coordinates in `types.ts` as per requirements.

## Current State
- App is fully functional.
- Geocoding is implemented and verified.
- TypeScript strict mode is satisfied.
- Git repository initialized.

## Future Context
- If adding a backend, migrate `useLocalStorage` to an API client.
- If adding authentication, `DestinationView` logic will need to be scoped to users.
