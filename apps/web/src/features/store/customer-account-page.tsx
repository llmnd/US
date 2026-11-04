"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  LogOut,
  PackageCheck,
  PackageOpen,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import { OrderProductImage } from "@/features/shared/order-product-image";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
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
  type SalesOrderPage,
} from "@/features/sales/sales-types";
import type { StoreProductPage } from "./store-types";

const pageSize = 5;
const statusFilters: Array<{ value: OrderStatus | "all"; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "pending", label: "À confirmer" },
  { value: "confirmed", label: "Validées" },
  { value: "preparing", label: "En préparation" },
  { value: "delivered", label: "Livrées" },
  { value: "cancelled", label: "Annulées" },
];

const statusClassNames = {
  pending: "warning",
  confirmed: "",
  preparing: "warning",
  delivered: "delivered",
  cancelled: "cancelled",
} as const;

const orderProgressSteps = [
  { status: "pending", label: "Reçue", description: "Demande enregistrée", icon: PackageCheck },
  { status: "confirmed", label: "Validée", description: "Commande vérifiée", icon: ClipboardCheck },
  { status: "preparing", label: "Préparation", description: "Votre commande est préparée", icon: PackageOpen },
  { status: "delivered", label: "Livrée", description: "Commande remise", icon: Truck },
] as const;

const orderProgressMessages = {
  pending: "Votre demande est bien reçue. Notre équipe va vérifier la disponibilité des produits.",
  confirmed: "Votre commande est validée par notre équipe.",
  preparing: "Notre équipe prépare votre commande.",
  delivered: "Votre commande a été livrée. Merci pour votre confiance !",
} as const;

export function CustomerAccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const orders = useQuery({
    queryKey: ["store", "my-orders", page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      return apiRequest<SalesOrderPage>(`/store/my-orders?${params}`);
    },
    retry: false,
  });
  const catalog = useQuery({
    queryKey: ["store", "products"],
    queryFn: () => apiRequest<StoreProductPage>("/store/products"),
    retry: false,
  });
  const productById = new Map((catalog.data?.items ?? []).map((product) => [product.id, product]));
  const logout = useMutation({
    mutationFn: () => apiRequest<{ message: string }>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/");
    },
  });
  const totalPages = Math.ceil((orders.data?.total ?? 0) / pageSize);

  return (
    <main className="customer-account-page">
      <header className="customer-account-header">
        <Link className="store-back-link" href="/produits">
          <ArrowLeft size={15} /> Retour à la boutique
        </Link>
        <button
          className="button-secondary"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
          type="button"
        >
          <LogOut size={15} /> {logout.isPending ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </header>

      <section className="customer-account-heading">
        <p className="public-eyebrow">Votre espace client</p>
        <h1>Bonjour{profile.data ? `, ${profile.data.full_name.split(/\s+/)[0]}` : ""}.</h1>
        <p>Consultez vos achats et suivez le traitement de vos commandes.</p>
      </section>

      <section className="customer-profile-card" aria-labelledby="customer-profile-title">
        <div>
          <p className="public-eyebrow">Votre profil</p>
          <h2 id="customer-profile-title">{profile.data?.full_name ?? "Mon compte"}</h2>
          <p>Protégez votre compte en mettant régulièrement à jour votre mot de passe.</p>
        </div>
        <ChangePasswordForm />
      </section>

      {logout.isError ? <p className="auth-error" role="alert">{getApiErrorMessage(logout.error)}</p> : null}
      {orders.isError ? (
        <div className="dashboard-error" role="alert">
          <p>{getApiErrorMessage(orders.error)}</p>
          <button className="button-secondary" type="button" onClick={() => void orders.refetch()}>
            Réessayer
          </button>
        </div>
      ) : orders.isPending ? (
        <p className="store-loading" role="status">Chargement de vos commandes…</p>
      ) : orders.data && (orders.data.total > 0 || statusFilter !== "all") ? (
        <>
          <section className="customer-orders-section" aria-label="Vos commandes">
            <div className="customer-orders-toolbar">
              <div>
                <h2>Mes commandes</h2>
                <p>{orders.data?.total ?? 0} commande(s){statusFilter !== "all" ? ` · ${statusFilters.find((item) => item.value === statusFilter)?.label.toLowerCase()}` : ""}</p>
              </div>
              <label className="customer-orders-filter">
                <span>Filtrer par statut</span>
                <select
                  onChange={(event) => {
                    const selectedFilter = statusFilters.find(
                      (filter) => filter.value === event.target.value,
                    );
                    if (!selectedFilter) return;
                    setStatusFilter(selectedFilter.value);
                    setPage(1);
                  }}
                  value={statusFilter}
                >
                  {statusFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>{filter.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {orders.data?.items.length ? (
              <section className="customer-order-list" aria-label="Commandes de cette page">
            {orders.data.items.map((order) => {
              const currentStep = orderProgressSteps.findIndex((step) => step.status === order.status);
              return (
                <article className="customer-order-card" key={order.id}>
                  <div className="customer-order-heading">
                    <div>
                      <span className="public-eyebrow">Commande {order.reference}</span>
                      <time dateTime={order.order_date}>{formatDate(order.order_date)}</time>
                    </div>
                    <span className={`status-pill ${statusClassNames[order.status]}`}>
                      {orderStatusLabels[order.status]}
                    </span>
                  </div>
                  {order.status === "cancelled" ? (
                    <div className="customer-order-cancelled" role="status">
                      <span><X size={16} /></span>
                      <div>
                        <strong>Commande annulée</strong>
                        <p>Cette commande ne sera pas préparée. Contactez notre équipe si vous avez besoin d’aide.</p>
                      </div>
                    </div>
                  ) : (
                    <section className="customer-order-progress" aria-label={`Progression de la commande ${order.reference}`}>
                      <ol>
                        {orderProgressSteps.map(({ label, description, icon: Icon }, index) => {
                          const isComplete = index < currentStep;
                          const isCurrent = index === currentStep;
                          return (
                            <li
                              className={`customer-progress-step${isComplete ? " is-complete" : ""}${isCurrent ? " is-current" : ""}`}
                              key={label}
                              aria-current={isCurrent ? "step" : undefined}
                            >
                              <span className="customer-progress-marker">
                                {isComplete ? <Check size={15} strokeWidth={2.5} /> : <Icon size={16} />}
                              </span>
                              <span className="customer-progress-copy">
                                <strong>{label}</strong>
                                <small>{description}</small>
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                      <p className="customer-order-status-note">
                        <PackageCheck size={17} />
                        {orderProgressMessages[order.status]}
                      </p>
                    </section>
                  )}
                  <ul className="customer-order-items customer-order-product-list">
                    {order.items.map((item) => (
                      <li key={`${order.id}-${item.product_id ?? item.product_name}`}>
                        <OrderProductImage
                          name={item.product_name}
                          photoPath={item.product_id ? productById.get(item.product_id)?.photo_url ?? null : null}
                        />
                        <span className="customer-order-product-copy">
                          <strong>{item.quantity} × {item.product_name}</strong>
                          <small>{item.unit}</small>
                        </span>
                        <strong className="customer-order-product-price">
                          {formatFcfa(item.quantity * item.unit_price_fcfa)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                  <div className="customer-order-total">
                    <span>Montant estimé</span>
                    <strong>{formatFcfa(order.amount_fcfa)}</strong>
                  </div>
                </article>
              );
            })}
              </section>
            ) : (
              <div className="customer-orders-filter-empty">
                <ShoppingBag size={22} />
                <p>Aucune commande avec ce statut.</p>
              </div>
            )}
          {totalPages > 1 ? (
            <nav className="customer-orders-pagination" aria-label="Pages des commandes">
              <button
                className="button-secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                type="button"
              >
                <ArrowLeft size={15} /> Précédent
              </button>
              <span>Page {page} sur {totalPages}</span>
              <button
                className="button-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Suivant <ArrowRight size={15} />
              </button>
            </nav>
          ) : null}
          </section>
        </>
      ) : (
        <section className="customer-account-empty">
          <ShoppingBag size={25} />
          <h2>Pas encore de commande</h2>
          <p>Vos prochaines commandes et leur avancement apparaîtront ici.</p>
          <Link className="button-primary" href="/produits">
            Découvrir la boutique <ArrowRight size={15} />
          </Link>
        </section>
      )}
    </main>
  );
}
