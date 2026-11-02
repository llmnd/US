export type OrderStatus = "pending" | "confirmed" | "preparing" | "delivered" | "cancelled";

export interface SalesOrderItem {
  product_id: string | null;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price_fcfa: number;
}

export interface SalesOrder {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  delivery_address: string | null;
  order_date: string;
  amount_fcfa: number;
  status: OrderStatus;
  created_at: string;
  items: SalesOrderItem[];
}

export interface SalesOrderPage {
  items: SalesOrder[];
  total: number;
  page: number;
  page_size: number;
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "À confirmer",
  confirmed: "Confirmée",
  preparing: "En préparation",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} FCFA`;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}
