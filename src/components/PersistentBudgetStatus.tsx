import React, { useMemo } from 'react';
import { Button } from 'react-bootstrap';
import { Destination, PlannerSettings } from '../types';
import { calculateBudgetSnapshot, formatCurrency } from '../utils/budget';
import { FaChartLine, FaExclamationTriangle } from 'react-icons/fa';

interface Props {
  destination?: Destination;
  settings: PlannerSettings;
}

const PersistentBudgetStatus: React.FC<Props> = ({ destination, settings }) => {
  const snapshot = useMemo(() => {
    if (!destination) {
      return null;
    }

    return calculateBudgetSnapshot({
      flights: destination.flights,
      accommodations: destination.accommodations,
      flightAssignments: destination.budgetEstimator.flightAssignments,
      selectedAccommodationId: destination.budgetEstimator.selectedAccommodationId,
      extraCosts: destination.extraCosts,
      settings
    });
  }, [destination, settings]);

  if (!destination || !snapshot) {
    return (
      <section className="budget-status-banner budget-status-empty" aria-live="polite">
        <div className="d-flex align-items-center gap-2">
          <FaChartLine aria-hidden="true" />
          <span>Select a destination to see live budget status.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="budget-status-banner" aria-live="polite">
      <div className="budget-status-main">
        <div className="budget-status-label">Live Budget</div>
        <div className="budget-status-values">
          <span>{formatCurrency(snapshot.totalCost)} total</span>
          <span>{formatCurrency(snapshot.remaining)} remaining</span>
          <span>{formatCurrency(snapshot.perPersonTotal)} per person</span>
        </div>
      </div>

      <div className="budget-status-actions">
        {snapshot.remaining < 0 && (
          <div className="budget-warning">
            <FaExclamationTriangle aria-hidden="true" />
            Over by {formatCurrency(Math.abs(snapshot.remaining))}
          </div>
        )}
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => {
            window.location.hash = 'budget';
          }}
        >
          Open Budget
        </Button>
      </div>
    </section>
  );
};

export default PersistentBudgetStatus;
