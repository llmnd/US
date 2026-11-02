"use client";

import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { apiRequest, getApiErrorMessage, type UserProfile } from "@/lib/api/client";
import { customerTypeLabel, type Customer, type CustomerPage } from "./customer-types";

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const membership = profile.data?.memberships[0];
  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) return;
    if (editingCustomer && !dialog.open) dialog.showModal();
    else if (!editingCustomer && dialog.open) dialog.close();
  }, [editingCustomer]);
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deletingCustomer && !dialog.open) dialog.showModal();
    else if (!deletingCustomer && dialog.open) dialog.close();
  }, [deletingCustomer]);
  const customers = useQuery({
    queryKey: ["sales", "customers", membership?.organization_id, deferredSearch],
    queryFn: () => {
      if (!membership) throw new Error("Aucune organisation active n’est associée au compte.");
      const params = new URLSearchParams({ page: "1", page_size: "100" });
      if (deferredSearch.length >= 2) params.set("search", deferredSearch);
      return apiRequest<CustomerPage>(`/sales/customers?${params}`, {
        headers: { "X-Organization-ID": membership.organization_id },
      });
    },
    enabled: Boolean(membership),
    retry: false,
  });
  const canManage = Boolean(
    membership && ["owner", "admin", "manager"].includes(membership.role),
  );
  const saveCustomer = useMutation({
    mutationFn: ({
      customerId,
      body,
    }: {
      customerId: string | null;
      body: Record<string, string | null>;
    }) => {
      if (!membership) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<Customer>(
        customerId ? `/sales/customers/${customerId}` : "/sales/customers",
        {
          method: customerId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Organization-ID": membership.organization_id,
          },
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: async (customer, variables) => {
      setFormMessage(
        variables.customerId
          ? `La fiche de ${customer.name} a été mise à jour.`
          : `La fiche de ${customer.name} a été créée.`,
      );
      setFormError(null);
      if (variables.customerId) {
        editDialogRef.current?.close();
        setEditingCustomer(null);
      } else {
        formRef.current?.reset();
        setFormOpen(false);
      }
      await queryClient.invalidateQueries({ queryKey: ["sales", "customers"] });
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });
  const deleteCustomer = useMutation({
    mutationFn: (customer: Customer) => {
      if (!membership) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<void>(`/sales/customers/${customer.id}`, {
        method: "DELETE",
        headers: { "X-Organization-ID": membership.organization_id },
      });
    },
    onSuccess: async (_, deleted) => {
      setActionError(null);
      setFormMessage(`La fiche de ${deleted.name} a été supprimée.`);
      if (editingCustomer?.id === deleted.id) {
        editDialogRef.current?.close();
        setEditingCustomer(null);
      }
      deleteDialogRef.current?.close();
      setDeletingCustomer(null);
      await queryClient.invalidateQueries({ queryKey: ["sales", "customers"] });
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);
    const formData = new FormData(event.currentTarget);
    saveCustomer.mutate({
      customerId: editingCustomer?.id ?? null,
      body: {
        customer_type: String(formData.get("customer_type")),
        name: String(formData.get("name") ?? ""),
        company_name: String(formData.get("company_name") ?? "") || null,
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? "") || null,
        address: String(formData.get("address") ?? "") || null,
        city: String(formData.get("city") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
      },
    });
  }

  function startEditing(customer: Customer) {
    setFormMessage(null);
    setFormError(null);
    setEditingCustomer(customer);
  }

  function confirmDelete(customer: Customer) {
    setFormMessage(null);
    setActionError(null);
    setDeletingCustomer(customer);
  }

  const rows = customers.data?.items ?? [];

  return (
    <div className="dashboard-content">
      <section className="page-heading" aria-labelledby="customers-title">
        <div>
          <p className="eyebrow">Relation client</p>
          <h1 className="page-title" id="customers-title">Clients</h1>
          <p className="page-description">
            Centralisez les coordonnées des particuliers et professionnels pour les retrouver lors de vos ventes.
          </p>
        </div>
        <div className="date-chip">{customers.data?.total ?? 0} client(s)</div>
      </section>

      {canManage ? (
        <details
          className="panel sales-create-panel customers-create-panel"
          onToggle={(event) => setFormOpen(event.currentTarget.open)}
          open={formOpen}
        >
          <summary className="panel-header customers-create-summary">
            <span className="panel-title">
              <Plus size={16} aria-hidden="true" />
              Créer une fiche client
            </span>
            <span className="panel-subtitle">Nom, téléphone, adresse et informations complémentaires</span>
          </summary>
          <form
            className="sales-order-form customers-form"
            onSubmit={submitCustomer}
            ref={formRef}
          >
            <label className="auth-field">
              <span>Type de client</span>
              <select defaultValue="individual" name="customer_type">
                <option value="individual">Particulier</option>
                <option value="professional">Professionnel</option>
              </select>
            </label>
            <label className="auth-field">
              <span>Nom complet / interlocuteur</span>
              <input autoComplete="name" maxLength={160} minLength={2} name="name" required />
            </label>
            <label className="auth-field">
              <span>Entreprise (facultatif)</span>
              <input autoComplete="organization" maxLength={160} name="company_name" />
            </label>
            <label className="auth-field">
              <span>Téléphone</span>
              <input autoComplete="tel" maxLength={32} minLength={6} name="phone" required type="tel" />
            </label>
            <label className="auth-field">
              <span>E-mail (facultatif)</span>
              <input autoComplete="email" maxLength={320} name="email" type="email" />
            </label>
            <label className="auth-field">
              <span>Adresse (facultatif)</span>
              <input autoComplete="street-address" maxLength={500} name="address" />
            </label>
            <label className="auth-field">
              <span>Ville (facultatif)</span>
              <input autoComplete="address-level2" maxLength={100} name="city" />
            </label>
            <label className="auth-field customers-notes">
              <span>Notes (facultatif)</span>
              <textarea maxLength={2000} name="notes" rows={3} />
            </label>
            <button className="button-primary" disabled={saveCustomer.isPending} type="submit">
              {saveCustomer.isPending ? "Création…" : "Créer le client"}
            </button>
            {formError ? <p className="auth-error" role="alert">{formError}</p> : null}
          </form>
        </details>
      ) : null}

      {formMessage ? <p className="admin-success customers-feedback" role="status">{formMessage}</p> : null}
      {formError && !formOpen && !editingCustomer ? (
        <p className="auth-error" role="alert">{formError}</p>
      ) : null}
      {actionError && !deletingCustomer ? <p className="auth-error" role="alert">{actionError}</p> : null}

      {editingCustomer ? (
        <dialog
          aria-labelledby="edit-customer-title"
          className="parcel-edit-dialog customer-edit-dialog"
          onClose={() => {
            setEditingCustomer(null);
            setFormError(null);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) editDialogRef.current?.close();
          }}
          ref={editDialogRef}
        >
          <div className="parcel-edit-dialog-content">
            <div className="parcel-edit-dialog-heading">
              <div>
                <h2 id="edit-customer-title">Modifier le client</h2>
                <p>{editingCustomer.name}</p>
              </div>
              <button
                aria-label="Fermer"
                className="parcel-edit-dialog-close"
                onClick={() => editDialogRef.current?.close()}
                type="button"
              >
                ×
              </button>
            </div>
            <form
              className="sales-order-form customers-form customer-edit-form"
              key={editingCustomer.id}
              onSubmit={submitCustomer}
            >
              <label className="auth-field">
                <span>Type de client</span>
                <select defaultValue={editingCustomer.customer_type} name="customer_type">
                  <option value="individual">Particulier</option>
                  <option value="professional">Professionnel</option>
                </select>
              </label>
              <label className="auth-field">
                <span>Nom complet / interlocuteur</span>
                <input autoComplete="name" defaultValue={editingCustomer.name} maxLength={160} minLength={2} name="name" required />
              </label>
              <label className="auth-field">
                <span>Entreprise (facultatif)</span>
                <input autoComplete="organization" defaultValue={editingCustomer.company_name ?? ""} maxLength={160} name="company_name" />
              </label>
              <label className="auth-field">
                <span>Téléphone</span>
                <input autoComplete="tel" defaultValue={editingCustomer.phone} maxLength={32} minLength={6} name="phone" required type="tel" />
              </label>
              <label className="auth-field">
                <span>E-mail (facultatif)</span>
                <input autoComplete="email" defaultValue={editingCustomer.email ?? ""} maxLength={320} name="email" type="email" />
              </label>
              <label className="auth-field">
                <span>Adresse (facultatif)</span>
                <input autoComplete="street-address" defaultValue={editingCustomer.address ?? ""} maxLength={500} name="address" />
              </label>
              <label className="auth-field">
                <span>Ville (facultatif)</span>
                <input autoComplete="address-level2" defaultValue={editingCustomer.city ?? ""} maxLength={100} name="city" />
              </label>
              <label className="auth-field customers-notes">
                <span>Notes (facultatif)</span>
                <textarea defaultValue={editingCustomer.notes ?? ""} maxLength={2000} name="notes" rows={3} />
              </label>
              {formError ? <p className="auth-error" role="alert">{formError}</p> : null}
              <div className="parcel-edit-dialog-actions">
                <button className="button-secondary" onClick={() => editDialogRef.current?.close()} type="button">
                  Annuler
                </button>
                <button className="button-primary" disabled={saveCustomer.isPending} type="submit">
                  {saveCustomer.isPending ? "Mise à jour…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      ) : null}

      {deletingCustomer ? (
        <dialog
          aria-labelledby="delete-customer-title"
          className="parcel-edit-dialog customer-delete-dialog"
          onClose={() => {
            setDeletingCustomer(null);
            setActionError(null);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) deleteDialogRef.current?.close();
          }}
          ref={deleteDialogRef}
        >
          <div className="parcel-edit-dialog-content">
            <div className="parcel-edit-dialog-heading">
              <div>
                <h2 id="delete-customer-title">Supprimer cette fiche ?</h2>
                <p>{deletingCustomer.name} · {deletingCustomer.phone}</p>
              </div>
              <button
                aria-label="Fermer"
                className="parcel-edit-dialog-close"
                onClick={() => deleteDialogRef.current?.close()}
                type="button"
              >
                ×
              </button>
            </div>
            {actionError ? <p className="auth-error" role="alert">{actionError}</p> : null}
            <p className="customer-delete-warning">
              Les commandes et ventes conserveront leurs coordonnées historiques, mais cette fiche ne sera plus disponible pour les prochaines opérations.
            </p>
            <div className="parcel-edit-dialog-actions">
              <button className="button-secondary" onClick={() => deleteDialogRef.current?.close()} type="button">
                Annuler
              </button>
              <button
                className="button-danger"
                disabled={deleteCustomer.isPending}
                onClick={() => deleteCustomer.mutate(deletingCustomer)}
                type="button"
              >
                {deleteCustomer.isPending ? "Suppression…" : "Supprimer le client"}
              </button>
            </div>
          </div>
        </dialog>
      ) : null}

      {customers.isError ? (
        <div className="dashboard-error" role="alert">
          <p>{getApiErrorMessage(customers.error)}</p>
          <button className="button-secondary" type="button" onClick={() => void customers.refetch()}>
            Réessayer
          </button>
        </div>
      ) : null}

      <section className="panel sales-list-panel" aria-labelledby="customers-list-title">
        <div className="panel-header">
          <div>
            <h2 className="panel-title" id="customers-list-title">Répertoire clients</h2>
            <p className="panel-subtitle">Les acheteurs de la boutique en ligne sont ajoutés automatiquement.</p>
          </div>
        </div>
        <label className="sales-search customers-search">
          <Search size={15} aria-hidden="true" />
          <span className="visually-hidden">Rechercher un client</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom, entreprise, téléphone ou e-mail"
            type="search"
            value={search}
          />
        </label>
        {customers.isPending ? (
          <p className="dashboard-loading" role="status">Chargement des clients…</p>
        ) : rows.length ? (
          <div className="table-wrap">
            <table className="data-table sales-table customers-table">
              <thead>
                <tr>
                  <th scope="col">CLIENT</th>
                  <th scope="col">COORDONNÉES</th>
                  <th scope="col">ADRESSE</th>
                  <th scope="col">TYPE</th>
                  <th scope="col">NOTES</th>
                  {canManage ? <th scope="col">ACTIONS</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <span className="sales-customer-details">
                        <strong>{customer.name}</strong>
                        {customer.company_name ? <small>{customer.company_name}</small> : null}
                      </span>
                    </td>
                    <td>
                      <span className="sales-customer-details">
                        <strong>{customer.phone}</strong>
                        {customer.email ? <small>{customer.email}</small> : null}
                      </span>
                    </td>
                    <td>{[customer.address, customer.city].filter(Boolean).join(", ") || "—"}</td>
                    <td>{customerTypeLabel(customer.customer_type)}</td>
                    <td>{customer.notes || "—"}</td>
                    {canManage ? (
                      <td>
                        <div className="customer-row-actions">
                          <button
                            aria-label={`Modifier ${customer.name}`}
                            className="customer-icon-action"
                            onClick={() => startEditing(customer)}
                            type="button"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            aria-label={`Supprimer ${customer.name}`}
                            className="customer-icon-action customer-delete-action"
                            disabled={deleteCustomer.isPending}
                            onClick={() => confirmDelete(customer)}
                            type="button"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !customers.isError ? (
          <div className="sales-empty-state">
            <span className="chart-empty-icon"><UsersRound size={18} /></span>
            <h3>{deferredSearch.length >= 2 ? "Aucun client trouvé" : "Aucun client enregistré"}</h3>
            <p>Créez une fiche client ou enregistrez une commande sur la boutique pour la faire apparaître ici.</p>
          </div>
        ) : null}
        {customers.data && customers.data.total > customers.data.items.length ? (
          <p className="customer-select-hint">Plus de 100 clients correspondent. Affinez votre recherche pour les afficher.</p>
        ) : null}
      </section>
    </div>
  );
}
