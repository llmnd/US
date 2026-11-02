"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getApiErrorMessage } from "@/lib/api/client";
import type { Customer, CustomerPage } from "./customer-types";

export function CustomerSelect({
  organizationId,
  selectedCustomer,
  onChange,
}: {
  organizationId: string;
  selectedCustomer: Customer | null;
  onChange: (customer: Customer | null) => void;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = search.trim();
  const customers = useQuery({
    queryKey: ["sales", "customers", organizationId, deferredSearch],
    queryFn: () => {
      const params = new URLSearchParams({ page_size: "100" });
      if (deferredSearch.length >= 2) params.set("search", deferredSearch);
      return apiRequest<CustomerPage>(`/sales/customers?${params}`, {
        headers: { "X-Organization-ID": organizationId },
      });
    },
    enabled: Boolean(organizationId),
    retry: false,
  });

  return (
    <div className="customer-select">
      <label className="auth-field customer-select-filter">
        <span>Client</span>
        <input
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filtrer par nom ou téléphone"
          type="search"
          value={search}
        />
      </label>
      {customers.isError ? (
        <p className="auth-error" role="alert">{getApiErrorMessage(customers.error)}</p>
      ) : null}
      <label className="auth-field customer-select-list">
        <span className="visually-hidden">Choisir un client</span>
        <select
          disabled={customers.isPending || !customers.data?.items.length}
          onChange={(event) => {
            onChange(
              customers.data?.items.find((customer) => customer.id === event.target.value) ?? null,
            );
          }}
          value={selectedCustomer?.id ?? ""}
        >
          <option value="">
            {customers.isPending
              ? "Chargement des clients…"
              : customers.data?.items.length
                ? "Sélectionner un client…"
                : "Aucun client trouvé"}
          </option>
          {selectedCustomer && !customers.data?.items.some(
            (customer) => customer.id === selectedCustomer.id,
          ) ? (
            <option value={selectedCustomer.id}>
              {selectedCustomer.name}{selectedCustomer.company_name ? ` · ${selectedCustomer.company_name}` : ""} · {selectedCustomer.phone}
            </option>
          ) : null}
          {customers.data?.items.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}{customer.company_name ? ` · ${customer.company_name}` : ""} · {customer.phone}
            </option>
          ))}
        </select>
      </label>
      {customers.data && customers.data.total > customers.data.items.length ? (
        <small className="customer-select-hint">
          Plus de 100 résultats : filtrez par nom ou téléphone.
        </small>
      ) : null}
      {!customers.isPending && customers.data && !customers.data.items.length ? (
        <p className="customer-select-hint">
          {deferredSearch.length >= 2
            ? "Aucun client trouvé. Créez d’abord sa fiche dans la page Clients."
            : "Créez une fiche client dans la page Clients pour pouvoir la sélectionner."}
        </p>
      ) : null}
      {selectedCustomer ? (
        <div className="customer-select-selected">
          <div>
            <strong>{selectedCustomer.name}</strong>
            <span>{selectedCustomer.phone}{selectedCustomer.email ? ` · ${selectedCustomer.email}` : ""}</span>
          </div>
        </div>
      ) : null}
      <input name="customer_id" type="hidden" value={selectedCustomer?.id ?? ""} />
    </div>
  );
}
