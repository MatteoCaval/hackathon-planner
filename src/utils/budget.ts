import { Accommodation, ExtraCost, Flight, PlannerSettings } from '../types';

export interface BudgetSnapshot {
  assignedPeopleCount: number;
  flightCost: number;
  accommodationCost: number;
  extraCostsCost: number;
  totalCost: number;
  remaining: number;
  perPersonTotal: number;
  perPersonRemaining: number;
  isOverAssigned: boolean;
}

interface SnapshotInput {
  flights: Flight[];
  accommodations: Accommodation[];
  flightAssignments: Record<string, number>;
  selectedAccommodationId: string;
  extraCosts: ExtraCost[];
  settings: PlannerSettings;
}

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value);
};

export const calculateBudgetSnapshot = ({
  flights,
  accommodations,
  flightAssignments,
  selectedAccommodationId,
  extraCosts,
  settings
}: SnapshotInput): BudgetSnapshot => {
  const accommodation = accommodations.find((item) => item.id === selectedAccommodationId);
  const accommodationCost = accommodation ? accommodation.totalPrice : 0;

  const flightCost = Object.entries(flightAssignments).reduce((total, [flightId, count]) => {
    const flight = flights.find((item) => item.id === flightId);
    return total + (flight ? flight.pricePerPerson * count : 0);
  }, 0);

  const assignedPeopleCount = Object.entries(flightAssignments).reduce((total, [flightId, count]) => {
    return flights.some((item) => item.id === flightId) ? total + count : total;
  }, 0);

  const extraCostsCost = extraCosts.reduce((total, extraCost) => total + extraCost.value, 0);
  const totalCost = flightCost + accommodationCost + extraCostsCost;
  const remaining = settings.totalBudget - totalCost;
  const safePeopleCount = Math.max(1, settings.peopleCount);

  return {
    assignedPeopleCount,
    flightCost,
    accommodationCost,
    extraCostsCost,
    totalCost,
    remaining,
    perPersonTotal: totalCost / safePeopleCount,
    perPersonRemaining: remaining / safePeopleCount,
    isOverAssigned: assignedPeopleCount > settings.peopleCount
  };
};
