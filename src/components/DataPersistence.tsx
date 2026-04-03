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
  const [status, setStatus] = React.useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const handleExport = () => {
    if (destinations.length === 0) {
      setStatus({ kind: 'error', message: 'No data to export yet.' });
      return;
    }

    const dataStr = JSON.stringify(destinations, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `hackathon-plan-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus({ kind: 'success', message: 'Export complete.' });
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
            const isValid = parsedData.every((item: unknown) => {
              if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
              const d = item as Record<string, unknown>;
              return typeof d.id === 'string' && d.id.trim() !== ''
                && typeof d.name === 'string' && d.name.trim() !== ''
                && typeof d.latitude === 'number' && Number.isFinite(d.latitude)
                && typeof d.longitude === 'number' && Number.isFinite(d.longitude);
            });
            if (isValid && parsedData.length > 0) {
                onImport(parsedData);
                setStatus({ kind: 'success', message: `Imported ${parsedData.length} destinations.` });
            } else {
                setStatus({ kind: 'error', message: 'Invalid file format. Each destination must have id, name, and valid coordinates.' });
            }
        } else {
            setStatus({ kind: 'error', message: 'Invalid file format. Data must be an array.' });
        }
      } catch (error) {
        console.error('Error importing data:', error);
        setStatus({ kind: 'error', message: 'Failed to parse file. Ensure it is valid JSON.' });
      }
      
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="d-flex flex-column align-items-end gap-2">
      <div className="d-flex gap-2">
      <Button
        variant="outline-secondary"
        size="sm"
        className="d-flex align-items-center gap-2"
        onClick={handleExport}
        title="Export Data"
        disabled={destinations.length === 0}
      >
        <FaFileDownload /> Export
      </Button>
      <Button variant="outline-secondary" size="sm" className="d-flex align-items-center gap-2" onClick={handleImportClick} title="Import Data">
        <FaFileUpload /> Import
      </Button>
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".json" 
        onChange={handleFileChange}
      />
      {status && (
        <div className={`inline-status ${status.kind === 'error' ? 'error' : 'success'}`} role="status" aria-live="polite">
          {status.message}
        </div>
      )}
    </div>
  );
};

export default DataPersistence;
