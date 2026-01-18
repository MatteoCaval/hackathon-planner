# Hackathon Planner ✈️

A React-based web application to help plan company hackathon trips. It allows you to manage destinations, track flight and accommodation options, and calculate costs against a fixed budget.

## Features
- **Destination Management:** Add potential destinations with auto-geocoding (enter a city name, get coordinates).
- **Interactive Map:** Visualizes the route from the Dublin office to the destination.
- **Budget Calculator:** Real-time cost estimation based on selected flights, accommodation, and team size.
- **Data Persistence:** All data is saved automatically to your browser's Local Storage.
- **Dockerized:** Runs entirely in a container, no local Node.js setup required.

## Quick Start

### Prerequisites
- Docker & Docker Compose

### Running the App
1. Clone the repository.
2. Run the application:
   ```bash
   docker-compose up --build
   ```
3. Open your browser to [http://localhost:8080](http://localhost:8080).

## Development
- **Frontend:** React + TypeScript + Vite
- **UI:** Bootstrap 5
- **Maps:** Leaflet

## Project Structure
- `src/components`: UI Components (Map, Calculator, Managers).
- `src/types.ts`: Data interfaces.
- `src/useLocalStorage.ts`: Custom hook for persistence.
- `.gemini/context.md`: Architectural context and design decisions.

## License
Private / Internal Use
