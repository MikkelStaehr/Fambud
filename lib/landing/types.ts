// State-shape for "Find ud af det selv"-flowet på landing. Holdes i
// memory i InteractiveFlow (useState), persisteres ikke før brugeren
// rammer CTA og email-modalen gemmer hele staten i landing_leads.

export type Brik =
  | 'buffer'
  | 'opsparing'
  | 'alder'
  | 'boern'
  | 'raadighed'
  | 'fordeling';

export type CurrentSystem = 'sheet' | 'app' | 'head' | 'none';

export type UnsureField = 'udgifter' | 'husholdning';

// Større begivenheder de kommende år. Bidrager til opsparingsplan med
// månedligt afdrag = budget / tidsramme-måneder. 'ingen' er gensidigt
// eksklusiv (samme pattern som currentSystem='none').
export type EventType =
  | 'konfirmation'
  | 'bryllup'
  | 'foedselsdag'
  | 'rejse'
  | 'bolig'
  | 'studie'
  | 'ingen';

export type EventTimeframe = 'under-1' | '1-2' | '2-plus';

export type UpcomingEvent = {
  type: EventType;
  budget: number | null;
  timeframe: EventTimeframe | null;
};

export type FlowState = {
  step: 1 | 2 | 3;

  // Step 1 - hvad har de på plads
  brikker: Brik[];
  currentSystem: CurrentSystem | null;

  // Step 2 - tre tal
  indkomst: number | null;
  fasteUdgifter: number | null;
  husholdning: number | null;
  unsureFields: UnsureField[];
  householdAtZero: boolean;

  // Step 2 - større begivenheder. Tom array hvis intet eller 'ingen'
  // valgt (vi gemmer ikke 'ingen' som entry; tom = afkrydset eller
  // ingen valg, behandles ens af planlogikken).
  upcomingEvents: UpcomingEvent[];
};

export const INITIAL_FLOW_STATE: FlowState = {
  step: 1,
  brikker: [],
  currentSystem: null,
  indkomst: null,
  fasteUdgifter: null,
  husholdning: null,
  unsureFields: [],
  householdAtZero: false,
  upcomingEvents: [],
};
