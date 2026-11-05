"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Clock3,
  FileClock,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  UserRoundCheck,
  UserRoundMinus,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { apiRequest, getApiErrorMessage, type UserProfile } from "@/lib/api/client";
import { formatFcfa } from "@/features/sales/sales-types";

type EmploymentStatus = "active" | "on_leave" | "ended";
type EmploymentType = "permanent" | "fixed_term" | "seasonal" | "intern" | "contractor";

interface Employee {
  id: string;
  username: string;
  full_name: string;
  role: "owner" | "admin" | "manager" | "operator" | "reader";
  phone: string | null;
  photo_url: string | null;
  is_active: boolean;
  job_title: string | null;
  department: string | null;
  hire_date: string | null;
  employment_type: EmploymentType | null;
  employment_status: EmploymentStatus;
}

interface EmployeeSummary {
  total: number;
  active: number;
  on_leave: number;
  ended: number;
}

interface EmployeePage {
  items: Employee[];
  total: number;
  page: number;
  page_size: number;
  summary: EmployeeSummary;
}

type PayrollStatus = "pending" | "paid";
type AbsenceType = "annual_leave" | "sick_leave" | "family_event" | "unpaid" | "other";
type AbsenceStatus = "pending" | "approved" | "rejected" | "cancelled";
type HumanResourcesTab = "team" | "payroll" | "absences";

interface PayrollRecord {
  id: string;
  user_id: string;
  employee_name: string;
  department: string | null;
  pay_year: number;
  pay_month: number;
  gross_pay_fcfa: number;
  bonus_fcfa: number;
  deductions_fcfa: number;
  net_pay_fcfa: number;
  payment_status: PayrollStatus;
  paid_at: string | null;
  note: string | null;
  created_at: string;
}

interface PayrollPage {
  items: PayrollRecord[];
  total: number;
  page: number;
  page_size: number;
}

interface AbsenceRequest {
  id: string;
  user_id: string;
  employee_name: string;
  department: string | null;
  absence_type: AbsenceType;
  start_date: string;
  end_date: string;
  reason: string;
  status: AbsenceStatus;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface AbsencePage {
  items: AbsenceRequest[];
  total: number;
  page: number;
  page_size: number;
}

const statusLabels: Record<EmploymentStatus, string> = {
  active: "En activité",
  on_leave: "En congé",
  ended: "Ancien membre",
};

const typeLabels: Record<EmploymentType, string> = {
  permanent: "CDI",
  fixed_term: "CDD",
  seasonal: "Saisonnier",
  intern: "Stage",
  contractor: "Prestataire",
};

const roleLabels: Record<Employee["role"], string> = {
  owner: "Propriétaire",
  admin: "Administration",
  manager: "Responsable",
  operator: "Équipe",
  reader: "Lecture seule",
};

const absenceTypeLabels: Record<AbsenceType, string> = {
  annual_leave: "Congé",
  sick_leave: "Maladie",
  family_event: "Événement familial",
  unpaid: "Absence non rémunérée",
  other: "Autre",
};

const absenceStatusLabels: Record<AbsenceStatus, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
  cancelled: "Annulée",
};

const monthLabels = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const statusOptions: { value: EmploymentStatus | "all"; label: string }[] = [
  { value: "all", label: "Toute l’équipe" },
  { value: "active", label: "En activité" },
  { value: "on_leave", label: "En congé" },
  { value: "ended", label: "Anciens membres" },
];

function formatHireDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function HumanResourcesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EmploymentStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<HumanResourcesTab>("team");
  const [payYear, setPayYear] = useState(new Date().getFullYear());
  const [payMonth, setPayMonth] = useState(new Date().getMonth() + 1);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const payrollFormDetailsRef = useRef<HTMLDetailsElement>(null);
  const absenceFormDetailsRef = useRef<HTMLDetailsElement>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const membership = profile.data?.memberships[0];
  const organizationId = membership?.organization_id;
  const headers = organizationId ? { "X-Organization-ID": organizationId } : undefined;
  const canManage = Boolean(
    membership && ["owner", "admin", "manager"].includes(membership.role),
  );
  const canManagePayroll = Boolean(
    membership && ["owner", "admin"].includes(membership.role),
  );
  const visibleTab = canManage || tab !== "team" ? tab : "payroll";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (editingEmployee && !dialog.open) dialog.showModal();
    else if (!editingEmployee && dialog.open) dialog.close();
  }, [editingEmployee]);

  const employees = useQuery({
    queryKey: ["human-resources", "employees", organizationId, deferredSearch, status, page],
    queryFn: () => {
      if (!organizationId) {
        throw new Error("Aucune organisation active n’est associée au compte.");
      }
      const params = new URLSearchParams({ page: String(page), page_size: "50" });
      if (deferredSearch.length >= 2) params.set("search", deferredSearch);
      if (status !== "all") params.set("status", status);
      return apiRequest<EmployeePage>(`/human-resources/employees?${params}`, { headers });
    },
    enabled: Boolean(canManage && organizationId),
    retry: false,
  });

  const payrollEmployees = useQuery({
    queryKey: ["human-resources", "payroll-employees", organizationId],
    queryFn: () => apiRequest<EmployeePage>(
      "/human-resources/employees?page=1&page_size=100",
      { headers },
    ),
    enabled: Boolean(canManagePayroll && organizationId),
    retry: false,
  });

  const payroll = useQuery({
    queryKey: ["human-resources", "payroll", organizationId, profile.data?.id, payYear, payMonth],
    queryFn: () => {
      if (!organizationId) {
        throw new Error("Aucune organisation active n’est associée au compte.");
      }
      const params = new URLSearchParams({
        year: String(payYear),
        month: String(payMonth),
        page: "1",
        page_size: "100",
      });
      return apiRequest<PayrollPage>(`/human-resources/payroll?${params}`, { headers });
    },
    enabled: Boolean(organizationId && profile.data),
    retry: false,
  });

  const absences = useQuery({
    queryKey: ["human-resources", "absences", organizationId, profile.data?.id],
    queryFn: () => {
      if (!organizationId) {
        throw new Error("Aucune organisation active n’est associée au compte.");
      }
      return apiRequest<AbsencePage>("/human-resources/absences?page=1&page_size=100", {
        headers,
      });
    },
    enabled: Boolean(organizationId && profile.data),
    retry: false,
  });

  const updateEmployee = useMutation({
    mutationFn: ({
      employeeId,
      changes,
    }: {
      employeeId: string;
      changes: {
        job_title: string | null;
        department: string | null;
        hire_date: string | null;
        employment_type: EmploymentType | null;
        employment_status: EmploymentStatus;
      };
    }) => {
      if (!organizationId) {
        throw new Error("Aucune organisation active n’est associée au compte.");
      }
      return apiRequest<Employee>(`/human-resources/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(changes),
      });
    },
    onSuccess: async (employee) => {
      setFormError(null);
      setMessage(`La fiche de ${employee.full_name} a été mise à jour.`);
      dialogRef.current?.close();
      setEditingEmployee(null);
      await queryClient.invalidateQueries({ queryKey: ["human-resources", "employees"] });
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  const createPayroll = useMutation({
    mutationFn: (body: {
      user_id: string;
      pay_year: number;
      pay_month: number;
      gross_pay_fcfa: number;
      bonus_fcfa: number;
      deductions_fcfa: number;
      note: string | null;
    }) => apiRequest<PayrollRecord>("/human-resources/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    onSuccess: async (record) => {
      setFormError(null);
      setMessage(`La paie de ${record.employee_name} a été enregistrée.`);
      payrollFormDetailsRef.current?.querySelector("form")?.reset();
      if (payrollFormDetailsRef.current) payrollFormDetailsRef.current.open = false;
      await queryClient.invalidateQueries({ queryKey: ["human-resources", "payroll"] });
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  const markPayrollPaid = useMutation({
    mutationFn: (recordId: string) => apiRequest<PayrollRecord>(
      `/human-resources/payroll/${recordId}/mark-paid`,
      { method: "POST", headers },
    ),
    onSuccess: async (record) => {
      setFormError(null);
      setMessage(`Le paiement de ${record.employee_name} a été enregistré.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["human-resources", "payroll"] }),
        queryClient.invalidateQueries({ queryKey: ["finances"] }),
      ]);
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  const createAbsence = useMutation({
    mutationFn: (body: {
      absence_type: AbsenceType;
      start_date: string;
      end_date: string;
      reason: string;
    }) => apiRequest<AbsenceRequest>("/human-resources/absences", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    onSuccess: async () => {
      setFormError(null);
      setMessage("Votre demande d’absence a été envoyée pour validation.");
      absenceFormDetailsRef.current?.querySelector("form")?.reset();
      if (absenceFormDetailsRef.current) absenceFormDetailsRef.current.open = false;
      await queryClient.invalidateQueries({ queryKey: ["human-resources", "absences"] });
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  const reviewAbsence = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      apiRequest<AbsenceRequest>(`/human-resources/absences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ status }),
      }),
    onSuccess: async (absence) => {
      setFormError(null);
      setMessage(`La demande de ${absence.employee_name} a été ${absenceStatusLabels[absence.status].toLowerCase()}.`);
      await queryClient.invalidateQueries({ queryKey: ["human-resources", "absences"] });
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  const cancelAbsence = useMutation({
    mutationFn: (id: string) => apiRequest<AbsenceRequest>(
      `/human-resources/absences/${id}/cancel`,
      { method: "POST", headers },
    ),
    onSuccess: async () => {
      setFormError(null);
      setMessage("Votre demande en attente a été annulée.");
      await queryClient.invalidateQueries({ queryKey: ["human-resources", "absences"] });
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  function submitPayroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFormError(null);
    setMessage(null);
    createPayroll.mutate({
      user_id: String(data.get("user_id") ?? ""),
      pay_year: Number(data.get("pay_year")),
      pay_month: Number(data.get("pay_month")),
      gross_pay_fcfa: Number(data.get("gross_pay_fcfa")),
      bonus_fcfa: Number(data.get("bonus_fcfa") || 0),
      deductions_fcfa: Number(data.get("deductions_fcfa") || 0),
      note: String(data.get("note") ?? "").trim() || null,
    });
  }

  function submitAbsence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFormError(null);
    setMessage(null);
    createAbsence.mutate({
      absence_type: String(data.get("absence_type")) as AbsenceType,
      start_date: String(data.get("start_date") ?? ""),
      end_date: String(data.get("end_date") ?? ""),
      reason: String(data.get("reason") ?? "").trim(),
    });
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const employee = editingEmployee;
    if (!employee) return;
    const data = new FormData(event.currentTarget);
    setFormError(null);
    setMessage(null);
    updateEmployee.mutate({
      employeeId: employee.id,
      changes: {
        job_title: String(data.get("job_title") ?? "").trim() || null,
        department: String(data.get("department") ?? "").trim() || null,
        hire_date: String(data.get("hire_date") ?? "") || null,
        employment_type:
          (String(data.get("employment_type") ?? "") as EmploymentType) || null,
        employment_status: String(data.get("employment_status")) as EmploymentStatus,
      },
    });
  }

  const rows = employees.data?.items ?? [];
  const payrollEmployeeRows = (payrollEmployees.data?.items ?? []).filter(
    (employee) => employee.is_active && employee.employment_status === "active",
  );
  const summary = employees.data?.summary;
  const totalPages = Math.ceil((employees.data?.total ?? 0) / 50);
  const canRequestAbsence = membership?.role !== "reader";

  return (
    <div className="dashboard-content human-resources-workspace">
      <section className="page-heading" aria-labelledby="hr-title">
        <div>
          <p className="eyebrow">Équipe & organisation</p>
          <h1 className="page-title" id="hr-title">Ressources humaines</h1>
          <p className="page-description">
            Retrouvez les membres de votre organisation et gardez leurs informations professionnelles à jour.
          </p>
        </div>
        {membership?.role === "owner" || membership?.role === "admin" ? (
          <Link className="button-primary hr-add-member" href="/administration">
            <UserRoundPlus size={16} />
            Ajouter un membre
          </Link>
        ) : null}
      </section>

      <div className="hr-context-banner">
        <BriefcaseBusiness size={19} aria-hidden="true" />
        <p>
          La paie est saisie manuellement et le net est calculé sans appliquer de taux légaux.
          Les paiements confirmés sont reportés dans Finances ; les demandes d’absence suivent
          un circuit de validation.
        </p>
        <Link href="/finances" aria-label="Ouvrir les finances">
          Voir les finances <ArrowRight size={14} />
        </Link>
      </div>

      {profile.isPending ? (
        <p className="dashboard-loading" role="status">Vérification des accès…</p>
      ) : profile.isError ? (
        <p className="auth-error" role="alert">{getApiErrorMessage(profile.error)}</p>
      ) : null}
      {message ? <p className="sales-success-message hr-feedback" role="status">{message}</p> : null}
      {formError ? <p className="auth-error hr-feedback" role="alert">{formError}</p> : null}

      <nav className="hr-tabs" aria-label="Sections des ressources humaines">
        {canManage ? (
          <button
            aria-current={visibleTab === "team" ? "page" : undefined}
            className={visibleTab === "team" ? "active" : ""}
            onClick={() => setTab("team")}
            type="button"
          >
            <UsersRound size={15} /> Équipe
          </button>
        ) : null}
        <button
          aria-current={visibleTab === "payroll" ? "page" : undefined}
          className={visibleTab === "payroll" ? "active" : ""}
          onClick={() => setTab("payroll")}
          type="button"
        >
          <Banknote size={15} /> Paie
        </button>
        <button
          aria-current={visibleTab === "absences" ? "page" : undefined}
          className={visibleTab === "absences" ? "active" : ""}
          onClick={() => setTab("absences")}
          type="button"
        >
          <CalendarDays size={15} /> Absences
        </button>
      </nav>

      {visibleTab === "team" && summary ? (
        <section className="hr-summary-grid" aria-label="Effectifs">
          <article className="hr-summary-card">
            <span className="hr-summary-icon"><UsersRound size={17} /></span>
            <div><small>Effectif</small><strong>{summary.total}</strong><span>membre(s)</span></div>
          </article>
          <article className="hr-summary-card">
            <span className="hr-summary-icon active"><UserRoundCheck size={17} /></span>
            <div><small>En activité</small><strong>{summary.active}</strong><span>dans l’organisation</span></div>
          </article>
          <article className="hr-summary-card">
            <span className="hr-summary-icon leave"><Clock3 size={17} /></span>
            <div><small>En congé</small><strong>{summary.on_leave}</strong><span>indiqué(s) dans les fiches</span></div>
          </article>
          <article className="hr-summary-card">
            <span className="hr-summary-icon ended"><UserRoundMinus size={17} /></span>
            <div><small>Anciens membres</small><strong>{summary.ended}</strong><span>historique conservé</span></div>
          </article>
        </section>
      ) : null}

      {visibleTab === "team" && employees.isError ? (
        <div className="dashboard-error" role="alert">
          <p>{getApiErrorMessage(employees.error)}</p>
          <button className="button-secondary" type="button" onClick={() => void employees.refetch()}>
            Réessayer
          </button>
        </div>
      ) : null}

      {visibleTab === "team" && canManage ? <section className="panel hr-directory-panel" aria-labelledby="hr-directory-title">
        <div className="hr-directory-heading">
          <div>
            <p className="eyebrow">Répertoire interne</p>
            <h2 id="hr-directory-title">L’équipe</h2>
            <p>{employees.data?.total ?? 0} membre(s) affiché(s)</p>
          </div>
          <label className="hr-status-filter">
            <span className="visually-hidden">Filtrer les collaborateurs par situation</span>
            <select
              className="select-compact"
              onChange={(event) => {
                setStatus(event.currentTarget.value as EmploymentStatus | "all");
                setPage(1);
              }}
              value={status}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="sales-search hr-search">
          <Search size={16} aria-hidden="true" />
          <span className="visually-hidden">Rechercher un membre de l’équipe</span>
          <input
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Nom, identifiant, poste ou service"
            type="search"
            value={search}
          />
        </label>

        {!canManage ? null : employees.isPending ? (
          <p className="dashboard-loading" role="status">Chargement de l’équipe…</p>
        ) : rows.length ? (
          <div className="hr-employee-grid">
            {rows.map((employee) => (
              <article className="hr-employee-card" key={employee.id}>
                <div className="hr-employee-card-top">
                  <MemberAvatar
                    className="hr-employee-avatar"
                    name={employee.full_name}
                    organizationId={organizationId ?? ""}
                    photoUrl={employee.photo_url}
                    userId={employee.id}
                  />
                  <span className={`hr-status-pill ${employee.employment_status}`}>
                    {statusLabels[employee.employment_status]}
                  </span>
                </div>
                <div className="hr-employee-identity">
                  <h3>{employee.full_name}</h3>
                  <p>{employee.job_title || roleLabels[employee.role]}</p>
                  <small>@{employee.username}</small>
                </div>
                <div className="hr-employee-details">
                  <span>
                    <BriefcaseBusiness size={14} />
                    {employee.department || "Service à renseigner"}
                  </span>
                  <span>
                    <CalendarDays size={14} />
                    {employee.hire_date ? `Depuis le ${formatHireDate(employee.hire_date)}` : "Date d’arrivée à renseigner"}
                  </span>
                  <span className="hr-employment-type">
                    {employee.employment_type ? typeLabels[employee.employment_type] : "Type de contrat à renseigner"}
                  </span>
                </div>
                <div className="hr-employee-card-footer">
                  <span className={employee.is_active ? "hr-account-status" : "hr-account-status suspended"}>
                    {employee.is_active ? "Accès actif" : "Accès suspendu"}
                  </span>
                  {canManage ? (
                    <button
                      aria-label={`Modifier la fiche de ${employee.full_name}`}
                      className="customer-icon-action"
                      onClick={() => {
                        setFormError(null);
                        setMessage(null);
                        setEditingEmployee(employee);
                      }}
                      type="button"
                    >
                      <Pencil size={15} />
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="hr-empty-state">
            <span><UsersRound size={22} /></span>
            <h3>{search || status !== "all" ? "Aucun résultat" : "Votre équipe apparaîtra ici"}</h3>
            <p>
              {search || status !== "all"
                ? "Essayez une autre recherche ou modifiez le filtre de situation."
                : "Les membres créés dans Administration sont automatiquement répertoriés ici."}
            </p>
            {!search && status === "all" && (membership?.role === "owner" || membership?.role === "admin") ? (
              <Link className="button-primary" href="/administration">Ajouter un membre</Link>
            ) : null}
          </div>
        )}

        {totalPages > 1 ? (
          <nav className="stocks-pagination hr-pagination" aria-label="Pagination de l’équipe">
            <button disabled={page === 1} onClick={() => setPage((current) => current - 1)} type="button">
              Précédent
            </button>
            <span>Page {page} sur {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} type="button">
              Suivant
            </button>
          </nav>
        ) : null}
      </section> : null}

      {visibleTab === "payroll" ? (
        <section className="panel hr-module-panel" aria-labelledby="hr-payroll-title">
          <div className="hr-directory-heading">
            <div>
              <p className="eyebrow">{canManagePayroll ? "Gestion confidentielle" : "Votre historique"}</p>
              <h2 id="hr-payroll-title">Bulletins & paiements</h2>
              <p>
                {canManagePayroll
                  ? "Suivi manuel des montants ; aucun taux réglementaire n’est calculé."
                  : "Consultez les bulletins enregistrés pour votre compte."}
              </p>
            </div>
            <label className="hr-period-filter">
              <span className="visually-hidden">Période de paie</span>
              <select
                className="select-compact"
                onChange={(event) => setPayMonth(Number(event.currentTarget.value))}
                value={payMonth}
              >
                {monthLabels.map((label, index) => (
                  <option key={label} value={index + 1}>{label}</option>
                ))}
              </select>
              <select
                aria-label="Année de paie"
                className="select-compact"
                onChange={(event) => setPayYear(Number(event.currentTarget.value))}
                value={payYear}
              >
                {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - index).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>

          {canManagePayroll ? (
            <details className="hr-create-panel" ref={payrollFormDetailsRef}>
              <summary><Plus size={16} /> Saisir une paie <span>Le montant net est calculé automatiquement.</span></summary>
              {payrollEmployees.isError ? (
                <p className="auth-error hr-inline-error" role="alert">
                  {getApiErrorMessage(payrollEmployees.error)}
                </p>
              ) : null}
              <form className="hr-payroll-form" onSubmit={submitPayroll}>
                <label className="auth-field hr-form-wide">
                  <span>Collaborateur</span>
                  <select defaultValue="" name="user_id" required>
                    <option disabled value="">
                      {payrollEmployees.isPending
                        ? "Chargement de l’équipe…"
                        : payrollEmployeeRows.length
                          ? "Choisir un membre de l’équipe"
                          : "Aucun membre actif disponible"}
                    </option>
                    {payrollEmployeeRows.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.full_name}</option>
                    ))}
                  </select>
                </label>
                <label className="auth-field">
                  <span>Mois</span>
                  <select defaultValue={payMonth} name="pay_month">
                    {monthLabels.map((label, index) => (
                      <option key={label} value={index + 1}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="auth-field">
                  <span>Année</span>
                  <select defaultValue={payYear} name="pay_year">
                    {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - index).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>
                <label className="auth-field">
                  <span>Salaire brut (FCFA)</span>
                  <input min="1" name="gross_pay_fcfa" required step="1" type="number" />
                </label>
                <label className="auth-field">
                  <span>Primes (FCFA)</span>
                  <input defaultValue="0" min="0" name="bonus_fcfa" step="1" type="number" />
                </label>
                <label className="auth-field">
                  <span>Retenues saisies (FCFA)</span>
                  <input defaultValue="0" min="0" name="deductions_fcfa" step="1" type="number" />
                </label>
                <label className="auth-field hr-form-wide">
                  <span>Note (facultatif)</span>
                  <input maxLength={2000} minLength={2} name="note" />
                </label>
                <div className="hr-form-actions hr-form-wide">
                  <button
                    className="button-primary"
                    disabled={createPayroll.isPending || payrollEmployees.isPending || !payrollEmployeeRows.length}
                    type="submit"
                  >
                    {createPayroll.isPending ? "Enregistrement…" : "Enregistrer la paie"}
                  </button>
                </div>
              </form>
            </details>
          ) : null}

          {payroll.isError ? (
            <p className="auth-error" role="alert">{getApiErrorMessage(payroll.error)}</p>
          ) : payroll.isPending ? (
            <p className="dashboard-loading" role="status">Chargement des fiches de paie…</p>
          ) : payroll.data?.items.length ? (
            <div className="table-wrap">
              <table className="data-table sales-table hr-payroll-table">
                <thead>
                  <tr>
                    {canManagePayroll ? <th scope="col">COLLABORATEUR</th> : null}
                    <th scope="col">PÉRIODE</th>
                    <th scope="col">BRUT</th>
                    <th scope="col">PRIMES</th>
                    <th scope="col">RETENUES</th>
                    <th scope="col">NET</th>
                    <th scope="col">PAIEMENT</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.data.items.map((record) => (
                    <tr key={record.id}>
                      {canManagePayroll ? (
                        <td><strong>{record.employee_name}</strong>{record.department ? <small>{record.department}</small> : null}</td>
                      ) : null}
                      <td>{monthLabels[record.pay_month - 1]} {record.pay_year}</td>
                      <td>{formatFcfa(record.gross_pay_fcfa)}</td>
                      <td>{formatFcfa(record.bonus_fcfa)}</td>
                      <td>{formatFcfa(record.deductions_fcfa)}</td>
                      <td className="hr-net-pay">{formatFcfa(record.net_pay_fcfa)}</td>
                      <td>
                        {record.payment_status === "paid" ? (
                          <span className="hr-payment-badge paid">
                            <Check size={13} /> Payée{record.paid_at ? ` le ${formatHireDate(record.paid_at)}` : ""}
                          </span>
                        ) : canManagePayroll ? (
                          <button
                            className="hr-mark-paid"
                            disabled={markPayrollPaid.isPending}
                            onClick={() => markPayrollPaid.mutate(record.id)}
                            type="button"
                          >
                            Marquer payée
                          </button>
                        ) : (
                          <span className="hr-payment-badge pending">En attente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="hr-empty-state">
              <span><ReceiptText size={22} /></span>
              <h3>Aucune paie pour cette période</h3>
              <p>Les fiches enregistrées apparaîtront ici. Les bulletins restent visibles par leur titulaire et les responsables autorisés.</p>
            </div>
          )}
        </section>
      ) : null}

      {visibleTab === "absences" ? (
        <section className="panel hr-module-panel" aria-labelledby="hr-absences-title">
          <div className="hr-directory-heading">
            <div>
              <p className="eyebrow">{canManage ? "Suivi de l’équipe" : "Espace personnel"}</p>
              <h2 id="hr-absences-title">{canManage ? "Demandes d’absence" : "Mes demandes d’absence"}</h2>
              <p>{canManage ? "Examinez les demandes et communiquez votre décision." : "Envoyez une demande et suivez sa validation."}</p>
            </div>
          </div>

          {canRequestAbsence ? (
            <details className="hr-create-panel hr-absence-create" ref={absenceFormDetailsRef}>
              <summary><Plus size={16} /> Demander une absence <span>La demande sera transmise à un responsable.</span></summary>
              <form className="hr-absence-form" onSubmit={submitAbsence}>
              <label className="auth-field">
                <span>Type d’absence</span>
                <select defaultValue="annual_leave" name="absence_type">
                  <option value="annual_leave">Congé</option>
                  <option value="sick_leave">Maladie</option>
                  <option value="family_event">Événement familial</option>
                  <option value="unpaid">Absence non rémunérée</option>
                  <option value="other">Autre</option>
                </select>
              </label>
              <label className="auth-field">
                <span>Du</span>
                <input name="start_date" required type="date" />
              </label>
              <label className="auth-field">
                <span>Au</span>
                <input name="end_date" required type="date" />
              </label>
              <label className="auth-field hr-form-wide">
                <span>Motif (évitez les informations médicales détaillées)</span>
                <textarea maxLength={1000} minLength={3} name="reason" required rows={3} />
              </label>
              <div className="hr-form-actions hr-form-wide">
                <button className="button-primary" disabled={createAbsence.isPending} type="submit">
                  {createAbsence.isPending ? "Envoi…" : "Envoyer la demande"}
                </button>
              </div>
              </form>
            </details>
          ) : (
            <p className="hr-note">Votre rôle est en lecture seule : vous ne pouvez pas envoyer une demande d’absence.</p>
          )}

          {absences.isError ? (
            <p className="auth-error" role="alert">{getApiErrorMessage(absences.error)}</p>
          ) : absences.isPending ? (
            <p className="dashboard-loading" role="status">Chargement des demandes…</p>
          ) : absences.data?.items.length ? (
            <div className="hr-absence-list">
              {absences.data.items.map((absence) => (
                <article className="hr-absence-card" key={absence.id}>
                  <div className="hr-absence-topline">
                    <span className={`hr-status-pill ${absence.status}`}>{absenceStatusLabels[absence.status]}</span>
                    <span>{absenceTypeLabels[absence.absence_type]}</span>
                  </div>
                  <div className="hr-absence-content">
                    <div className="hr-absence-title">
                      <h3>{canManage ? absence.employee_name : absenceTypeLabels[absence.absence_type]}</h3>
                      <p>
                        {formatHireDate(absence.start_date)}
                        {absence.start_date !== absence.end_date ? ` — ${formatHireDate(absence.end_date)}` : ""}
                        {absence.department ? ` · ${absence.department}` : ""}
                      </p>
                    </div>
                    <p className="hr-absence-reason">{absence.reason}</p>
                    {absence.reviewer_note ? (
                      <p className="hr-review-note">Note du responsable : {absence.reviewer_note}</p>
                    ) : null}
                  </div>
                  {canManage && absence.status === "pending" ? (
                    <div className="hr-absence-actions">
                      <button
                        className="button-secondary"
                        disabled={reviewAbsence.isPending}
                        onClick={() => reviewAbsence.mutate({ id: absence.id, status: "rejected" })}
                        type="button"
                      >
                        Refuser
                      </button>
                      <button
                        className="button-primary"
                        disabled={reviewAbsence.isPending}
                        onClick={() => reviewAbsence.mutate({ id: absence.id, status: "approved" })}
                        type="button"
                      >
                        <Check size={14} /> Approuver
                      </button>
                    </div>
                  ) : absence.status === "pending" && absence.user_id === profile.data?.id ? (
                    <button
                      className="hr-cancel-request"
                      disabled={cancelAbsence.isPending}
                      onClick={() => cancelAbsence.mutate(absence.id)}
                      type="button"
                    >
                      Annuler la demande
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="hr-empty-state">
              <span><FileClock size={22} /></span>
              <h3>Aucune demande pour le moment</h3>
              <p>Les demandes envoyées et leurs décisions seront conservées dans cet historique.</p>
            </div>
          )}
        </section>
      ) : null}

      {editingEmployee ? (
        <dialog
          aria-labelledby="hr-edit-title"
          className="parcel-edit-dialog hr-edit-dialog"
          onClose={() => {
            setEditingEmployee(null);
            setFormError(null);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) dialogRef.current?.close();
          }}
          ref={dialogRef}
        >
          <div className="parcel-edit-dialog-content">
            <div className="parcel-edit-dialog-heading">
              <div>
                <h2 id="hr-edit-title">Fiche professionnelle</h2>
                <p>{editingEmployee.full_name} · @{editingEmployee.username}</p>
              </div>
              <button
                aria-label="Fermer"
                className="parcel-edit-dialog-close"
                onClick={() => dialogRef.current?.close()}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="hr-edit-form" key={editingEmployee.id} onSubmit={submitEdit}>
              <label className="auth-field">
                <span>Intitulé du poste</span>
                <input
                  defaultValue={editingEmployee.job_title ?? ""}
                  maxLength={120}
                  minLength={2}
                  name="job_title"
                  placeholder="Ex. Responsable de production"
                />
              </label>
              <label className="auth-field">
                <span>Service / activité</span>
                <input
                  defaultValue={editingEmployee.department ?? ""}
                  maxLength={100}
                  minLength={2}
                  name="department"
                  placeholder="Ex. Agriculture"
                />
              </label>
              <label className="auth-field">
                <span>Date d’arrivée</span>
                <input defaultValue={editingEmployee.hire_date ?? ""} name="hire_date" type="date" />
              </label>
              <label className="auth-field">
                <span>Type de contrat</span>
                <select defaultValue={editingEmployee.employment_type ?? ""} name="employment_type">
                  <option value="">À renseigner</option>
                  <option value="permanent">CDI</option>
                  <option value="fixed_term">CDD</option>
                  <option value="seasonal">Saisonnier</option>
                  <option value="intern">Stage</option>
                  <option value="contractor">Prestataire</option>
                </select>
              </label>
              <label className="auth-field">
                <span>Situation professionnelle</span>
                <select defaultValue={editingEmployee.employment_status} name="employment_status">
                  <option value="active">En activité</option>
                  <option value="on_leave">En congé</option>
                  <option value="ended">Ancien membre</option>
                </select>
              </label>
              {formError ? <p className="auth-error" role="alert">{formError}</p> : null}
              <div className="parcel-edit-dialog-actions">
                <button className="button-secondary" onClick={() => dialogRef.current?.close()} type="button">
                  Annuler
                </button>
                <button className="button-primary" disabled={updateEmployee.isPending} type="submit">
                  {updateEmployee.isPending ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
