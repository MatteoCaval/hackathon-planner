export interface Flight {
  id: string;
  link: string;
  description: string;
  startDate: string;
  endDate: string;
  pricePerPerson: number;
}

export interface Accommodation {
  id: string;
  link: string;
  description: string;
  totalPrice: number;
  startDate: string;
  endDate: string;
}

export interface ExtraCost {
  description: string;
  value: number;
}

export interface BudgetAttempt {
  id: string;
  name: string;
  createdAt: number;
  flightAssignments: Record<string, number>;
  selectedAccommodationId: string;
  totalCost: number;
  remaining: number;
  perPersonTotal: number;
}

export interface BudgetEstimatorState {
  flightAssignments: Record<string, number>;
  selectedAccommodationId: string;
  fixedAttemptId: string;
  attempts: BudgetAttempt[];
}

export interface Destination {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  notes: string;
  extraCosts: ExtraCost[];
  budgetEstimator: BudgetEstimatorState;
  flightDraft: Partial<Flight>;
  accommodationDraft: Partial<Accommodation>;
  flights: Flight[];
  accommodations: Accommodation[];
}

export interface PlannerSettings {
  totalBudget: number;
  peopleCount: number;
}

export const DUBLIN_COORDS: [number, number] = [53.3498, -6.2603];
