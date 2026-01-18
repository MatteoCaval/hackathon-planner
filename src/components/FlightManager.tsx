import React, { useState } from 'react';
import { Table, Button, Form, Card } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { Flight } from '../types';
import { FaTrash, FaExternalLinkAlt, FaPlus, FaPlaneDeparture } from 'react-icons/fa';

interface Props {
  flights: Flight[];
  onChange: (flights: Flight[]) => void;
}

const FlightManager: React.FC<Props> = ({ flights, onChange }) => {
  const [newFlight, setNewFlight] = useState<Partial<Flight>>({});

  const handleAdd = () => {
    if (newFlight.link && newFlight.pricePerPerson) {
      const flight: Flight = {
        id: uuidv4(),
        link: newFlight.link,
        startDate: newFlight.startDate || '',
        endDate: newFlight.endDate || '',
        pricePerPerson: Number(newFlight.pricePerPerson),
      };
      onChange([...flights, flight]);
      setNewFlight({});
    }
  };

  const handleRemove = (id: string) => {
    onChange(flights.filter(f => f.id !== id));
  };

  return (
    <Card className="mb-4 h-100">
      <Card.Header className="d-flex align-items-center gap-2 bg-white">
        <FaPlaneDeparture className="text-primary" />
        <span className="h6 mb-0">Flight Options</span>
      </Card.Header>
      <Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="bg-light">
            <tr>
              <th style={{ width: '40%' }}>Dates & Link</th>
              <th style={{ width: '30%' }}>Price/Person</th>
              <th style={{ width: '10%' }}></th>
            </tr>
          </thead>
          <tbody>
            {flights.map(f => (
              <tr key={f.id}>
                <td>
                    <div className="fw-bold text-dark">{f.startDate} <span className="text-muted fw-normal mx-1">to</span> {f.endDate}</div>
                    <a href={f.link} target="_blank" rel="noreferrer" className="small text-decoration-none d-flex align-items-center gap-1 mt-1">
                        View Deal <FaExternalLinkAlt size={10} />
                    </a>
                </td>
                <td className="fw-bold text-primary">€{f.pricePerPerson}</td>
                <td className="text-end">
                    <Button variant="link" className="text-danger p-0" onClick={() => handleRemove(f.id)}>
                        <FaTrash />
                    </Button>
                </td>
              </tr>
            ))}
            <tr className="bg-light border-top">
              <td>
                <div className="d-flex flex-column gap-2">
                    <Form.Control 
                    size="sm" 
                    placeholder="https://..." 
                    value={newFlight.link || ''} 
                    onChange={e => setNewFlight({...newFlight, link: e.target.value})} 
                    />
                    <div className="d-flex gap-1">
                        <Form.Control 
                        size="sm" 
                        type="date"
                        value={newFlight.startDate || ''} 
                        onChange={e => {
                            const newStart = e.target.value;
                            setNewFlight(prev => ({
                                ...prev, 
                                startDate: newStart,
                                // Reset end date if it's before the new start date
                                endDate: prev.endDate && prev.endDate < newStart ? '' : prev.endDate
                            }));
                        }} 
                        />
                        <Form.Control 
                        size="sm" 
                        type="date"
                        value={newFlight.endDate || ''} 
                        min={newFlight.startDate || ''}
                        onChange={e => setNewFlight({...newFlight, endDate: e.target.value})} 
                        />
                    </div>
                </div>
              </td>
              <td style={{ verticalAlign: 'top' }}>
                <Form.Control 
                  size="sm" 
                  type="number" 
                  placeholder="Price €" 
                  value={newFlight.pricePerPerson || ''} 
                  onChange={e => setNewFlight({...newFlight, pricePerPerson: Number(e.target.value)})} 
                />
              </td>
              <td className="text-end" style={{ verticalAlign: 'top' }}>
                  <Button size="sm" variant="primary" onClick={handleAdd} disabled={!newFlight.link || !newFlight.pricePerPerson}>
                    <FaPlus />
                  </Button>
              </td>
            </tr>
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};

export default FlightManager;
