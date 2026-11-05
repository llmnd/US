"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ChevronDown,
  ChevronRight,
  Lock,
  MessageCircle,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserRoundPlus,
  Users,
  UserX,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { PasswordInput } from "@/features/auth/password-input";
import {
  ApiError,
  apiRequest,
  formatUploadLimit,
  getApiErrorMessage,
  getUploadLimitBytes,
  type UserProfile,
} from "@/lib/api/client";

const MAX_PROFILE_PHOTO_BYTES = getUploadLimitBytes(5 * 1024 * 1024);

type MemberRole = "owner" | "admin" | "manager" | "operator" | "reader";
type RoleFilter = "all" | "admins" | "team" | "readers";

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

const roleLabels: Record<MemberRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  manager: "Responsable",
  operator: "Employé",
  reader: "Lecture seule",
};

const roleFilters: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "admins", label: "Administrateurs" },
  { value: "team", label: "Équipe" },
  { value: "readers", label: "Lecture" },
];

function matchesRole(role: MemberRole, filter: RoleFilter): boolean {
  if (filter === "all") return true;
  if (filter === "admins") return role === "owner" || role === "admin";
  if (filter === "team") return role === "manager" || role === "operator";
  return role === "reader";
}

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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
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
      setInviteOpen(false);
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

  const list = useMemo(() => members.data ?? [], [members.data]);
  const stats = useMemo(
    () => ({
      total: list.length,
      active: list.filter((member) => member.is_active).length,
      suspended: list.filter((member) => !member.is_active).length,
      admins: list.filter((member) => member.role === "owner" || member.role === "admin").length,
    }),
    [list],
  );
  const visibleMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return list.filter(
      (member) =>
        matchesRole(member.role, roleFilter)
        && (!needle
          || member.full_name.toLowerCase().includes(needle)
          || member.username.toLowerCase().includes(needle)),
    );
  }, [list, query, roleFilter]);

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

  const kpis = [
    { label: "Membres", value: stats.total, detail: "comptes dans l’organisation", icon: Users },
    { label: "Accès actifs", value: stats.active, detail: "peuvent se connecter", icon: UserCheck },
    { label: "Suspendus", value: stats.suspended, detail: "accès désactivés", icon: UserX },
    { label: "Administrateurs", value: stats.admins, detail: "propriétaire inclus", icon: ShieldCheck },
  ];

  return (
    <div className="admin-members-page">
      {members.data ? (
        <section className="metrics-grid" aria-label="Indicateurs de l’équipe">
          {kpis.map(({ label, value, detail, icon: Icon }) => (
            <article className="metric-card" key={label}>
              <div className="metric-heading">
                <span>{label}</span>
                <span className="metric-icon"><Icon size={16} /></span>
              </div>
              <div className="metric-value">{value.toLocaleString("fr-FR")}</div>
              <div className="metric-foot">{detail}</div>
            </article>
          ))}
        </section>
      ) : null}

      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {message ? <p className="admin-success" role="status">{message}</p> : null}

      <details
        className="panel adm-invite"
        open={inviteOpen}
        onToggle={(event) => setInviteOpen(event.currentTarget.open)}
      >
        <summary>
          <span className="agriculture-add-icon"><UserRoundPlus size={17} /></span>
          <span>
            <strong>Inviter un collaborateur</strong>
            <small>Créez son accès, choisissez son rôle et son contact WhatsApp</small>
          </span>
          <ChevronRight size={16} />
        </summary>
        <form className="adm-invite-form" onSubmit={handleCreate}>
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
            <span>Rôle et accès</span>
            <select className="admin-role-select" defaultValue="operator" name="role">
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="auth-field">
            <span>Téléphone / WhatsApp</span>
            <input autoComplete="tel" maxLength={32} name="phone" placeholder="+indicatif 77 000 00 00" type="tel" />
            <small>Avec l’indicatif international pour activer WhatsApp.</small>
          </label>
          <label className="auth-field">
            <span>Mot de passe temporaire</span>
            <PasswordInput autoComplete="new-password" minLength={6} maxLength={128} name="password" required />
            <small>6 caractères minimum.</small>
          </label>
          <div className="adm-form-foot">
            <button className="button-primary" disabled={createMember.isPending} type="submit">
              {createMember.isPending ? "Création en cours…" : "Créer le compte"}
            </button>
          </div>
        </form>
      </details>

      <section className="panel adm-directory" aria-labelledby="members-title">
        <div className="adm-directory-head">
          <div>
            <h2 className="panel-title" id="members-title">Équipe et accès</h2>
            <p className="panel-subtitle">Gérez les rôles, les contacts et les profils de votre organisation.</p>
          </div>
          <span className="adm-count">{visibleMembers.length} / {stats.total} membre(s)</span>
        </div>

        <div className="adm-toolbar">
          <div className="segmented-control" role="group" aria-label="Filtrer par rôle">
            {roleFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={roleFilter === filter.value}
                onClick={() => setRoleFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <label className="sales-search">
            <Search size={15} />
            <span className="visually-hidden">Rechercher un membre</span>
            <input
              type="search"
              value={query}
              placeholder="Nom ou identifiant"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
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
        ) : visibleMembers.length ? (
          <div className="adm-list">
            {visibleMembers.map((member) => {
              const isOpen = expandedId === member.id;
              const whatsapp = whatsappUrl(member.phone, member.full_name);
              const isProtected = member.id === profile.data?.id || member.role === "owner";
              return (
                <article
                  className={`adm-member${isOpen ? " is-open" : ""}${member.is_active ? "" : " is-inactive"}`}
                  key={member.id}
                >
                  <div className="adm-row">
                    <MemberAvatar
                      organizationId={organizationId}
                      userId={member.id}
                      name={member.full_name}
                      photoUrl={member.photo_url}
                      className="adm-avatar"
                    />
                    <div className="adm-info">
                      <strong>{member.full_name}</strong>
                      <span>@{member.username}{member.phone ? ` · ${member.phone}` : ""}</span>
                    </div>
                    <div className="adm-badges">
                      <span className={`adm-role adm-role-${member.role}`}>{roleLabels[member.role]}</span>
                      <span className={`status-pill ${member.is_active ? "delivered" : "cancelled"}`}>
                        {member.is_active ? "Actif" : "Suspendu"}
                      </span>
                    </div>
                    <div className="adm-actions">
                      {whatsapp ? (
                        <a
                          className="adm-icon-link"
                          href={whatsapp}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Écrire à ${member.full_name} sur WhatsApp`}
                        >
                          <MessageCircle size={16} />
                        </a>
                      ) : null}
                      <button
                        className="adm-manage"
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`adm-panel-${member.id}`}
                        onClick={() => setExpandedId(isOpen ? null : member.id)}
                      >
                        Gérer <ChevronDown size={15} />
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="adm-panel" id={`adm-panel-${member.id}`}>
                      <form
                        className="adm-edit-form"
                        key={`${member.full_name}|${member.phone ?? ""}`}
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
                        <button className="button-primary" disabled={updateMember.isPending} type="submit">
                          Enregistrer
                        </button>
                      </form>

                      <div className="adm-side">
                        {member.role === "owner" ? (
                          <span className="adm-note"><Lock size={14} />Compte propriétaire protégé</span>
                        ) : (
                          <label className="auth-field">
                            <span>Rôle et accès</span>
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
                        <div className="adm-side-buttons">
                          <label className="adm-chip adm-file">
                            <Camera size={15} />
                            Changer la photo
                            <input
                              accept="image/jpeg,image/png,image/webp"
                              aria-label={`Modifier la photo de ${member.full_name}`}
                              disabled={uploadPhoto.isPending}
                              onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                if (!file) return;
                                if (file.size > MAX_PROFILE_PHOTO_BYTES) {
                                  setError(
                                    `La photo ne doit pas dépasser ${formatUploadLimit(MAX_PROFILE_PHOTO_BYTES)}.`,
                                  );
                                  event.currentTarget.value = "";
                                  return;
                                }
                                setError(null);
                                const form = new FormData();
                                form.append("photo", file);
                                uploadPhoto.mutate({ id: member.id, form });
                                event.currentTarget.value = "";
                              }}
                              type="file"
                            />
                          </label>
                          {isProtected ? (
                            <span className="adm-note">
                              <UserRound size={14} />
                              {member.role === "owner" ? "Accès non suspendable" : "Votre compte"}
                            </span>
                          ) : (
                            <button
                              className={`adm-chip ${member.is_active ? "is-danger" : ""}`}
                              disabled={updateMember.isPending}
                              type="button"
                              onClick={() => updateMember.mutate({
                                id: member.id,
                                changes: { is_active: !member.is_active },
                              })}
                            >
                              {member.is_active ? "Suspendre l’accès" : "Réactiver l’accès"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="operations-empty">
            <span><UserRound size={22} /></span>
            <h3>{list.length ? "Aucun résultat" : "Aucun membre dans l’équipe"}</h3>
            <p>
              {list.length
                ? "Essayez un autre nom ou changez le filtre de rôle."
                : "Les comptes de vos collaborateurs apparaîtront ici après leur création."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}