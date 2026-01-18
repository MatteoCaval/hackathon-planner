import React, { useState } from 'react';
import { Table, Button, Form, Card } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { Accommodation } from '../types';

interface Props {
  accommodations: Accommodation[];
  onChange: (acc: Accommodation[]) => void;
}

const AccommodationManager: React.FC<Props> = ({ accommodations, onChange }) => {
  const [newAcc, setNewAcc] = useState<Partial<Accommodation>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);

  const handleAdd = () => {
    if (newAcc.link && newAcc.totalPrice) {
      const acc: Accommodation = {
        id: uuidv4(),
        link: newAcc.link,
        description: newAcc.description || '',
        totalPrice: Number(newAcc.totalPrice),
      };
      onChange([...accommodations, acc]);
      setNewAcc({});
    }
  };

  const handleRemove = (id: string) => {
    onChange(accommodations.filter(a => a.id !== id));
  };
  
  const startEdit = (acc: Accommodation) => {
      setEditId(acc.id);
      setEditPrice(acc.totalPrice);
  };
  
  const saveEdit = (id: string) => {
      const updated = accommodations.map(a => a.id === id ? { ...a, totalPrice: editPrice } : a);
      onChange(updated);
      setEditId(null);
  };

  return (
    <Card className="mb-4">
      <Card.Header>Accommodation</Card.Header>
      <Card.Body>
        <Table striped bordered hover size="sm">
          <thead>
            <tr>
              <th>Description</th>
              <th>Link</th>
              <th>Total Price (€)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {accommodations.map(a => (
              <tr key={a.id}>
                <td>{a.description}</td>
                <td><a href={a.link} target="_blank" rel="noreferrer">Link</a></td>
                <td>
                    {editId === a.id ? (
                        <div className="d-flex gap-2">
                             <Form.Control 
                                size="sm" 
                                type="number" 
                                value={editPrice} 
                                onChange={e => setEditPrice(Number(e.target.value))} 
                             />
                             <Button size="sm" variant="success" onClick={() => saveEdit(a.id)}>Save</Button>
                        </div>
                    ) : (
                        <span>€{a.totalPrice}</span>
                    )}
                </td>
                <td>
                    {editId !== a.id && (
                        <>
                            <Button variant="secondary" size="sm" className="me-1" onClick={() => startEdit(a)}>Edit</Button>
                            <Button variant="danger" size="sm" onClick={() => handleRemove(a.id)}>Remove</Button>
                        </>
                    )}
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <Form.Control 
                  size="sm" 
                  placeholder="Description" 
                  value={newAcc.description || ''} 
                  onChange={e => setNewAcc({...newAcc, description: e.target.value})} 
                />
              </td>
              <td>
                <Form.Control 
                  size="sm" 
                  placeholder="Link" 
                  value={newAcc.link || ''} 
                  onChange={e => setNewAcc({...newAcc, link: e.target.value})} 
                />
              </td>
              <td>
                <Form.Control 
                  size="sm" 
                  type="number" 
                  placeholder="Total Price" 
                  value={newAcc.totalPrice || ''} 
                  onChange={e => setNewAcc({...newAcc, totalPrice: Number(e.target.value)})} 
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

export default AccommodationManager;
