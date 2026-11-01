"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Search, ShoppingBasket } from "lucide-react";
import {
  apiRequest,
  getApiErrorMessage,
  type UserProfile,
} from "@/lib/api/client";
import {
  formatDate,
  formatFcfa,
  orderStatusLabels,
  type OrderStatus,
  type SalesOrder,
  type SalesOrderPage,
} from "@/features/sales/sales-types";

const statuses = ["confirmed", "preparing", "delivered", "cancelled"] as const;

function isOrderStatus(value: string): value is OrderStatus {
  return statuses.some((status) => status === value);
}

export function SalesPage() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const membership = profile.data?.memberships[0];
  const orders = useQuery({
    queryKey: [
      "sales",
      "orders",
      membership?.organization_id,
      deferredSearch,
      statusFilter,
      page,
    ],
    queryFn: () => {
      if (!membership) throw new Error("Aucune organisation active n’est associée au compte.");
      const params = new URLSearchParams({
        page: String(page),
        page_size: "20",
      });
      if (deferredSearch) params.set("search", deferredSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      return apiRequest<SalesOrderPage>(`/sales/orders?${params}`, {
        headers: { "X-Organization-ID": membership.organization_id },
      });
    },
    enabled: Boolean(membership),
    retry: false,
  });
  const canManageSales = membership?.role !== "reader";
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => {
      if (!membership) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<SalesOrder>(`/sales/orders/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Organization-ID": membership.organization_id,
        },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales", "orders"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] }),
      ]);
    },
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      if (!membership) throw new Error("Aucune organisation active n’est associée au compte.");
      const order = await apiRequest<SalesOrder>("/sales/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organization-ID": membership.organization_id,
        },
        body: JSON.stringify({
          customer_name: formData.get("customer_name")?.toString(),
          order_date: formData.get("order_date")?.toString(),
          amount_fcfa: Number(formData.get("amount_fcfa")),
        }),
      });
      form.reset();
      setPage(1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales", "orders"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] }),
      ]);
      setFormMessage(`Commande ${order.reference} enregistrée.`);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const ordersData = orders.data;
  const totalPages = Math.ceil((ordersData?.total ?? 0) / (ordersData?.page_size ?? 20));

  return (
    <div className="dashboard-content">
      <section className="page-heading" aria-labelledby="sales-title">
        <div>
          <p className="eyebrow">Activité commerciale</p>
          <h1 className="page-title" id="sales-title">Ventes et commandes</h1>
          <p className="page-description">
            Enregistrez les commandes clients et suivez leur avancement.
          </p>
        </div>
        <div className="date-chip">{ordersData?.total ?? 0} commande(s)</div>
      </section>

      {canManageSales ? (
        <section className="panel sales-create-panel" aria-labelledby="create-order-title">
          <div className="panel-header">
            <div>
              <h2 className="panel-title" id="create-order-title">Enregistrer une commande</h2>
              <p className="panel-subtitle">La référence est générée automatiquement.</p>
            </div>
          </div>
          <form className="sales-order-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Nom du client</span>
              <input
                autoComplete="organization"
                maxLength={160}
                minLength={2}
                name="customer_name"
                placeholder="Ex. Marché Central"
                required
              />
            </label>
            <label className="auth-field">
              <span>Date de commande</span>
              <input name="order_date" defaultValue={today} required type="date" />
            </label>
            <label className="auth-field">
              <span>Montant (FCFA)</span>
              <input
                min="1"
                name="amount_fcfa"
                placeholder="485000"
                required
                type="number"
              />
            </label>
            <button className="button-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Enregistrement…" : "Enregistrer la commande"}
            </button>
            {formError ? <p className="auth-error" role="alert">{formError}</p> : null}
            {formMessage ? <p className="admin-success" role="status">{formMessage}</p> : null}
          </form>
        </section>
      ) : null}

      {orders.isError ? (
        <div className="dashboard-error" role="alert">
          <p>{getApiErrorMessage(orders.error)}</p>
          <button className="button-secondary" type="button" onClick={() => void orders.refetch()}>
            Réessayer
          </button>
        </div>
      ) : null}
      {updateStatus.isError ? (
        <p className="auth-error sales-error" role="alert">
          {getApiErrorMessage(updateStatus.error)}
        </p>
      ) : null}

      <section className="panel sales-list-panel" aria-labelledby="orders-list-title">
        <div className="panel-header">
          <div>
            <h2 className="panel-title" id="orders-list-title">Toutes les commandes</h2>
            <p className="panel-subtitle">
              Données enregistrées dans l&apos;espace de votre entreprise.
            </p>
          </div>
        </div>
        <div className="sales-table-controls">
          <label className="sales-search">
            <Search size={15} aria-hidden="true" />
            <span className="visually-hidden">Rechercher une commande</span>
            <input
              type="search"
              value={search}
              placeholder="Client ou référence"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="sales-filter-label">
            <span className="visually-hidden">Filtrer par statut</span>
            <select
              className="select-compact"
              value={statusFilter}
              onChange={(event) => {
                const nextStatus = event.target.value;
                if (nextStatus === "all" || isOrderStatus(nextStatus)) {
                  setStatusFilter(nextStatus);
                  setPage(1);
                }
              }}
            >
              <option value="all">Tous les statuts</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{orderStatusLabels[status]}</option>
              ))}
            </select>
          </label>
        </div>
        {orders.isPending ? (
          <div className="dashboard-loading" role="status">Chargement des commandes…</div>
        ) : ordersData?.items.length ? (
          <>
            <div className="table-wrap">
              <table className="data-table sales-table">
                <thead>
                  <tr>
                    <th scope="col">RÉFÉRENCE</th>
                    <th scope="col">CLIENT</th>
                    <th scope="col">DATE</th>
                    <th scope="col">MONTANT</th>
                    <th scope="col">STATUT</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersData.items.map((order) => (
                    <tr key={order.id}>
                      <td className="table-primary">{order.reference}</td>
                      <td>{order.customer_name}</td>
                      <td>{formatDate(order.order_date)}</td>
                      <td className="table-primary">{formatFcfa(order.amount_fcfa)}</td>
                      <td>
                        {canManageSales ? (
                          <label className="status-select-label">
                            <span className="visually-hidden">Statut de {order.reference}</span>
                            <select
                              className={`status-select ${order.status}`}
                              value={order.status}
                              disabled={updateStatus.isPending}
                              onChange={(event) => {
                                if (isOrderStatus(event.target.value)) {
                                  updateStatus.mutate({
                                    id: order.id,
                                    status: event.target.value,
                                  });
                                }
                              }}
                            >
                              {statuses.map((status) => (
                                <option key={status} value={status}>
                                  {orderStatusLabels[status]}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <span className={`status-pill ${order.status}`}>
                            {orderStatusLabels[order.status]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sales-pagination">
              <span>
                {ordersData.total
                  ? `${(page - 1) * ordersData.page_size + 1}–${Math.min(page * ordersData.page_size, ordersData.total)} sur ${ordersData.total}`
                  : "0 commande"}
              </span>
              <div>
                <button
                  className="pagination-button"
                  type="button"
                  aria-label="Page précédente"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  <ChevronLeft size={15} />
                </button>
                <span>Page {page} / {Math.max(totalPages, 1)}</span>
                <button
                  className="pagination-button"
                  type="button"
                  aria-label="Page suivante"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        ) : !orders.isError ? (
          <div className="sales-empty-state">
            <span className="chart-empty-icon"><ShoppingBasket size={18} /></span>
            <h3>{deferredSearch || statusFilter !== "all" ? "Aucune commande trouvée" : "Aucune commande pour le moment"}</h3>
            <p>
              {deferredSearch || statusFilter !== "all"
                ? "Modifiez vos filtres ou votre recherche."
                : "Les ventes saisies ici alimenteront le chiffre d'affaires du tableau de bord."}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
