"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  ExternalLink,
  Facebook,
  Globe2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Store,
  Eye,
  EyeOff,
  UsersRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { apiRequest, getApiErrorMessage, type UserProfile } from "@/lib/api/client";

interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  legal_form: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  hidden_modules: Array<"agriculture" | "elevage">;
  role: "owner" | "admin" | "manager" | "operator" | "reader";
  created_at: string;
}

interface Employee {
  id: string;
  full_name: string;
  role: "owner" | "admin" | "manager" | "operator" | "reader";
  department: string | null;
  job_title: string | null;
  employment_status: "active" | "on_leave" | "ended";
}

interface EmployeePage {
  items: Employee[];
  total: number;
  page: number;
  page_size: number;
  summary: {
    total: number;
    active: number;
    on_leave: number;
    ended: number;
  };
}

const companyAreas = [
  {
    name: "Agriculture",
    description: "Parcelles, campagnes, activités et récoltes.",
    href: "/agriculture",
    className: "agriculture",
    module: "agriculture",
  },
  {
    name: "Élevage",
    description: "Animaux, lots, soins et productions animales.",
    href: "/elevage",
    className: "livestock",
    module: "elevage",
  },
  {
    name: "Productions",
    description: "Lots, transformation et préparation des produits.",
    href: "/productions",
    className: "production",
  },
  {
    name: "Commercialisation",
    description: "Ventes, clients et commandes de la boutique.",
    href: "/ventes",
    className: "sales",
  },
] as const;

const roleLabels: Record<Employee["role"], string> = {
  owner: "Propriétaire",
  admin: "Administration",
  manager: "Responsable",
  operator: "Équipe",
  reader: "Lecture seule",
};

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function optionalValue(value: FormDataEntryValue | null): string | null {
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

export function CompanyPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const membership = profile.data?.memberships[0];
  const organizationId = membership?.organization_id;
  const headers = organizationId ? { "X-Organization-ID": organizationId } : undefined;
  const canEdit = membership?.role === "owner" || membership?.role === "admin";
  const canViewTeam = Boolean(
    membership && ["owner", "admin", "manager"].includes(membership.role),
  );
  const organization = useQuery({
    queryKey: ["company", "profile", organizationId],
    queryFn: () => apiRequest<OrganizationProfile>("/organizations/current", { headers }),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const team = useQuery({
    queryKey: ["company", "team", organizationId],
    queryFn: () =>
      apiRequest<EmployeePage>("/human-resources/employees?page=1&page_size=100", { headers }),
    enabled: Boolean(organizationId && canViewTeam),
    retry: false,
  });

  const updateOrganization = useMutation({
    mutationFn: (body: {
      name: string;
      description: string | null;
      legal_form: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
      website: string | null;
      facebook_url: string | null;
      tiktok_url: string | null;
    }) => apiRequest<OrganizationProfile>("/organizations/current", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    onSuccess: async () => {
      setSubmitError(null);
      setMessage("La fiche entreprise a été mise à jour.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["company", "profile"] }),
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
      ]);
      const editDetails = document.getElementById("company-profile-form");
      if (editDetails instanceof HTMLDetailsElement) editDetails.open = false;
    },
    onError: (error) => {
      setMessage(null);
      setSubmitError(getApiErrorMessage(error));
    },
  });
  const updateHiddenModules = useMutation({
    mutationFn: (hiddenModules: Array<"agriculture" | "elevage">) =>
      apiRequest<OrganizationProfile>("/organizations/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ hidden_modules: hiddenModules }),
      }),
    onSuccess: async () => {
      setSubmitError(null);
      setMessage("Les modules affichés ont été mis à jour.");
      await queryClient.invalidateQueries({ queryKey: ["company", "profile"] });
    },
    onError: (error) => {
      setMessage(null);
      setSubmitError(getApiErrorMessage(error));
    },
  });

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setSubmitError(null);
    updateOrganization.mutate({
      name: String(formData.get("name") ?? "").trim(),
      description: optionalValue(formData.get("description")),
      legal_form: optionalValue(formData.get("legal_form")),
      phone: optionalValue(formData.get("phone")),
      email: optionalValue(formData.get("email")),
      address: optionalValue(formData.get("address")),
      website: optionalValue(formData.get("website")),
      facebook_url: optionalValue(formData.get("facebook_url")),
      tiktok_url: optionalValue(formData.get("tiktok_url")),
    });
  }

  const teamMembers = team.data?.items ?? [];
  const departments = [...new Set(
    teamMembers
      .map((employee) => employee.department?.trim())
      .filter((department): department is string => Boolean(department)),
  )];

  if (profile.isPending || (organization.isPending && organizationId)) {
    return <div className="dashboard-content"><p className="dashboard-loading" role="status">Chargement de la fiche entreprise…</p></div>;
  }
  if (profile.isError) {
    return <div className="dashboard-content"><p className="auth-error" role="alert">{getApiErrorMessage(profile.error)}</p></div>;
  }
  if (!organizationId) {
    return <div className="dashboard-content"><p className="auth-error" role="alert">Aucune organisation active n’est associée au compte.</p></div>;
  }
  if (organization.isError || !organization.data) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-error" role="alert">
          <p>{getApiErrorMessage(organization.error)}</p>
          <button className="button-secondary" type="button" onClick={() => void organization.refetch()}>Réessayer</button>
        </div>
      </div>
    );
  }

  const company = organization.data;
  const visibleCompanyAreas = companyAreas.filter(
    (area) => !("module" in area) || !company.hidden_modules.includes(area.module),
  );
  const formKey = [
    company.name,
    company.description,
    company.legal_form,
    company.phone,
    company.email,
    company.address,
    company.website,
    company.facebook_url,
    company.tiktok_url,
  ].join("|");
  const activeTeam = team.data?.summary.active ?? 0;
  const totalTeam = team.data?.summary.total ?? 0;

  return (
    <div className="dashboard-content company-workspace">
      <section className="page-heading" aria-labelledby="company-title">
        <div>
          <p className="eyebrow">Identité et organisation</p>
          <h1 className="page-title" id="company-title">Entreprise</h1>
          <p className="page-description">La fiche de votre organisation et ses principaux pôles d’activité.</p>
        </div>
        <Link className="company-store-link" href="/">
          <Store size={15} /> Voir l’espace public <ArrowUpRight size={14} />
        </Link>
      </section>

      {message ? <p className="sales-success-message company-feedback" role="status">{message}</p> : null}
      {submitError ? <p className="auth-error company-feedback" role="alert">{submitError}</p> : null}

      <section className="company-identity-card" aria-label="Identité de l’entreprise">
        <div className="company-monogram" aria-hidden="true">{company.name.slice(0, 1).toLocaleUpperCase("fr-FR")}</div>
        <div className="company-identity-copy">
          <p className="eyebrow">Votre organisation</p>
          <h2>{company.name}</h2>
          <p>{company.description || "Ajoutez une courte présentation pour décrire l’entreprise et ses activités."}</p>
        </div>
        <div className="company-identity-meta">
          <span><CalendarDays size={14} /> Depuis le {formattedDate(company.created_at)}</span>
          <span><ShieldCheck size={14} /> {company.role === "owner" ? "Propriétaire" : company.role === "admin" ? "Administrateur" : "Membre"}</span>
        </div>
      </section>

      <section className="company-overview-grid" aria-label="Repères sur l’entreprise">
        <article className="company-overview-card">
          <span className="company-overview-icon"><UsersRound size={17} /></span>
          <div><small>Équipe enregistrée</small><strong>{team.isError ? "—" : totalTeam}</strong><span>{team.isError ? "Données indisponibles" : `${activeTeam} en activité`}</span></div>
        </article>
        <article className="company-overview-card">
          <span className="company-overview-icon activities"><Building2 size={17} /></span>
          <div><small>Pôles présentés</small><strong>{visibleCompanyAreas.length}</strong><span>Activités de l’organisation</span></div>
        </article>
        <article className="company-overview-card">
          <span className="company-overview-icon departments"><Check size={17} /></span>
          <div><small>Services renseignés</small><strong>{team.isError ? "—" : departments.length}</strong><span>{team.isError ? "Données indisponibles" : departments.length ? "Dans l’équipe RH" : "À préciser dans les RH"}</span></div>
        </article>
      </section>

      <section className="company-main-grid">
        <div className="panel company-profile-panel">
          <div className="company-section-heading">
            <div>
              <p className="eyebrow">Fiche entreprise</p>
              <h2>Informations générales</h2>
            </div>
            {canEdit ? <span className="company-edit-permission"><ShieldCheck size={13} /> Modifiable par l’administration</span> : null}
          </div>
          {company.description ? <p className="company-description">{company.description}</p> : null}
          <dl className="company-details-list">
            <div><dt><Building2 size={15} /> Forme juridique</dt><dd>{company.legal_form || "Non renseignée"}</dd></div>
            <div><dt><Phone size={15} /> Téléphone</dt><dd>{company.phone ? <a href={`tel:${company.phone}`}>{company.phone}</a> : "Non renseigné"}</dd></div>
            <div><dt><Mail size={15} /> E-mail</dt><dd>{company.email ? <a href={`mailto:${company.email}`}>{company.email}</a> : "Non renseigné"}</dd></div>
            <div><dt><MapPin size={15} /> Adresse</dt><dd>{company.address || "Non renseignée"}</dd></div>
            <div><dt><Globe2 size={15} /> Site web</dt><dd>{company.website ? <a href={company.website} rel="noopener noreferrer" target="_blank">{company.website}<ExternalLink size={12} /></a> : "Non renseigné"}</dd></div>
            <div><dt><Facebook size={15} /> Facebook</dt><dd>{company.facebook_url ? <a href={company.facebook_url} rel="noopener noreferrer" target="_blank">Voir la page <ExternalLink size={12} /></a> : "Non renseignée"}</dd></div>
            <div><dt><span className="company-tiktok-mark">♪</span> TikTok</dt><dd>{company.tiktok_url ? <a href={company.tiktok_url} rel="noopener noreferrer" target="_blank">Voir le profil <ExternalLink size={12} /></a> : "Non renseigné"}</dd></div>
          </dl>
          {canEdit ? (
            <details className="company-edit-details" id="company-profile-form">
              <summary><Pencil size={14} /> Modifier la fiche</summary>
              <form className="company-profile-form" key={formKey} onSubmit={submitProfile}>
                <label className="auth-field company-form-wide"><span>Nom de l’entreprise</span><input defaultValue={company.name} maxLength={160} minLength={2} name="name" required /></label>
                <label className="auth-field company-form-wide"><span>Présentation</span><textarea defaultValue={company.description ?? ""} maxLength={2000} name="description" rows={4} placeholder="Décrivez l’entreprise, son histoire et sa mission…" /></label>
                <label className="auth-field"><span>Forme juridique</span><input defaultValue={company.legal_form ?? ""} maxLength={120} name="legal_form" placeholder="Ex. SARL, coopérative…" /></label>
                <label className="auth-field"><span>Téléphone</span><input autoComplete="tel" defaultValue={company.phone ?? ""} maxLength={32} name="phone" type="tel" /></label>
                <label className="auth-field"><span>E-mail</span><input autoComplete="email" defaultValue={company.email ?? ""} name="email" type="email" /></label>
                <label className="auth-field company-form-wide"><span>Adresse</span><input autoComplete="street-address" defaultValue={company.address ?? ""} maxLength={500} name="address" /></label>
                <label className="auth-field"><span>Site web</span><input defaultValue={company.website ?? ""} name="website" placeholder="https://…" type="url" /></label>
                <label className="auth-field"><span>Page Facebook</span><input defaultValue={company.facebook_url ?? ""} name="facebook_url" placeholder="https://…" type="url" /></label>
                <label className="auth-field company-form-wide"><span>Profil TikTok</span><input defaultValue={company.tiktok_url ?? ""} name="tiktok_url" placeholder="https://www.tiktok.com/@…" type="url" /></label>
                <div className="company-form-actions company-form-wide">
                  <small>Les champs non renseignés peuvent rester vides. Les changements sont enregistrés pour cette organisation.</small>
                  <button className="button-primary" disabled={updateOrganization.isPending} type="submit">
                    {updateOrganization.isPending ? "Enregistrement…" : "Enregistrer la fiche"}
                  </button>
                </div>
              </form>
            </details>
          ) : (
            <p className="company-readonly-note">Seuls le propriétaire et les administrateurs peuvent modifier les informations de l’entreprise.</p>
          )}
        </div>

        <aside className="panel company-team-panel">
          <div className="company-section-heading">
            <div><p className="eyebrow">Organisation interne</p><h2>Votre équipe</h2></div>
            <UsersRound size={19} aria-hidden="true" />
          </div>
          {team.isPending && canViewTeam ? <p className="dashboard-loading" role="status">Chargement de l’équipe…</p> : null}
          {team.isError && canViewTeam ? (
            <div className="company-inline-error" role="alert">
              <p>{getApiErrorMessage(team.error)}</p>
              <button className="button-secondary" onClick={() => void team.refetch()} type="button">Réessayer</button>
            </div>
          ) : null}
          {!canViewTeam ? (
            <p className="company-readonly-note">La composition détaillée de l’équipe est réservée aux responsables et à l’administration.</p>
          ) : null}
          {canViewTeam && team.data ? (
            <>
              <div className="company-team-totals">
                <div><strong>{team.data.summary.active}</strong><span>En activité</span></div>
                <div><strong>{team.data.summary.on_leave}</strong><span>En congé</span></div>
                <div><strong>{team.data.summary.ended}</strong><span>Anciens</span></div>
              </div>
              <div className="company-team-groups">
                {departments.length ? departments.map((department) => {
                  const members = teamMembers.filter((employee) => employee.department?.trim() === department);
                  return (
                    <div className="company-team-group" key={department}>
                      <span className="company-team-group-mark">{department.slice(0, 1).toLocaleUpperCase("fr-FR")}</span>
                      <div><strong>{department}</strong><small>{members.map((employee) => employee.job_title || roleLabels[employee.role]).join(" · ")}</small></div>
                      <span className="company-team-count">{members.length}</span>
                    </div>
                  );
                }) : (
                  <p className="company-empty-note">Aucun service n’est encore renseigné. Organisez les postes et départements dans les Ressources humaines.</p>
                )}
              </div>
              <Link className="company-team-link" href="/rh">Gérer l’équipe dans les RH <ArrowUpRight size={14} /></Link>
            </>
          ) : null}
        </aside>
      </section>

      <section className="company-areas-section" aria-labelledby="company-areas-title">
        <div className="company-section-heading">
          <div><p className="eyebrow">Activités de l’entreprise</p><h2 id="company-areas-title">Les pôles de l’entreprise</h2></div>
        </div>
        <div className="company-areas-grid">
          {visibleCompanyAreas.map((area) => (
            <Link className={`company-area-card ${area.className}`} href={area.href} key={area.name}>
              <span className="company-area-icon"><Building2 size={17} /></span>
              <span className="company-area-copy"><strong>{area.name}</strong><small>{area.description}</small></span>
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </div>
      </section>

      <section className="panel company-modules-panel" aria-labelledby="company-modules-title">
        <div className="company-section-heading">
          <div>
            <p className="eyebrow">Personnalisation</p>
            <h2 id="company-modules-title">Modules visibles</h2>
            <p className="page-description">Masquez les espaces inutilisés sans supprimer leurs données. Ce choix s’applique à toute l’organisation.</p>
          </div>
          <Eye size={19} aria-hidden="true" />
        </div>
        <div className="company-module-options">
          {([
            ["agriculture", "Agriculture"],
            ["elevage", "Élevage"],
          ] as const).map(([module, label]) => {
            const hidden = company.hidden_modules.includes(module);
            return (
              <label className="company-module-option" key={module}>
                <span>
                  {hidden ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  <span><strong>{label}</strong><small>{hidden ? "Masqué dans l’espace de travail" : "Visible dans l’espace de travail"}</small></span>
                </span>
                <input
                  type="checkbox"
                  checked={!hidden}
                  disabled={!canEdit || updateHiddenModules.isPending}
                  onChange={() => {
                    const hiddenModules = hidden
                      ? company.hidden_modules.filter((item) => item !== module)
                      : [...company.hidden_modules, module];
                    updateHiddenModules.mutate(hiddenModules);
                  }}
                  aria-label={`${hidden ? "Afficher" : "Masquer"} le module ${label}`}
                />
              </label>
            );
          })}
        </div>
        {!canEdit ? <p className="company-readonly-note">Seuls le propriétaire et les administrateurs peuvent modifier ces réglages.</p> : null}
      </section>
    </div>
  );
}
