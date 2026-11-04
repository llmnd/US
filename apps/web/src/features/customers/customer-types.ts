export type CustomerType = "individual" | "professional";

export interface Customer {
  id: string;
  customer_type: CustomerType;
  name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  has_account: boolean;
  created_at: string;
}

export interface CustomerPage {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
}

export function customerTypeLabel(type: CustomerType): string {
  return type === "professional" ? "Professionnel" : "Particulier";
}
