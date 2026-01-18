import { useState, useEffect } from 'react';
import { Container, Navbar } from 'react-bootstrap';
import Sidebar from './components/Sidebar';
import DestinationView from './components/DestinationView';
import { useLocalStorage } from './useLocalStorage';
import { Destination } from './types';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'leaflet/dist/leaflet.css';

function App() {
  const [destinations, setDestinations] = useLocalStorage<Destination[]>('hackathon-destinations', []);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Auto-select first if none selected and list not empty
  useEffect(() => {
    if (!activeId && destinations.length > 0) {
      setActiveId(destinations[0].id);
    }
  }, [destinations, activeId]);

  const activeDestination = destinations.find(d => d.id === activeId);

  const handleUpdateDestination = (updatedDest: Destination) => {
    setDestinations(destinations.map(d => d.id === updatedDest.id ? updatedDest : d));
  };

  const handleAddDestination = (newDest: Destination) => {
    setDestinations([...destinations, newDest]);
    setActiveId(newDest.id);
  };

  const handleRemoveDestination = (id: string) => {
      const newDestinations = destinations.filter(d => d.id !== id);
      setDestinations(newDestinations);
      if (activeId === id) {
          setActiveId(newDestinations.length > 0 ? newDestinations[0].id : null);
      }
  };

  return (
    <div className="d-flex flex-column vh-100">
      <Navbar bg="dark" variant="dark" className="flex-shrink-0">
        <Container fluid>
          <Navbar.Brand>✈️ Hackathon Planner</Navbar.Brand>
        </Container>
      </Navbar>
      
      <div className="d-flex flex-grow-1 overflow-hidden">
        <Sidebar 
          destinations={destinations} 
          activeId={activeId} 
          onSelect={setActiveId} 
          onAdd={handleAddDestination}
          onRemove={handleRemoveDestination}
        />
        
        <main className="flex-grow-1 p-4 overflow-auto bg-white">
          {activeDestination ? (
            <DestinationView 
              destination={activeDestination} 
              onUpdate={handleUpdateDestination} 
            />
          ) : (
            <div className="text-center mt-5 text-muted">
              <h3>Select or add a destination to start planning!</h3>
              <p>Use the sidebar to manage your trip options.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;