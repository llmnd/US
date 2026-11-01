"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getApiErrorMessage, type UserProfile } from "@/lib/api/client";

const roleOptions = [
  { value: "admin", label: "Administrateur" },
  { value: "manager", label: "Gestionnaire" },
  { value: "operator", label: "Opérateur" },
  { value: "reader", label: "Lecture seule" },
] as const;

export function UserManagement() {
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    const membership = profile.data?.memberships[0];
    if (!membership) {
      setError("Aucune organisation active n’est associée à votre compte.");
      setIsSubmitting(false);
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const user = await apiRequest<{ username: string }>("/organizations/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organization-ID": membership.organization_id,
        },
        body: JSON.stringify({
          username: formData.get("username")?.toString(),
          full_name: formData.get("full_name")?.toString(),
          password: formData.get("password")?.toString(),
          role: formData.get("role")?.toString(),
        }),
      });
      form.reset();
      setMessage(`Le compte « ${user.username} » a été créé.`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  const role = profile.data?.memberships[0]?.role;
  if (role && role !== "owner" && role !== "admin") {
    return <p className="auth-error">Seuls les administrateurs peuvent créer des comptes.</p>;
  }

  return (
    <section className="panel admin-user-panel" aria-labelledby="create-user-title">
      <h2 className="panel-title" id="create-user-title">Ajouter un utilisateur</h2>
      <p className="panel-subtitle">
        Créez un accès à Mamari et choisissez les autorisations de ce compte.
      </p>
      <form className="auth-form admin-user-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span>Identifiant</span>
          <input
            autoComplete="off"
            minLength={3}
            maxLength={32}
            name="username"
            pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
            required
          />
        </label>
        <label className="auth-field">
          <span>Nom complet</span>
          <input autoComplete="name" minLength={2} name="full_name" required />
        </label>
        <label className="auth-field">
          <span>Mot de passe temporaire</span>
          <input
            autoComplete="new-password"
            minLength={6}
            name="password"
            required
            type="password"
          />
          <small>6 caractères minimum.</small>
        </label>
        <label className="auth-field">
          <span>Rôle</span>
          <select className="admin-role-select" defaultValue="operator" name="role">
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        {message ? <p className="admin-success" role="status">{message}</p> : null}
        <button className="button-primary auth-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Création en cours…" : "Créer le compte"}
        </button>
      </form>
    </section>
  );
}
