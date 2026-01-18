import React, { useRef } from 'react';
import { Button } from 'react-bootstrap';
import { FaFileDownload, FaFileUpload } from 'react-icons/fa';
import { Destination } from '../types';

interface Props {
  destinations: Destination[];
  onImport: (data: Destination[]) => void;
}

const DataPersistence: React.FC<Props> = ({ destinations, onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const dataStr = JSON.stringify(destinations, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `hackathon-plan-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const parsedData = JSON.parse(json);

        if (Array.isArray(parsedData)) {
            // Basic validation: check if items have an 'id' and 'name'
            const isValid = parsedData.every((item: any) => item.id && item.name);
            if (isValid) {
                // Directly override without confirmation
                onImport(parsedData);
            } else {
                alert('Invalid file format. Please upload a valid Hackathon Planner JSON file.');
            }
        } else {
            alert('Invalid file format. Data must be an array.');
        }
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to parse file. Ensure it is a valid JSON.');
      }
      
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="d-flex gap-2">
      <Button variant="outline-primary" size="sm" className="d-flex align-items-center gap-2" onClick={handleExport} title="Export Data">
        <FaFileDownload /> Export
      </Button>
      <Button variant="outline-primary" size="sm" className="d-flex align-items-center gap-2" onClick={handleImportClick} title="Import Data">
        <FaFileUpload /> Import
      </Button>
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".json" 
        onChange={handleFileChange}
      />
    </div>
  );
};

export default DataPersistence;
