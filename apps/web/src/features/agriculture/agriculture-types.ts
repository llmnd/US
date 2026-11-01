export interface Parcel {
  id: string;
  farm_id: string;
  farm_name: string;
  crop_id: string;
  name: string;
  crop: string;
  area_hectares: string;
  is_active: boolean;
  photo_url: string | null;
  created_at: string;
}

export interface Farm {
  id: string;
  name: string;
  location: string | null;
  is_active: boolean;
  photo_url: string | null;
  parcel_count: number;
  area_hectares: string | number;
  created_at: string;
}

export interface FarmPage {
  items: Farm[];
  total: number;
  page: number;
  page_size: number;
}

export interface Crop {
  id: string;
  name: string;
  is_active: boolean;
}

export interface ParcelPage {
  items: Parcel[];
  total: number;
  page: number;
  page_size: number;
}

export interface Harvest {
  id: string;
  parcel_id: string;
  parcel_name: string;
  crop: string;
  campaign_id: string | null;
  campaign_name: string | null;
  harvest_date: string;
  quantity_kg: string;
  notes: string | null;
  created_at: string;
}

export interface HarvestPage {
  items: Harvest[];
  total: number;
  page: number;
  page_size: number;
}

export type CampaignStatus = "planned" | "simulated" | "active" | "closed" | "archived";

export interface Campaign {
  id: string;
  parcel_id: string;
  parcel_name: string;
  farm_id: string;
  farm_name: string;
  crop_id: string;
  crop: string;
  name: string;
  season: string;
  status: CampaignStatus;
  start_date: string;
  expected_harvest_date: string;
  area_hectares: string | number;
  expected_yield_kg_per_hectare: string | number;
  expected_price_fcfa_per_kg: string | number;
  estimated_input_cost_fcfa: number;
  estimated_other_cost_fcfa: number;
  simulated_at: string | null;
  started_at: string | null;
  closed_at: string | null;
  archived_at: string | null;
  expected_production_kg: string | number;
  expected_revenue_fcfa: number;
  estimated_total_cost_fcfa: number;
  estimated_margin_fcfa: number;
  actual_production_kg: string | number;
  actual_sold_kg: string | number;
  actual_revenue_fcfa: number;
  actual_expenses_fcfa: number;
  created_at: string;
}

export interface CampaignPage {
  items: Campaign[];
  total: number;
  page: number;
  page_size: number;
}

export interface FinanceTransaction {
  id: string;
  farm_id: string;
  farm_name: string;
  campaign_id: string | null;
  campaign_name: string | null;
  transaction_type: "income" | "expense";
  category: string;
  label: string;
  amount_fcfa: number;
  transaction_date: string;
  quantity: string | number | null;
  unit: string | null;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface FinanceTransactionPage {
  items: FinanceTransaction[];
  total: number;
  page: number;
  page_size: number;
}

export interface FinanceSummary {
  year: number;
  income_fcfa: number;
  expenses_fcfa: number;
  balance_fcfa: number;
  input_expenses_fcfa: number;
  monthly_income: Array<{ month: string; month_number: number; amount_fcfa: number }>;
  monthly_expenses: Array<{ month: string; month_number: number; amount_fcfa: number }>;
}
