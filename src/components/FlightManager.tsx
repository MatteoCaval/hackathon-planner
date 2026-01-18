import React, { useState } from 'react';
import { Table, Button, Form, Card } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { Flight } from '../types';

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
    <Card className="mb-4">
      <Card.Header>Flights</Card.Header>
      <Card.Body>
        <Table striped bordered hover size="sm">
          <thead>
            <tr>
              <th>Link</th>
              <th>Dates</th>
              <th>Price/Person (€)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {flights.map(f => (
              <tr key={f.id}>
                <td><a href={f.link} target="_blank" rel="noreferrer">Link</a></td>
                <td>{f.startDate} to {f.endDate}</td>
                <td>€{f.pricePerPerson}</td>
                <td><Button variant="danger" size="sm" onClick={() => handleRemove(f.id)}>Remove</Button></td>
              </tr>
            ))}
            <tr>
              <td>
                <Form.Control 
                  size="sm" 
                  placeholder="Link" 
                  value={newFlight.link || ''} 
                  onChange={e => setNewFlight({...newFlight, link: e.target.value})} 
                />
              </td>
              <td>
                <div className="d-flex gap-1">
                    <Form.Control 
                    size="sm" 
                    type="date"
                    value={newFlight.startDate || ''} 
                    onChange={e => setNewFlight({...newFlight, startDate: e.target.value})} 
                    />
                    <Form.Control 
                    size="sm" 
                    type="date"
                    value={newFlight.endDate || ''} 
                    onChange={e => setNewFlight({...newFlight, endDate: e.target.value})} 
                    />
                </div>
              </td>
              <td>
                <Form.Control 
                  size="sm" 
                  type="number" 
                  placeholder="Price" 
                  value={newFlight.pricePerPerson || ''} 
                  onChange={e => setNewFlight({...newFlight, pricePerPerson: Number(e.target.value)})} 
                />
              </td>
              <td><Button size="sm" onClick={handleAdd}>Add</Button></td>
            </tr>
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};

export default FlightManager;
