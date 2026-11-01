import type { SalesOrder } from "@/features/sales/sales-types";

export interface DashboardOverview {
  year: number;
  revenue_fcfa: number;
  order_count: number;
  pending_order_count: number;
  customer_count: number;
  average_order_fcfa: number;
  production_kg: number;
  harvest_count: number;
  parcel_count: number;
  monthly_revenue: Array<{
    month: string;
    month_number: number;
    amount_fcfa: number;
  }>;
  monthly_production_kg: Array<{
    month: string;
    month_number: number;
    quantity_kg: number;
  }>;
  recent_orders: SalesOrder[];
  recent_harvests: Array<{
    id: string;
    parcel_name: string;
    crop: string;
    harvest_date: string;
    quantity_kg: number;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isDashboardOverview(value: unknown): value is DashboardOverview {
  if (!isRecord(value)) return false;
  const numericFields = [
    "year",
    "revenue_fcfa",
    "order_count",
    "pending_order_count",
    "customer_count",
    "average_order_fcfa",
    "production_kg",
    "harvest_count",
    "parcel_count",
  ] as const;
  if (!numericFields.every((field) => typeof value[field] === "number")) return false;
  if (!Array.isArray(value.monthly_revenue) || !Array.isArray(value.monthly_production_kg)) {
    return false;
  }
  if (!Array.isArray(value.recent_orders) || !Array.isArray(value.recent_harvests)) {
    return false;
  }
  return (
    value.monthly_revenue.every(
      (month) =>
        isRecord(month) &&
        typeof month.month === "string" &&
        typeof month.month_number === "number" &&
        typeof month.amount_fcfa === "number",
    ) &&
    value.monthly_production_kg.every(
      (month) =>
        isRecord(month) &&
        typeof month.month === "string" &&
        typeof month.month_number === "number" &&
        typeof month.quantity_kg === "number",
    ) &&
    value.recent_orders.every(
      (order) =>
        isRecord(order) &&
        typeof order.id === "string" &&
        typeof order.customer_name === "string",
    ) &&
    value.recent_harvests.every(
      (harvest) =>
        isRecord(harvest) &&
        typeof harvest.id === "string" &&
        typeof harvest.parcel_name === "string" &&
        typeof harvest.quantity_kg === "number",
    )
  );
}
