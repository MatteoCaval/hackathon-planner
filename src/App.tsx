import { useState, useEffect } from 'react';
import { Container, Navbar, Button, Form, InputGroup } from 'react-bootstrap';
import Sidebar from './components/Sidebar';
import DestinationView from './components/DestinationView';
import AddDestinationModal from './components/AddDestinationModal';
import DataPersistence from './components/DataPersistence';
import { useLocalStorage } from './useLocalStorage';
import { Destination, PlannerSettings } from './types';
import { FaPlane, FaPlus, FaUsers, FaWallet } from 'react-icons/fa';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'leaflet/dist/leaflet.css';

function App() {
  const [destinations, setDestinations] = useLocalStorage<Destination[]>('hackathon-destinations', []);
  const [settings, setSettings] = useLocalStorage<PlannerSettings>('hackathon-settings', { totalBudget: 5000, peopleCount: 5 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

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
    // Ensure no legacy budget is attached if type is strict, though local var is fine
    const { ...dest } = newDest; 
    setDestinations([...destinations, dest]);
    setActiveId(newDest.id);
  };

  const handleRemoveDestination = (id: string) => {
      const newDestinations = destinations.filter(d => d.id !== id);
      setDestinations(newDestinations);
      if (activeId === id) {
          setActiveId(newDestinations.length > 0 ? newDestinations[0].id : null);
      }
  };

  const handleImport = (data: Destination[]) => {
    setDestinations(data);
    if (data.length > 0) {
        setActiveId(data[0].id);
    }
  };

  return (
    <div className="d-flex flex-column vh-100">
      <Navbar className="flex-shrink-0 z-3 border-bottom bg-white py-2">
        <Container fluid className="px-4">
          <Navbar.Brand className="text-primary d-flex align-items-center gap-2 fw-bold me-4">
             <div className="bg-primary text-white rounded p-1 d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                <FaPlane size={18} />
             </div>
             <span className="d-none d-md-inline">Hackathon Planner</span>
          </Navbar.Brand>

          <div className="d-flex align-items-center gap-3 me-auto border-start ps-3">
            <InputGroup size="sm" style={{ width: '160px' }}>
                <InputGroup.Text className="bg-light text-muted border-end-0"><FaWallet /></InputGroup.Text>
                <Form.Control 
                    type="number" 
                    className="border-start-0"
                    placeholder="Budget"
                    value={settings.totalBudget}
                    onChange={(e) => setSettings({...settings, totalBudget: Number(e.target.value)})}
                />
            </InputGroup>
            
            <InputGroup size="sm" style={{ width: '120px' }}>
                <InputGroup.Text className="bg-light text-muted border-end-0"><FaUsers /></InputGroup.Text>
                <Form.Control 
                    type="number" 
                    className="border-start-0"
                    placeholder="Ppl"
                    value={settings.peopleCount}
                    onChange={(e) => setSettings({...settings, peopleCount: Number(e.target.value)})}
                />
            </InputGroup>
          </div>
          
          <DataPersistence destinations={destinations} onImport={handleImport} />
        </Container>
      </Navbar>
      
      <div className="d-flex flex-grow-1 overflow-hidden">
        <Sidebar 
          destinations={destinations} 
          activeId={activeId} 
          onSelect={setActiveId} 
          onAddClick={() => setShowAddModal(true)}
          onRemove={handleRemoveDestination}
        />
        
        <main className="flex-grow-1 overflow-auto bg-slate-50 position-relative" style={{ backgroundColor: '#f8fafc' }}>
          {activeDestination ? (
            <DestinationView 
              destination={activeDestination} 
              onUpdate={handleUpdateDestination}
              settings={settings}
            />
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
              <div className="bg-white p-5 rounded-circle shadow-sm mb-4 d-flex align-items-center justify-content-center" style={{ width: '120px', height: '120px' }}>
                 <FaPlane size={48} className="text-primary opacity-50" />
              </div>
              <h3 className="fw-light">Ready for takeoff?</h3>
              <p className="mb-4">Select or add a destination from the sidebar to start planning.</p>
              <Button variant="primary" size="lg" onClick={() => setShowAddModal(true)}>
                <FaPlus className="me-2" /> Start Planning
              </Button>
            </div>
          )}
        </main>
      </div>

      <AddDestinationModal 
        show={showAddModal} 
        onHide={() => setShowAddModal(false)} 
        onAdd={handleAddDestination} 
      />
    </div>
  );
}

export default App;
