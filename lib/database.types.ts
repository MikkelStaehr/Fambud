// Hand-written to match supabase/migrations/0001_init.sql.
// Replace this entire file with `npm run db:types` once you've run the
// migration and have the Supabase CLI authed (`supabase login` once).
// The generated file will be byte-for-byte authoritative.

export type AccountKind =
  | 'checking'
  | 'budget'
  | 'household'
  | 'savings'
  | 'investment'
  | 'credit'
  | 'cash'
  | 'other';
export type LoanType =
  | 'kreditkort'
  | 'realkredit'
  | 'banklan'
  | 'kassekredit'
  | 'andet';
export type InvestmentType =
  | 'aldersopsparing'
  | 'aktiesparekonto'
  | 'aktiedepot'
  | 'pension'
  | 'boerneopsparing';
// Specialfunktion for kind='savings'. Bruges til at identificere konti
// med beregnede målbeløb baseret på brugerens egne tal.
export type SavingsPurpose = 'buffer' | 'predictable_unexpected';
// Familie-økonomi-modellen styrer wizard-forgreningen og hvor lønindkomst
// lander: 'separate' (hver sin lønkonto, sender til fælles) eller 'shared'
// (begge lønninger på én Fælles Lønkonto).
export type HouseholdEconomyType = 'separate' | 'shared';

export type PredictableEstimate = {
  id: string;
  household_id: string;
  label: string;
  yearly_amount: number;
  position: number;
  created_at: string;
};
// Indkomst-rolle på en transaktion. 'primary' = hovedindkomst (løn /
// understøttelse), 'secondary' = biindkomst (freelance, B-skat, udbytte).
// null = ikke kategoriseret (eksisterende rækker før migration 0026).
export type IncomeRole = 'primary' | 'secondary';
// Hvilken slags hovedindkomst en person har. Styrer hvilken UI-flow
// vi guider dem ind i (lønseddel-wizard vs. ydelsestabel).
export type PrimaryIncomeSource = 'salary' | 'benefits';
export type CategoryKind = 'income' | 'expense';
export type RecurrenceFreq =
  | 'once'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly';

// Begivenheder (life_events): planlagte større opsparingsmål.
// Migration 0056 introducerer enums og tabeller.
export type LifeEventType =
  | 'konfirmation'
  | 'bryllup'
  | 'foedselsdag'
  | 'rejse'
  | 'bolig'
  | 'studie'
  | 'andet';
export type LifeEventStatus =
  | 'planning'
  | 'active'
  | 'completed'
  | 'cancelled';
export type LifeEventTimeframe =
  | 'within_1y'
  | 'within_2y'
  | 'within_5y'
  | 'within_10y';
export type LifeEventItemStatus = 'planlagt' | 'booket' | 'betalt';

export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          economy_type: HouseholdEconomyType;
        };
        Insert: {
          id?: string;
          name?: string;
          created_at?: string;
          economy_type?: HouseholdEconomyType;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          economy_type?: HouseholdEconomyType;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string | null;
          household_id: string | null;
          email: string | null;
          full_name: string | null;
          message: string;
          page_url: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          household_id?: string | null;
          email?: string | null;
          full_name?: string | null;
          message: string;
          page_url?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          household_id?: string | null;
          email?: string | null;
          full_name?: string | null;
          message?: string;
          page_url?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          owner_name: string | null;
          kind: AccountKind;
          opening_balance: number;
          archived: boolean;
          created_at: string;
          editable_by_all: boolean;
          created_by: string | null;
          interest_rate: number | null;
          apr: number | null;
          loan_type: LoanType | null;
          original_principal: number | null;
          term_months: number | null;
          lender: string | null;
          payment_amount: number | null;
          payment_interval: RecurrenceFreq;
          payment_start_date: string | null;
          payment_rente: number | null;
          payment_afdrag: number | null;
          payment_bidrag: number | null;
          payment_rabat: number | null;
          investment_type: InvestmentType | null;
          monthly_budget: number | null;
          savings_purposes: SavingsPurpose[] | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          owner_name?: string | null;
          kind?: AccountKind;
          opening_balance?: number;
          archived?: boolean;
          created_at?: string;
          editable_by_all?: boolean;
          created_by?: string | null;
          interest_rate?: number | null;
          apr?: number | null;
          loan_type?: LoanType | null;
          original_principal?: number | null;
          term_months?: number | null;
          lender?: string | null;
          payment_amount?: number | null;
          payment_interval?: RecurrenceFreq;
          payment_start_date?: string | null;
          payment_rente?: number | null;
          payment_afdrag?: number | null;
          payment_bidrag?: number | null;
          payment_rabat?: number | null;
          investment_type?: InvestmentType | null;
          monthly_budget?: number | null;
          savings_purposes?: SavingsPurpose[] | null;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          owner_name?: string | null;
          kind?: AccountKind;
          opening_balance?: number;
          archived?: boolean;
          created_at?: string;
          editable_by_all?: boolean;
          created_by?: string | null;
          interest_rate?: number | null;
          apr?: number | null;
          loan_type?: LoanType | null;
          original_principal?: number | null;
          term_months?: number | null;
          lender?: string | null;
          payment_amount?: number | null;
          payment_interval?: RecurrenceFreq;
          payment_start_date?: string | null;
          payment_rente?: number | null;
          payment_afdrag?: number | null;
          payment_bidrag?: number | null;
          payment_rabat?: number | null;
          investment_type?: InvestmentType | null;
          monthly_budget?: number | null;
          savings_purposes?: SavingsPurpose[] | null;
        };
        Relationships: [];
      };
      predictable_estimates: {
        Row: {
          id: string;
          household_id: string;
          label: string;
          yearly_amount: number;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          label: string;
          yearly_amount: number;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          label?: string;
          yearly_amount?: number;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      household_invites: {
        Row: {
          id: string;
          household_id: string;
          code: string;
          created_by: string;
          created_at: string;
          expires_at: string | null;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          code?: string;
          created_by: string;
          created_at?: string;
          expires_at?: string | null;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          id?: string;
          household_id?: string;
          code?: string;
          created_by?: string;
          created_at?: string;
          expires_at?: string | null;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          kind: CategoryKind;
          color: string;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          kind: CategoryKind;
          color?: string;
          archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          kind?: CategoryKind;
          color?: string;
          archived?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          household_id: string;
          account_id: string;
          category_id: string | null;
          amount: number;
          description: string | null;
          occurs_on: string;
          recurrence: RecurrenceFreq;
          recurrence_until: string | null;
          created_at: string;
          group_label: string | null;
          components_mode: 'additive' | 'breakdown';
          family_member_id: string | null;
          gross_amount: number | null;
          pension_own_pct: number | null;
          pension_employer_pct: number | null;
          other_deduction_amount: number | null;
          other_deduction_label: string | null;
          income_role: IncomeRole | null;
          tax_rate_pct: number | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          account_id: string;
          category_id?: string | null;
          amount: number;
          description?: string | null;
          occurs_on: string;
          recurrence?: RecurrenceFreq;
          recurrence_until?: string | null;
          created_at?: string;
          group_label?: string | null;
          components_mode?: 'additive' | 'breakdown';
          family_member_id?: string | null;
          gross_amount?: number | null;
          pension_own_pct?: number | null;
          pension_employer_pct?: number | null;
          other_deduction_amount?: number | null;
          other_deduction_label?: string | null;
          income_role?: IncomeRole | null;
          tax_rate_pct?: number | null;
        };
        Update: {
          id?: string;
          household_id?: string;
          account_id?: string;
          category_id?: string | null;
          amount?: number;
          description?: string | null;
          occurs_on?: string;
          recurrence?: RecurrenceFreq;
          recurrence_until?: string | null;
          created_at?: string;
          group_label?: string | null;
          components_mode?: 'additive' | 'breakdown';
          family_member_id?: string | null;
          gross_amount?: number | null;
          pension_own_pct?: number | null;
          pension_employer_pct?: number | null;
          other_deduction_amount?: number | null;
          other_deduction_label?: string | null;
          income_role?: IncomeRole | null;
          tax_rate_pct?: number | null;
        };
        Relationships: [];
      };
      transaction_components: {
        Row: {
          id: string;
          household_id: string;
          transaction_id: string;
          label: string;
          amount: number;
          position: number;
          created_at: string;
          family_member_id: string | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          transaction_id: string;
          label: string;
          amount: number;
          position?: number;
          created_at?: string;
          family_member_id?: string | null;
        };
        Update: {
          id?: string;
          household_id?: string;
          transaction_id?: string;
          label?: string;
          amount?: number;
          position?: number;
          created_at?: string;
          family_member_id?: string | null;
        };
        Relationships: [];
      };
      family_members: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          birthdate: string | null;
          user_id: string | null;
          position: number;
          created_at: string;
          email: string | null;
          role: string | null;
          setup_completed_at: string | null;
          joined_at: string | null;
          primary_income_source: PrimaryIncomeSource | null;
          home_address: string | null;
          home_zip_code: string | null;
          home_city: string | null;
          workplace_address: string | null;
          workplace_zip_code: string | null;
          workplace_city: string | null;
          tours_completed: Record<string, string>;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          birthdate?: string | null;
          user_id?: string | null;
          position?: number;
          created_at?: string;
          email?: string | null;
          role?: string | null;
          setup_completed_at?: string | null;
          joined_at?: string | null;
          primary_income_source?: PrimaryIncomeSource | null;
          home_address?: string | null;
          home_zip_code?: string | null;
          home_city?: string | null;
          workplace_address?: string | null;
          workplace_zip_code?: string | null;
          workplace_city?: string | null;
          tours_completed?: Record<string, string>;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          birthdate?: string | null;
          user_id?: string | null;
          position?: number;
          created_at?: string;
          email?: string | null;
          role?: string | null;
          setup_completed_at?: string | null;
          joined_at?: string | null;
          primary_income_source?: PrimaryIncomeSource | null;
          home_address?: string | null;
          home_zip_code?: string | null;
          home_city?: string | null;
          workplace_address?: string | null;
          workplace_zip_code?: string | null;
          workplace_city?: string | null;
          tours_completed?: Record<string, string>;
        };
        Relationships: [];
      };
      transfers: {
        Row: {
          id: string;
          household_id: string;
          from_account_id: string;
          to_account_id: string;
          amount: number;
          description: string | null;
          occurs_on: string;
          recurrence: RecurrenceFreq;
          recurrence_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          from_account_id: string;
          to_account_id: string;
          amount: number;
          description?: string | null;
          occurs_on: string;
          recurrence?: RecurrenceFreq;
          recurrence_until?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          from_account_id?: string;
          to_account_id?: string;
          amount?: number;
          description?: string | null;
          occurs_on?: string;
          recurrence?: RecurrenceFreq;
          recurrence_until?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      life_events: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          type: LifeEventType;
          total_budget: number | null;
          use_items_for_budget: boolean;
          target_date: string | null;
          timeframe: LifeEventTimeframe | null;
          linked_account_id: string | null;
          status: LifeEventStatus;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          type?: LifeEventType;
          total_budget?: number | null;
          use_items_for_budget?: boolean;
          target_date?: string | null;
          timeframe?: LifeEventTimeframe | null;
          linked_account_id?: string | null;
          status?: LifeEventStatus;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          type?: LifeEventType;
          total_budget?: number | null;
          use_items_for_budget?: boolean;
          target_date?: string | null;
          timeframe?: LifeEventTimeframe | null;
          linked_account_id?: string | null;
          status?: LifeEventStatus;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      life_event_items: {
        Row: {
          id: string;
          event_id: string;
          household_id: string;
          title: string;
          amount: number;
          status: LifeEventItemStatus;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          household_id: string;
          title: string;
          amount?: number;
          status?: LifeEventItemStatus;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          household_id?: string;
          title?: string;
          amount?: number;
          status?: LifeEventItemStatus;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_household_member: {
        Args: { hid: string };
        Returns: boolean;
      };
      can_write_account: {
        Args: { account_id: string };
        Returns: boolean;
      };
      generate_invite_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      validate_invite_code: {
        Args: { code_input: string };
        Returns: { valid: boolean; household_name: string | null }[];
      };
      get_household_members: {
        Args: { hid: string };
        Returns: {
          user_id: string;
          email: string;
          role: string;
          joined_at: string;
        }[];
      };
      mark_setup_complete: {
        Args: Record<string, never>;
        Returns: void;
      };
      rate_limit_check: {
        Args: {
          p_key: string;
          p_route: string;
          p_max_hits: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      rate_limit_cleanup: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: {
      account_kind: AccountKind;
      category_kind: CategoryKind;
      recurrence_freq: RecurrenceFreq;
    };
    CompositeTypes: Record<string, never>;
  };
};

// Convenience row aliases for use throughout the app.
export type Account = Database['public']['Tables']['accounts']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Transfer = Database['public']['Tables']['transfers']['Row'];
export type TransactionComponent = Database['public']['Tables']['transaction_components']['Row'];
export type FamilyMember = Database['public']['Tables']['family_members']['Row'];
export type Household = Database['public']['Tables']['households']['Row'];
export type HouseholdInvite = Database['public']['Tables']['household_invites']['Row'];
export type LifeEvent = Database['public']['Tables']['life_events']['Row'];
export type LifeEventItem = Database['public']['Tables']['life_event_items']['Row'];
