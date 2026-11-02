"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, MessageCircle, UserRound, UserRoundPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MemberAvatar } from "@/components/member-avatar";
import {
  ApiError,
  apiRequest,
  getApiErrorMessage,
  type UserProfile,
} from "@/lib/api/client";

type MemberRole = "owner" | "admin" | "manager" | "operator" | "reader";

interface OrganizationMember {
  id: string;
  username: string;
  full_name: string;
  role: MemberRole;
  phone: string | null;
  photo_url: string | null;
  is_active: boolean;
}

const roleOptions: { value: Exclude<MemberRole, "owner">; label: string }[] = [
  { value: "admin", label: "Administrateur" },
  { value: "manager", label: "Responsable d’équipe" },
  { value: "operator", label: "Employé" },
  { value: "reader", label: "Lecture seule" },
];

function whatsappUrl(phone: string | null, fullName: string): string | null {
  const dialString = phone?.trim();
  if (!dialString || (!dialString.startsWith("+") && !dialString.startsWith("00"))) return null;
  const number = dialString.replace(/\D/g, "").replace(/^00/, "");
  if (number.length < 8 || number.length > 15) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(`Bonjour ${fullName}`)}`;
}

export function UserManagement() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const membership = profile.data?.memberships[0];
  const organizationId = membership?.organization_id;
  const headers = organizationId ? { "X-Organization-ID": organizationId } : undefined;
  const isAdministrator = membership?.role === "owner" || membership?.role === "admin";
  const members = useQuery({
    queryKey: ["administration", "users", organizationId],
    queryFn: () =>
      apiRequest<OrganizationMember[]>("/organizations/users", { headers }),
    enabled: Boolean(isAdministrator && organizationId),
    retry: false,
  });

  const refreshMembers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["administration", "users"] }),
      queryClient.invalidateQueries({ queryKey: ["operations", "members"] }),
      queryClient.invalidateQueries({ queryKey: ["operations", "tasks"] }),
    ]);
  };
  const createMember = useMutation({
    mutationFn: (body: {
      username: string;
      full_name: string;
      password: string;
      role: string;
      phone: string | null;
    }) => {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<OrganizationMember>("/organizations/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (user) => {
      setError(null);
      setMessage(`Le compte « ${user.username} » a été créé.`);
      await refreshMembers();
    },
    onError: (submitError) => {
      setMessage(null);
      if (submitError instanceof ApiError && submitError.status === 409) {
        setError("Cet identifiant est déjà utilisé, y compris dans une autre organisation. Choisissez-en un autre.");
      } else {
        setError(getApiErrorMessage(submitError));
      }
    },
  });
  const updateMember = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<OrganizationMember> }) => {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<OrganizationMember>(`/organizations/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(changes),
      });
    },
    onSuccess: async () => {
      setError(null);
      setMessage("Les informations du membre ont été mises à jour.");
      await refreshMembers();
    },
    onError: (submitError) => {
      setMessage(null);
      setError(getApiErrorMessage(submitError));
    },
  });
  const uploadPhoto = useMutation({
    mutationFn: ({ id, form }: { id: string; form: FormData }) => {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<OrganizationMember>(`/organizations/users/${id}/photo`, {
        method: "PUT",
        headers,
        body: form,
      });
    },
    onSuccess: async () => {
      setError(null);
      setMessage("La photo de profil a été mise à jour.");
      await refreshMembers();
    },
    onError: (submitError) => {
      setMessage(null);
      setError(getApiErrorMessage(submitError));
    },
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    createMember.mutate(
      {
        username: String(formData.get("username") ?? ""),
        full_name: String(formData.get("full_name") ?? ""),
        password: String(formData.get("password") ?? ""),
        role: String(formData.get("role") ?? "operator"),
        phone: String(formData.get("phone") ?? "").trim() || null,
      },
      { onSuccess: () => form.reset() },
    );
  }

  if (profile.isPending) {
    return <div className="dashboard-loading" role="status">Chargement des membres…</div>;
  }
  if (!isAdministrator || !organizationId) {
    return (
      <p className="auth-error" role="alert">
        Seuls le propriétaire et les administrateurs peuvent gérer les utilisateurs.
      </p>
    );
  }

  return (
    <div className="admin-members-page">
      <section className="panel admin-user-panel" aria-labelledby="create-user-title">
        <div className="panel-header">
          <div>
            <h2 className="panel-title" id="create-user-title">Inviter un collaborateur</h2>
            <p className="panel-subtitle">
              Créez son accès, choisissez son rôle et ajoutez un numéro WhatsApp pour le joindre.
            </p>
          </div>
          <span className="admin-section-icon"><UserRoundPlus size={19} /></span>
        </div>
        <form className="auth-form admin-user-form" onSubmit={handleCreate}>
          <label className="auth-field">
            <span>Identifiant</span>
            <input
              autoComplete="off"
              minLength={3}
              maxLength={32}
              name="username"
              pattern="[A-Za-z0-9](?:[A-Za-z0-9._]|-)*"
              title="3 à 32 caractères : lettres, chiffres, point, tiret ou tiret bas."
              required
            />
          </label>
          <label className="auth-field">
            <span>Nom complet</span>
            <input autoComplete="name" minLength={2} maxLength={160} name="full_name" required />
          </label>
          <label className="auth-field">
            <span>Téléphone / WhatsApp</span>
            <input autoComplete="tel" maxLength={32} name="phone" placeholder="+indicatif 77 000 00 00" type="tel" />
            <small>Ajoutez l’indicatif international pour activer le contact WhatsApp.</small>
          </label>
          <label className="auth-field">
            <span>Mot de passe temporaire</span>
            <input
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
              name="password"
              required
              type="password"
            />
            <small>6 caractères minimum.</small>
          </label>
          <label className="auth-field">
            <span>Rôle et accès</span>
            <select className="admin-role-select" defaultValue="operator" name="role">
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {message ? <p className="admin-success" role="status">{message}</p> : null}
          <button className="button-primary auth-submit" disabled={createMember.isPending} type="submit">
            {createMember.isPending ? "Création en cours…" : "Créer le compte"}
          </button>
        </form>
      </section>

      <section className="panel admin-directory-panel" aria-labelledby="members-title">
        <div className="panel-header">
          <div>
            <h2 className="panel-title" id="members-title">Équipe et accès</h2>
            <p className="panel-subtitle">Gérez les rôles, les contacts et les profils de votre organisation.</p>
          </div>
          <span className="admin-member-count">{members.data?.length ?? 0} membre(s)</span>
        </div>
        {members.isError ? (
          <div className="dashboard-error" role="alert">
            <p>{getApiErrorMessage(members.error)}</p>
            <button className="button-secondary" type="button" onClick={() => void members.refetch()}>
              Réessayer
            </button>
          </div>
        ) : members.isPending ? (
          <div className="dashboard-loading" role="status">Chargement de l’équipe…</div>
        ) : members.data?.length ? (
          <div className="admin-member-list">
            {members.data.map((member) => (
              <article className={`admin-member-card ${member.is_active ? "" : "is-inactive"}`} key={member.id}>
                <MemberAvatar
                  organizationId={organizationId}
                  userId={member.id}
                  name={member.full_name}
                  photoUrl={member.photo_url}
                  className="admin-member-avatar"
                />
                <div className="admin-member-info">
                  <strong>{member.full_name}</strong>
                  <span>@{member.username} · {member.is_active ? "Accès actif" : "Accès suspendu"}</span>
                  {member.phone ? <span>{member.phone}</span> : <span>Pas de numéro renseigné</span>}
                </div>
                <div className="admin-member-actions">
                  {member.role === "owner" ? (
                    <span className="admin-owner-label">Propriétaire</span>
                  ) : (
                    <label className="auth-field">
                      <span className="visually-hidden">Rôle de {member.full_name}</span>
                      <select
                        aria-label={`Rôle de ${member.full_name}`}
                        value={member.role}
                        disabled={updateMember.isPending}
                        onChange={(event) => updateMember.mutate({
                          id: member.id,
                          changes: { role: event.currentTarget.value as MemberRole },
                        })}
                      >
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {whatsappUrl(member.phone, member.full_name) ? (
                    <a
                      className="operations-whatsapp-link"
                      href={whatsappUrl(member.phone, member.full_name) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Écrire à ${member.full_name} sur WhatsApp`}
                    >
                      <MessageCircle size={15} />WhatsApp
                    </a>
                  ) : null}
                  <label className="admin-photo-button">
                    <Camera size={15} />
                    Photo
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      aria-label={`Modifier la photo de ${member.full_name}`}
                      disabled={uploadPhoto.isPending}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (!file) return;
                        const form = new FormData();
                        form.append("photo", file);
                        uploadPhoto.mutate({ id: member.id, form });
                        event.currentTarget.value = "";
                      }}
                      type="file"
                    />
                  </label>
                  {member.id !== profile.data?.id && member.role !== "owner" ? (
                    <button
                      className="button-secondary admin-access-button"
                      disabled={updateMember.isPending}
                      type="button"
                      onClick={() => updateMember.mutate({
                        id: member.id,
                        changes: { is_active: !member.is_active },
                      })}
                    >
                      {member.is_active ? "Suspendre" : "Réactiver"}
                    </button>
                  ) : (
                    <span className="admin-you-label">
                      <UserRound size={14} />
                      {member.role === "owner" ? "Compte protégé" : "Vous"}
                    </span>
                  )}
                </div>
                <form
                  className="admin-member-edit-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    updateMember.mutate({
                      id: member.id,
                      changes: {
                        full_name: String(formData.get("full_name") ?? ""),
                        phone: String(formData.get("phone") ?? "").trim() || null,
                      },
                    });
                  }}
                >
                  <label className="auth-field">
                    <span>Nom</span>
                    <input defaultValue={member.full_name} maxLength={160} minLength={2} name="full_name" required />
                  </label>
                  <label className="auth-field">
                    <span>Téléphone</span>
                    <input defaultValue={member.phone ?? ""} maxLength={32} name="phone" type="tel" />
                  </label>
                  <button className="button-secondary" disabled={updateMember.isPending} type="submit">Enregistrer</button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className="operations-empty">
            <span><UserRound size={22} /></span>
            <h3>Aucun membre dans l’équipe</h3>
            <p>Les comptes de vos collaborateurs apparaîtront ici après leur création.</p>
          </div>
        )}
      </section>
    </div>
  );
}
