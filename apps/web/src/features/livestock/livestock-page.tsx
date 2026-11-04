"use client";

import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Baby,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Egg,
  HeartPulse,
  ImagePlus,
  Milk,
  Plus,
  Search,
  Sprout,
  Stethoscope,
  Wheat,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  apiBlobRequest,
  apiRequest,
  getApiErrorMessage,
  type UserProfile,
} from "@/lib/api/client";
import { formatDate, formatFcfa } from "@/features/sales/sales-types";
import { MeasurementUnitSelect } from "@/features/shared/measurement-unit-select";

type LivestockTab = "animals" | "groups" | "care" | "production" | "finance" | "reports";
type FinanceFilter = "all" | "income" | "expense";
type RecordType = "health" | "reproduction" | "production" | "feed";
type Feedback = { kind: "success" | "error"; message: string } | null;

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  farm_id: string | null;
  farm_name: string | null;
  location: string | null;
  photo_url: string | null;
  is_active: boolean;
}

interface LivestockGroup {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  facility_id: string | null;
  facility_name: string | null;
  head_count: number;
  entry_date: string;
  notes: string | null;
}

interface Animal {
  id: string;
  name: string | null;
  tag_number: string | null;
  species: string;
  breed: string | null;
  sex: string;
  facility_id: string | null;
  facility_name: string | null;
  group_id: string | null;
  group_name: string | null;
  birth_date: string | null;
  entry_date: string;
  photo_url: string | null;
  notes: string | null;
  status: string;
}

interface LivestockRecord {
  id: string;
  record_type: RecordType;
  category: string;
  title: string;
  event_date: string;
  animal_id: string | null;
  animal_name: string | null;
  group_id: string | null;
  group_name: string | null;
  facility_id: string | null;
  facility_name: string | null;
  quantity: string | number | null;
  unit: string | null;
  amount_fcfa: number;
  finance_transaction_created: boolean;
  next_due_date: string | null;
  is_resolved: boolean;
  notes: string | null;
}

interface CareReminder {
  id: string;
  title: string;
  due_date: string;
  animal_name: string | null;
  group_name: string | null;
  category: string;
  overdue: boolean;
}

interface LivestockOverview {
  animal_count: number;
  female_animal_count: number;
  male_animal_count: number;
  species_count: number;
  group_count: number;
  group_head_count: number;
  facility_count: number;
  health_record_count: number;
  health_follow_up_count: number;
  upcoming_care_count: number;
  care_due_soon_count: number;
  production_month_count: number;
  production_month_totals: Array<{ quantity: string | number; unit: string | null }>;
  reproduction_month_count: number;
  reproduction_month_totals: Array<{ quantity: string | number; unit: string | null }>;
  feed_month_count: number;
  feed_month_totals: Array<{ quantity: string | number; unit: string | null }>;
  feed_month_cost_fcfa: number;
  upcoming_care: CareReminder[];
}

interface LivestockFinanceTransaction {
  id: string;
  transaction_type: "income" | "expense";
  category: string;
  label: string;
  amount_fcfa: number;
  transaction_date: string;
  animal_name: string | null;
  group_name: string | null;
  facility_name: string | null;
  quantity: string | number | null;
  unit: string | null;
  notes: string | null;
}

interface LivestockFinancePage {
  items: LivestockFinanceTransaction[];
  total: number;
}

interface LivestockFinanceSummary {
  year: number;
  income_fcfa: number;
  expenses_fcfa: number;
  balance_fcfa: number;
  monthly_income: Array<{ month: string; month_number: number; amount_fcfa: number }>;
  monthly_expenses: Array<{ month: string; month_number: number; amount_fcfa: number }>;
}

interface Farm {
  id: string;
  name: string;
}

const noAnimals: Animal[] = [];
const noGroups: LivestockGroup[] = [];

const tabs: Array<{ id: LivestockTab; label: string; icon: typeof Activity }> = [
  { id: "animals", label: "Animaux", icon: Activity },
  { id: "groups", label: "Lots & bâtiments", icon: Wheat },
  { id: "care", label: "Santé & soins", icon: HeartPulse },
  { id: "production", label: "Productions & alimentation", icon: Milk },
  { id: "finance", label: "Finances", icon: CircleDollarSign },
  { id: "reports", label: "Rapports", icon: BarChart3 },
];

const recordLabels: Record<RecordType, string> = {
  health: "Santé / soin",
  reproduction: "Reproduction",
  production: "Production",
  feed: "Alimentation",
};

const facilityLabels: Record<string, string> = {
  barn: "Étable",
  coop: "Poulailler",
  pasture: "Pâturage",
  pen: "Enclos",
  other: "Autre bâtiment",
};

const financeCategories: Record<string, string> = {
  input: "Alimentation",
  health: "Santé",
  feed: "Alimentation",
  production: "Production",
  reproduction: "Reproduction",
  sale: "Vente",
  other: "Autre",
};

const monthLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="auth-field"><span>{label}</span>{children}</label>;
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p className={feedback.kind === "error" ? "auth-error" : "admin-success"} role={feedback.kind === "error" ? "alert" : "status"}>
      {feedback.message}
    </p>
  );
}

function closeFormDisclosure(form: HTMLFormElement) {
  const disclosure = form.closest("details");
  if (disclosure) disclosure.open = false;
}

function SummaryCards({
  label,
  metrics,
}: {
  label: string;
  metrics: Array<{ label: string; value: string; detail: string; icon: ReactNode }>;
}) {
  return (
    <div className="livestock-tab-summary" aria-label={label}>
      {metrics.map((metric) => (
        <article className="panel livestock-tab-summary-card" key={metric.label}>
          <span className="livestock-tab-summary-icon">{metric.icon}</span>
          <span className="livestock-tab-summary-label">{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.detail}</small>
        </article>
      ))}
    </div>
  );
}

function LivestockPhoto({
  photoUrl,
  alt,
  organizationId,
  className,
}: {
  photoUrl: string | null;
  alt: string;
  organizationId: string;
  className: string;
}) {
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!photoUrl) return;
    void apiBlobRequest(photoUrl, { headers: { "X-Organization-ID": organizationId } })
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setPhoto({ path: photoUrl, url: objectUrl });
        }
      })
      .catch(() => {
        if (active) setPhoto(null);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [organizationId, photoUrl]);

  if (photoUrl && photo?.path === photoUrl) {
    return <Image className={className} src={photo.url} alt={alt} width={640} height={420} unoptimized />;
  }
  return (
    <div className={`${className} livestock-photo-placeholder`} role="img" aria-label={`${alt} — photo indisponible`}>
      <Sprout size={34} strokeWidth={1.4} /><span>Ajouter une photo</span>
    </div>
  );
}

function todayInput(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function formatSummaryQuantity(totals: Array<{ quantity: string | number; unit: string | null }>): string {
  if (!totals.length) return "0";
  return totals
    .map(({ quantity, unit }) => (
      `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(quantity))} ${unit || "unités"}`
    ))
    .join(" · ");
}

function formatCount(value: number | undefined, isLoading: boolean, isError: boolean): string {
  if (isLoading) return "…";
  if (isError || value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function LivestockPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<LivestockTab>("animals");
  const [animalSearch, setAnimalSearch] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [recordType, setRecordType] = useState<RecordType>("health");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [financeYear, setFinanceYear] = useState(new Date().getFullYear());
  const [financeType, setFinanceType] = useState<FinanceFilter>("all");
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const membership = profile.data?.memberships[0];
  const organizationId = membership?.organization_id;
  const organizationHeaders = organizationId ? { "X-Organization-ID": organizationId } : undefined;
  const canManage = Boolean(
    membership && ["owner", "admin", "manager"].includes(membership.role),
  );

  const overview = useQuery({
    queryKey: ["livestock", "overview", organizationId],
    queryFn: () => apiRequest<LivestockOverview>("/livestock/overview", { headers: organizationHeaders }),
    enabled: Boolean(membership),
    retry: false,
  });
  const animals = useQuery({
    queryKey: ["livestock", "animals", organizationId, animalSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (animalSearch.trim()) params.set("search", animalSearch.trim());
      return apiRequest<Animal[]>(`/livestock/animals?${params}`, { headers: organizationHeaders });
    },
    enabled: Boolean(membership),
    retry: false,
  });
  const groups = useQuery({
    queryKey: ["livestock", "groups", organizationId],
    queryFn: () => apiRequest<LivestockGroup[]>("/livestock/groups", { headers: organizationHeaders }),
    enabled: Boolean(membership),
    retry: false,
  });
  const facilities = useQuery({
    queryKey: ["livestock", "facilities", organizationId],
    queryFn: () => apiRequest<Facility[]>("/livestock/facilities", { headers: organizationHeaders }),
    enabled: Boolean(membership),
    retry: false,
  });
  const farms = useQuery({
    queryKey: ["agriculture", "farms", organizationId, "all-active-options"],
    queryFn: () => apiRequest<{ items: Farm[] }>("/agriculture/farms?page=1&page_size=100&active=true", { headers: organizationHeaders }),
    enabled: Boolean(membership && canManage),
    retry: false,
  });
  const records = useQuery({
    queryKey: ["livestock", "records", organizationId, tab],
    queryFn: () => {
      const type = tab === "care" ? "health" : tab === "production" ? undefined : "reproduction";
      const params = new URLSearchParams({ limit: "50" });
      if (type) params.set("type", type);
      return apiRequest<LivestockRecord[]>(`/livestock/records?${params}`, { headers: organizationHeaders });
    },
    enabled: Boolean(membership && (tab === "care" || tab === "production" || tab === "groups")),
    retry: false,
  });
  const financeSummary = useQuery({
    queryKey: ["livestock", "finance-summary", organizationId, financeYear],
    queryFn: () => apiRequest<LivestockFinanceSummary>(
      `/livestock/finance/summary?year=${financeYear}`,
      { headers: organizationHeaders },
    ),
    enabled: Boolean(membership && (tab === "finance" || tab === "reports")),
    retry: false,
  });
  const financeTransactions = useQuery({
    queryKey: ["livestock", "finance-transactions", organizationId, financeYear, financeType],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", page_size: "100", year: String(financeYear) });
      if (financeType !== "all") params.set("type", financeType);
      return apiRequest<LivestockFinancePage>(
        `/livestock/finance/transactions?${params}`,
        { headers: organizationHeaders },
      );
    },
    enabled: Boolean(membership && tab === "finance"),
    retry: false,
  });
  const activeAnimals = animals.data ?? noAnimals;
  const activeGroups = groups.data ?? noGroups;
  const activeFacilities = facilities.data ?? [];
  const activeAnimalsAndGroups = useMemo(
    () => [
      ...activeAnimals.map((animal) => ({
        id: `animal:${animal.id}`,
        name: animal.name || animal.tag_number || animal.species,
        species: animal.species,
      })),
      ...activeGroups.map((group) => ({
        id: `group:${group.id}`,
        name: `${group.name} (${group.head_count})`,
        species: group.species,
      })),
    ],
    [activeAnimals, activeGroups],
  );
  const report = financeSummary.data;
  const maximumMonthlyAmount = Math.max(
    ...(report?.monthly_income.map((item) => item.amount_fcfa) ?? []),
    ...(report?.monthly_expenses.map((item) => item.amount_fcfa) ?? []),
    1,
  );

  async function refreshLivestock() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["livestock"] }),
      queryClient.invalidateQueries({ queryKey: ["agriculture", "finance"] }),
      queryClient.invalidateQueries({ queryKey: ["agriculture", "finance-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] }),
    ]);
  }

  async function handleAnimalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSubmitting("animal");
    const form = event.currentTarget;
    const data = new FormData(form);
    const photo = data.get("photo");
    try {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      if (photo instanceof File && photo.size > 5 * 1024 * 1024) throw new Error("La photo ne doit pas dépasser 5 Mo.");
      const animal = await apiRequest<Animal>("/livestock/animals", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify({
          name: data.get("name") || null,
          tag_number: data.get("tag_number") || null,
          species: data.get("species"),
          breed: data.get("breed") || null,
          sex: data.get("sex"),
          facility_id: data.get("facility_id") || null,
          group_id: data.get("group_id") || null,
          birth_date: data.get("birth_date") || null,
          entry_date: data.get("entry_date"),
          notes: data.get("notes") || null,
        }),
      });
      let photoWarning = "";
      if (photo instanceof File && photo.size > 0) {
        try {
          const upload = new FormData();
          upload.set("photo", photo);
          await apiRequest<Animal>(`/livestock/animals/${animal.id}/photo`, {
            method: "POST",
            headers: organizationHeaders,
            body: upload,
          });
        } catch (error) {
          photoWarning = ` L’animal est ajouté, mais la photo n’a pas pu être enregistrée : ${getApiErrorMessage(error)}`;
        }
      }
      form.reset();
      closeFormDisclosure(form);
      await refreshLivestock();
      setFeedback({
        kind: photoWarning ? "error" : "success",
        message: `Animal « ${animal.name || animal.tag_number || animal.species} » ajouté.${photoWarning}`,
      });
    } catch (error) {
      setFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setSubmitting(null);
    }
  }

  async function handleGroupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSubmitting("group");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const group = await apiRequest<LivestockGroup>("/livestock/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify({
          name: data.get("name"),
          species: data.get("species"),
          breed: data.get("breed") || null,
          facility_id: data.get("facility_id") || null,
          head_count: Number(data.get("head_count")),
          entry_date: data.get("entry_date"),
          notes: data.get("notes") || null,
        }),
      });
      form.reset();
      closeFormDisclosure(form);
      await refreshLivestock();
      setFeedback({ kind: "success", message: `Lot « ${group.name} » ajouté (${group.head_count} têtes).` });
    } catch (error) {
      setFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setSubmitting(null);
    }
  }

  async function handleFacilitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSubmitting("facility");
    const form = event.currentTarget;
    const data = new FormData(form);
    const photo = data.get("photo");
    try {
      if (photo instanceof File && photo.size > 5 * 1024 * 1024) throw new Error("La photo ne doit pas dépasser 5 Mo.");
      const facility = await apiRequest<Facility>("/livestock/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify({
          name: data.get("name"),
          facility_type: data.get("facility_type"),
          farm_id: data.get("farm_id") || null,
          location: data.get("location") || null,
        }),
      });
      let photoWarning = "";
      if (photo instanceof File && photo.size > 0) {
        try {
          const upload = new FormData();
          upload.set("photo", photo);
          await apiRequest<Facility>(`/livestock/facilities/${facility.id}/photo`, {
            method: "POST",
            headers: organizationHeaders,
            body: upload,
          });
        } catch (error) {
          photoWarning = ` Le bâtiment est ajouté, mais la photo n’a pas pu être enregistrée : ${getApiErrorMessage(error)}`;
        }
      }
      form.reset();
      closeFormDisclosure(form);
      await refreshLivestock();
      setFeedback({
        kind: photoWarning ? "error" : "success",
        message: `Bâtiment « ${facility.name} » ajouté.${photoWarning}`,
      });
    } catch (error) {
      setFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setSubmitting(null);
    }
  }

  async function handleRecordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSubmitting("record");
    const form = event.currentTarget;
    const data = new FormData(form);
    const subjectValue = String(data.get("subject") ?? "");
    const [subjectType, subjectId] = subjectValue.split(":");
    try {
      const record = await apiRequest<LivestockRecord>("/livestock/records", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify({
          record_type: recordType,
          category: data.get("category"),
          title: data.get("title"),
          event_date: data.get("event_date"),
          animal_id: subjectType === "animal" ? subjectId : null,
          group_id: subjectType === "group" ? subjectId : null,
          quantity: data.get("quantity") ? Number(data.get("quantity")) : null,
          unit: data.get("unit") || null,
          amount_fcfa: Number(data.get("amount_fcfa") || 0),
          next_due_date: data.get("next_due_date") || null,
          notes: data.get("notes") || null,
        }),
      });
      form.reset();
      closeFormDisclosure(form);
      await refreshLivestock();
      setFeedback({
        kind: "success",
        message: record.finance_transaction_created
          ? `${recordType === "production" ? "Production enregistrée et recette ajoutée" : "Opération enregistrée et dépense ajoutée"} aux Finances de l’élevage.`
          : `${recordLabels[recordType]} enregistré.`,
      });
    } catch (error) {
      setFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setSubmitting(null);
    }
  }

  async function handleFinanceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSubmitting("finance");
    const form = event.currentTarget;
    const data = new FormData(form);
    const subject = String(data.get("subject") ?? "");
    const [subjectType, subjectId] = subject.split(":");
    try {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      await apiRequest<LivestockFinanceTransaction>("/livestock/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify({
          transaction_type: data.get("transaction_type"),
          category: data.get("category"),
          label: data.get("label"),
          amount_fcfa: Number(data.get("amount_fcfa")),
          transaction_date: data.get("transaction_date"),
          animal_id: subjectType === "animal" ? subjectId : null,
          group_id: subjectType === "group" ? subjectId : null,
          facility_id: subjectType === "facility" ? subjectId : null,
          quantity: data.get("quantity") ? Number(data.get("quantity")) : null,
          unit: data.get("unit") || null,
          notes: data.get("notes") || null,
        }),
      });
      form.reset();
      closeFormDisclosure(form);
      await refreshLivestock();
      setFeedback({ kind: "success", message: "Mouvement financier enregistré." });
    } catch (error) {
      setFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setSubmitting(null);
    }
  }

  async function updateAnimalStatus(animal: Animal, status: "sold" | "deceased") {
    setFeedback(null);
    setSubmitting(animal.id);
    try {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      await apiRequest<Animal>(
        `/livestock/animals/${animal.id}/status?status=${status}`,
        { method: "PATCH", headers: organizationHeaders },
      );
      await refreshLivestock();
      setFeedback({ kind: "success", message: `${animal.name || animal.tag_number || animal.species} marqué comme ${status === "sold" ? "vendu" : "décédé"}.` });
    } catch (error) {
      setFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setSubmitting(null);
    }
  }

  async function resolveCare(reminderId: string) {
    setFeedback(null);
    setSubmitting(reminderId);
    try {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      await apiRequest<LivestockRecord>(`/livestock/records/${reminderId}/resolve`, {
        method: "PATCH",
        headers: organizationHeaders,
      });
      await refreshLivestock();
      setFeedback({ kind: "success", message: "Le soin est marqué comme effectué." });
    } catch (error) {
      setFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setSubmitting(null);
    }
  }

  const currentRecords = records.data ?? [];
  const error = overview.error ?? animals.error ?? groups.error ?? facilities.error ?? farms.error ?? records.error
    ?? ((tab === "finance" || tab === "reports") ? financeSummary.error : null)
    ?? (tab === "finance" ? financeTransactions.error : null);

  return (
    <div className="livestock-workspace">
      <section className="livestock-hero">
        <div>
          <p className="eyebrow">Votre élevage, simplement</p>
          <h1>Élevage</h1>
          <p>Animaux, santé, productions et bâtiments réunis dans un même espace.</p>
        </div>
        <div className="livestock-hero-mark" aria-hidden="true"><Activity size={52} strokeWidth={1.1} /></div>
        <div className="livestock-hero-stats">
          <span><strong>{overview.data?.animal_count ?? "—"}</strong> animaux</span>
          <span><strong>{overview.data?.group_count ?? "—"}</strong> lots</span>
          <span><strong>{overview.data?.facility_count ?? "—"}</strong> bâtiments</span>
        </div>
      </section>

      {error ? (
        <div className="dashboard-error" role="alert">
          <p>{getApiErrorMessage(error)}</p>
          <button className="button-secondary" type="button" onClick={() => void refreshLivestock()}>Réessayer</button>
        </div>
      ) : null}

      <div className="livestock-toolbar">
        <div className="livestock-tabs" role="tablist" aria-label="Sections de l'élevage">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} id={`livestock-tab-${id}`} className="livestock-tab" type="button" role="tab" aria-selected={tab === id} aria-controls={`livestock-panel-${id}`} onClick={() => { setTab(id); setFeedback(null); }}>
              <Icon size={16} /><span>{label}</span>
            </button>
          ))}
        </div>
        {tab === "animals" ? (
          <label className="sales-search"><Search size={15} /><span className="visually-hidden">Rechercher un animal</span><input type="search" value={animalSearch} placeholder="Nom, numéro, espèce…" onChange={(event) => setAnimalSearch(event.target.value)} /></label>
        ) : null}
      </div>

      <FeedbackMessage feedback={feedback} />

      {tab === "finance" ? (
        <section id="livestock-panel-finance" className="livestock-panel-content" role="tabpanel" aria-labelledby="livestock-tab-finance">
          <div className="livestock-subsection-heading livestock-finance-heading">
            <div><h2>Finances de l’élevage</h2><p>Recettes et dépenses liées aux animaux, aux lots et aux bâtiments.</p></div>
            <label className="year-select-label"><span>Exercice</span><select className="select-compact" value={financeYear} onChange={(event) => setFinanceYear(Number(event.target.value))}>{Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          </div>
          {report ? (
            <div className="finance-summary-grid">
              <article className="finance-summary-card"><span>Recettes</span><strong>{formatFcfa(report.income_fcfa)}</strong><small>Productions et ventes</small><span className="finance-icon income"><ArrowDownLeft size={17} /></span></article>
              <article className="finance-summary-card"><span>Dépenses</span><strong>{formatFcfa(report.expenses_fcfa)}</strong><small>Soins, alimentation et charges</small><span className="finance-icon expense"><ArrowUpRight size={17} /></span></article>
              <article className="finance-summary-card"><span>Solde</span><strong className={report.balance_fcfa >= 0 ? "positive-value" : "negative-value"}>{formatFcfa(report.balance_fcfa)}</strong><small>Recettes moins dépenses</small><span className="finance-icon balance"><CircleDollarSign size={17} /></span></article>
            </div>
          ) : financeSummary.isPending ? <div className="dashboard-loading" role="status">Calcul des mouvements…</div> : null}
          {canManage ? (
            <details className="panel finance-entry-panel livestock-create-card">
              <summary><span className="agriculture-add-icon"><Plus size={17} /></span><span><strong>Saisir un mouvement</strong><small>Ajouter une recette ou une dépense à l’élevage</small></span><ChevronRight size={16} /></summary>
              <form className="livestock-form-grid livestock-finance-form" onSubmit={(event) => void handleFinanceSubmit(event)}>
                <Field label="Type"><select name="transaction_type"><option value="expense">Dépense</option><option value="income">Recette</option></select></Field>
                <Field label="Catégorie"><select name="category"><option value="feed">Alimentation</option><option value="health">Santé / soins</option><option value="production">Production</option><option value="reproduction">Reproduction</option><option value="sale">Vente d’animaux</option><option value="other">Autre</option></select></Field>
                <Field label="Animal, lot ou bâtiment (facultatif)"><select defaultValue="" name="subject"><option value="">Aucun rattachement</option>{activeAnimals.map((animal) => <option key={animal.id} value={`animal:${animal.id}`}>{animal.name || animal.tag_number || animal.species} · {animal.species}</option>)}{activeGroups.map((group) => <option key={group.id} value={`group:${group.id}`}>{group.name} · lot</option>)}{activeFacilities.map((facility) => <option key={facility.id} value={`facility:${facility.id}`}>{facility.name} · bâtiment</option>)}</select></Field>
                <Field label="Libellé"><input maxLength={160} minLength={2} name="label" placeholder="Ex. Achat d’aliment" required /></Field>
                <Field label="Montant (FCFA)"><input min="1" name="amount_fcfa" placeholder="25000" required type="number" /></Field>
                <Field label="Date"><input defaultValue={todayInput()} name="transaction_date" required type="date" /></Field>
                <Field label="Quantité (facultatif)"><input min="0.001" name="quantity" placeholder="25" step="0.001" type="number" /></Field>
                <Field label="Unité"><MeasurementUnitSelect includeEmpty name="unit" /></Field>
                <Field label="Notes"><input maxLength={2000} name="notes" placeholder="Précisions complémentaires" /></Field>
                <button className="button-primary" disabled={submitting === "finance"} type="submit">{submitting === "finance" ? "Enregistrement…" : "Enregistrer le mouvement"}</button>
              </form>
            </details>
          ) : null}
          <section className="panel agriculture-data-panel">
            <div className="agriculture-section-heading">
              <div><h2>Journal financier</h2><p>{financeTransactions.data?.total ?? 0} mouvement(s) sur {financeYear}</p></div>
              <label className="sales-filter-label"><span className="visually-hidden">Filtrer les opérations</span><select className="select-compact" value={financeType} onChange={(event) => setFinanceType(event.target.value as FinanceFilter)}><option value="all">Recettes et dépenses</option><option value="income">Recettes</option><option value="expense">Dépenses</option></select></label>
            </div>
            {financeTransactions.isPending ? <div className="dashboard-loading" role="status">Chargement du journal…</div> : financeTransactions.isError ? <div className="dashboard-error" role="alert"><p>{getApiErrorMessage(financeTransactions.error)}</p></div> : financeTransactions.data?.items.length ? (
              <div className="table-wrap"><table className="data-table agriculture-table"><thead><tr><th scope="col">DATE</th><th scope="col">LIBELLÉ</th><th scope="col">ANIMAL / LOT / BÂTIMENT</th><th scope="col">CATÉGORIE</th><th scope="col">MONTANT</th></tr></thead><tbody>{financeTransactions.data.items.map((item) => <tr key={item.id}><td>{formatDate(item.transaction_date)}</td><td className="table-primary">{item.label}{item.quantity ? <small className="table-subtext">{item.quantity} {item.unit}</small> : null}</td><td>{item.animal_name || item.group_name || item.facility_name || "Élevage"}{item.facility_name && item.animal_name ? <small className="table-subtext">{item.facility_name}</small> : null}</td><td>{financeCategories[item.category] ?? item.category}</td><td className={item.transaction_type === "income" ? "finance-amount-income" : "finance-amount-expense"}>{item.transaction_type === "income" ? "+" : "−"} {formatFcfa(item.amount_fcfa)}</td></tr>)}</tbody></table></div>
            ) : <div className="agriculture-empty compact"><p>Aucun mouvement financier pour cet exercice.</p></div>}
          </section>
        </section>
      ) : null}

      {tab === "reports" ? (
        <section id="livestock-panel-reports" className="livestock-panel-content" role="tabpanel" aria-labelledby="livestock-tab-reports">
          <div className="livestock-subsection-heading livestock-finance-heading">
            <div><h2>Rapport financier de l’élevage</h2><p>Synthèse annuelle des recettes, dépenses et résultats enregistrés.</p></div>
            <label className="year-select-label"><span>Exercice</span><select className="select-compact" value={financeYear} onChange={(event) => setFinanceYear(Number(event.target.value))}>{Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          </div>
          {report ? (
            <>
              <section className="panel report-summary-panel">
                <div className="report-title-row"><span className="agriculture-empty-icon"><BarChart3 size={21} /></span><div><h3>Synthèse élevage · {report.year}</h3><p>Calculée à partir des opérations financières enregistrées.</p></div></div>
                <div className="report-kpis livestock-report-kpis"><div><span>Recettes</span><strong>{formatFcfa(report.income_fcfa)}</strong></div><div><span>Dépenses</span><strong>{formatFcfa(report.expenses_fcfa)}</strong></div><div><span>Résultat net</span><strong className={report.balance_fcfa >= 0 ? "positive-value" : "negative-value"}>{formatFcfa(report.balance_fcfa)}</strong></div></div>
              </section>
              <section className="panel agriculture-data-panel">
                <div className="agriculture-section-heading"><div><h2>Évolution mensuelle</h2><p>Comparaison des recettes et dépenses en FCFA.</p></div></div>
                <div className="report-month-list">{monthLabels.map((month, index) => {
                  const income = report.monthly_income[index]?.amount_fcfa ?? 0;
                  const expense = report.monthly_expenses[index]?.amount_fcfa ?? 0;
                  return <div className="report-month-row" key={month}><span>{month}</span><div className="report-month-bars"><span className="report-bar-income" style={{ width: `${(income / maximumMonthlyAmount) * 100}%` }} /><span className="report-bar-expense" style={{ width: `${(expense / maximumMonthlyAmount) * 100}%` }} /></div><strong>{income ? formatFcfa(income) : "—"}</strong><small>{expense ? `− ${formatFcfa(expense)}` : "—"}</small></div>;
                })}</div>
                <div className="report-legend"><span><i className="report-bar-income" /> Recettes</span><span><i className="report-bar-expense" /> Dépenses</span></div>
              </section>
            </>
          ) : financeSummary.isPending ? <div className="dashboard-loading" role="status">Préparation du rapport…</div> : <div className="dashboard-error" role="alert"><p>{getApiErrorMessage(financeSummary.error)}</p></div>}
        </section>
      ) : null}

      {tab === "animals" ? (
        <section id="livestock-panel-animals" className="livestock-panel-content" role="tabpanel" aria-labelledby="livestock-tab-animals">
          <SummaryCards
            label="Résumé des animaux"
            metrics={[
              { label: "Animaux actifs", value: formatCount(overview.data?.animal_count, overview.isPending, overview.isError), detail: "Individus enregistrés", icon: <Activity size={17} /> },
              { label: "Femelles", value: formatCount(overview.data?.female_animal_count, overview.isPending, overview.isError), detail: "Dans les animaux actifs", icon: <HeartPulse size={17} /> },
              { label: "Mâles", value: formatCount(overview.data?.male_animal_count, overview.isPending, overview.isError), detail: "Dans les animaux actifs", icon: <Activity size={17} /> },
              { label: "Espèces", value: formatCount(overview.data?.species_count, overview.isPending, overview.isError), detail: "Représentées dans le cheptel", icon: <Sprout size={17} /> },
            ]}
          />
          {canManage ? (
            <details className="panel livestock-create-card">
              <summary><span className="agriculture-add-icon"><Plus size={17} /></span><span><strong>Ajouter un animal</strong><small>Identifier une vache, une chèvre, une poule et suivre son parcours</small></span><ChevronRight size={16} /></summary>
              <form className="livestock-form-grid" onSubmit={(event) => void handleAnimalSubmit(event)}>
                <Field label="Nom"><input maxLength={120} name="name" placeholder="Ex. Nala" /></Field>
                <Field label="N° d’identification"><input maxLength={80} name="tag_number" placeholder="Ex. BOV-001" /></Field>
                <Field label="Espèce"><input list="livestock-species" maxLength={60} minLength={2} name="species" placeholder="Ex. Bovin, caprin, volaille…" required /><datalist id="livestock-species"><option value="Bovin" /><option value="Caprin" /><option value="Ovin" /><option value="Volaille" /><option value="Lapin" /></datalist></Field>
                <Field label="Race"><input maxLength={100} name="breed" placeholder="Race ou croisement" /></Field>
                <Field label="Sexe"><select name="sex" defaultValue="unknown"><option value="unknown">Non renseigné</option><option value="female">Femelle</option><option value="male">Mâle</option></select></Field>
                <Field label="Bâtiment / pâturage"><select name="facility_id" defaultValue=""><option value="">Non renseigné</option>{activeFacilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></Field>
                <Field label="Lot"><select name="group_id" defaultValue=""><option value="">Aucun lot</option>{activeGroups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.species}</option>)}</select></Field>
                <Field label="Date de naissance"><input name="birth_date" type="date" /></Field>
                <Field label="Date d’entrée"><input defaultValue={todayInput()} name="entry_date" required type="date" /></Field>
                <Field label="Notes"><input maxLength={1000} name="notes" placeholder="Observations utiles" /></Field>
                <label className="livestock-photo-upload"><ImagePlus size={18} /><span>Photo de l’animal</span><small>JPG, PNG ou WebP · 5 Mo max.</small><input accept="image/jpeg,image/png,image/webp" name="photo" type="file" /></label>
                <button className="button-primary" disabled={submitting === "animal"} type="submit">{submitting === "animal" ? "Ajout…" : "Ajouter l’animal"}</button>
              </form>
            </details>
          ) : null}
          {animals.isPending ? <div className="dashboard-loading" role="status">Chargement des animaux…</div> : activeAnimals.length ? (
            <div className="livestock-animal-grid">
              {activeAnimals.map((animal) => (
                <article className="panel livestock-animal-card" key={animal.id}>
                  <LivestockPhoto photoUrl={animal.photo_url} alt={animal.name || animal.species} className="livestock-animal-image" organizationId={organizationId!} />
                  <div className="livestock-animal-body">
                    <div className="livestock-animal-title"><div><p>{animal.species}{animal.breed ? ` · ${animal.breed}` : ""}</p><h2>{animal.name || animal.tag_number || animal.species}</h2></div><span className={`livestock-sex-pill livestock-sex-${animal.sex}`}>{animal.sex === "female" ? "Femelle" : animal.sex === "male" ? "Mâle" : "—"}</span></div>
                    <div className="livestock-animal-meta"><span>{animal.tag_number ? `N° ${animal.tag_number}` : "Sans identification"}</span><span>{animal.facility_name || "Sans bâtiment"}</span></div>
                    {animal.group_name ? <p className="livestock-animal-group">Lot : {animal.group_name}</p> : null}
                    {canManage ? <div className="livestock-animal-actions"><button className="text-action" type="button" disabled={submitting === animal.id} onClick={() => void updateAnimalStatus(animal, "sold")}><ArrowUpRight size={14} />Vendu</button><button className="text-action" type="button" disabled={submitting === animal.id} onClick={() => void updateAnimalStatus(animal, "deceased")}><AlertTriangle size={14} />Décès</button></div> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : !animals.isError ? <div className="panel livestock-empty"><Activity size={28} /><h2>Aucun animal pour le moment</h2><p>Ajoutez vos premiers animaux individuellement ou créez un lot de volailles.</p></div> : null}
        </section>
      ) : null}

      {tab === "groups" ? (
        <section id="livestock-panel-groups" className="livestock-panel-content" role="tabpanel" aria-labelledby="livestock-tab-groups">
          <SummaryCards
            label="Résumé des lots et bâtiments"
            metrics={[
              { label: "Lots actifs", value: formatCount(overview.data?.group_count, overview.isPending, overview.isError), detail: "Groupes d’animaux suivis", icon: <Wheat size={17} /> },
              { label: "Effectif en lots", value: formatCount(overview.data?.group_head_count, overview.isPending, overview.isError), detail: "Têtes réparties dans les lots", icon: <Activity size={17} /> },
              { label: "Bâtiments actifs", value: formatCount(overview.data?.facility_count, overview.isPending, overview.isError), detail: "Étables, enclos et pâturages", icon: <Sprout size={17} /> },
            ]}
          />
          {canManage ? (
            <div className="livestock-management-grid">
              <details className="panel livestock-create-card">
                <summary><span className="agriculture-add-icon"><Plus size={17} /></span><span><strong>Créer un lot</strong><small>Pour les poussins, poulets, chèvres ou animaux similaires</small></span><ChevronRight size={16} /></summary>
                <form className="livestock-form-grid" onSubmit={(event) => void handleGroupSubmit(event)}>
                  <Field label="Nom du lot"><input maxLength={120} minLength={2} name="name" placeholder="Ex. Poulets de chair · lot 1" required /></Field>
                  <Field label="Espèce"><input list="livestock-species" maxLength={60} minLength={2} name="species" placeholder="Ex. Volaille" required /><datalist id="livestock-species"><option value="Bovin" /><option value="Caprin" /><option value="Ovin" /><option value="Volaille" /><option value="Lapin" /></datalist></Field>
                  <Field label="Race"><input maxLength={100} name="breed" placeholder="Race ou souche" /></Field>
                  <Field label="Effectif"><input min="1" name="head_count" placeholder="50" required type="number" /></Field>
                  <Field label="Bâtiment"><select name="facility_id" defaultValue=""><option value="">Non renseigné</option>{activeFacilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></Field>
                  <Field label="Date d’entrée"><input defaultValue={todayInput()} name="entry_date" required type="date" /></Field>
                  <Field label="Notes"><input maxLength={1000} name="notes" placeholder="Âge moyen, provenance…" /></Field>
                  <button className="button-primary" disabled={submitting === "group"} type="submit">{submitting === "group" ? "Ajout…" : "Créer le lot"}</button>
                </form>
              </details>
              <details className="panel livestock-create-card">
                <summary><span className="agriculture-add-icon"><Plus size={17} /></span><span><strong>Ajouter un bâtiment</strong><small>Étable, poulailler, pâturage ou enclos</small></span><ChevronRight size={16} /></summary>
                <form className="livestock-form-grid" onSubmit={(event) => void handleFacilitySubmit(event)}>
                  <Field label="Nom"><input maxLength={120} minLength={2} name="name" placeholder="Ex. Poulailler nord" required /></Field>
                  <Field label="Type"><select defaultValue="coop" name="facility_type">{Object.entries(facilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                  <Field label="Ferme liée (facultatif)"><select defaultValue="" name="farm_id"><option value="">Aucune ferme</option>{(farms.data?.items ?? []).map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></Field>
                  <Field label="Localisation"><input maxLength={180} name="location" placeholder="Région, village…" /></Field>
                  <label className="livestock-photo-upload"><ImagePlus size={18} /><span>Photo du bâtiment</span><small>JPG, PNG ou WebP · 5 Mo max.</small><input accept="image/jpeg,image/png,image/webp" name="photo" type="file" /></label>
                  <button className="button-primary" disabled={submitting === "facility"} type="submit">{submitting === "facility" ? "Ajout…" : "Ajouter le bâtiment"}</button>
                </form>
              </details>
            </div>
          ) : null}
          <div className="livestock-subsection-heading"><h2>Vos lots</h2><p>Les effectifs et espèces de chaque groupe d’animaux.</p></div>
          {groups.isPending ? <div className="dashboard-loading" role="status">Chargement des lots…</div> : activeGroups.length ? (
            <div className="livestock-group-grid">{activeGroups.map((group) => <article className="panel livestock-group-card" key={group.id}><span className="livestock-group-icon"><Wheat size={21} /></span><div><h3>{group.name}</h3><p>{group.species}{group.breed ? ` · ${group.breed}` : ""}</p><small>{group.facility_name || "Sans bâtiment"}</small></div><strong>{group.head_count}<small> têtes</small></strong></article>)}</div>
          ) : <div className="panel livestock-empty compact"><p>Aucun lot enregistré. Créez par exemple un lot de poussins pour suivre tout le poulailler ensemble.</p></div>}
          <div className="livestock-subsection-heading"><h2>Bâtiments & pâturages</h2><p>Les lieux d’élevage peuvent être rattachés à une ferme pour relier leurs dépenses.</p></div>
          {facilities.isPending ? <div className="dashboard-loading" role="status">Chargement des bâtiments…</div> : activeFacilities.length ? (
            <div className="livestock-facility-grid">{activeFacilities.map((facility) => <article className="panel livestock-facility-card" key={facility.id}><LivestockPhoto photoUrl={facility.photo_url} alt={facility.name} className="livestock-facility-image" organizationId={organizationId!} /><div><span>{facilityLabels[facility.facility_type] || "Bâtiment"}</span><h3>{facility.name}</h3><p>{facility.location || facility.farm_name || "Localisation à renseigner"}</p>{facility.farm_name ? <small>Finances liées à {facility.farm_name}</small> : null}</div></article>)}</div>
          ) : <div className="panel livestock-empty compact"><p>Aucun bâtiment enregistré.</p></div>}
        </section>
      ) : null}

      {tab === "care" || tab === "production" ? (
        <section id={`livestock-panel-${tab}`} className="livestock-panel-content" role="tabpanel" aria-labelledby={`livestock-tab-${tab}`}>
          {tab === "care" ? (
            <SummaryCards
              label="Résumé de la santé et des soins"
              metrics={[
                { label: "Soins enregistrés", value: formatCount(overview.data?.health_record_count, overview.isPending, overview.isError), detail: "Historique santé complet", icon: <HeartPulse size={17} /> },
                { label: "En retard", value: formatCount(overview.data?.health_follow_up_count, overview.isPending, overview.isError), detail: "Contrôles ou traitements à faire", icon: <AlertTriangle size={17} /> },
                { label: "Dans les 7 jours", value: formatCount(overview.data?.care_due_soon_count, overview.isPending, overview.isError), detail: "Prochaines échéances planifiées", icon: <CalendarDays size={17} /> },
              ]}
            />
          ) : (
            <SummaryCards
              label="Résumé des productions et de l’alimentation du mois"
              metrics={[
                { label: "Productions", value: formatCount(overview.data?.production_month_count, overview.isPending, overview.isError), detail: "Relevés enregistrés ce mois", icon: <Milk size={17} /> },
                { label: "Quantités produites", value: overview.isPending ? "…" : overview.isError ? "—" : formatSummaryQuantity(overview.data?.production_month_totals ?? []), detail: "Cumul par unité ce mois", icon: <Egg size={17} /> },
                { label: "Événements reproductifs", value: formatCount(overview.data?.reproduction_month_count, overview.isPending, overview.isError), detail: "Naissances et suivis ce mois", icon: <Baby size={17} /> },
                { label: "Quantités de reproduction", value: overview.isPending ? "…" : overview.isError ? "—" : formatSummaryQuantity(overview.data?.reproduction_month_totals ?? []), detail: "Ex. petits ou œufs enregistrés", icon: <HeartPulse size={17} /> },
                { label: "Rations distribuées", value: formatCount(overview.data?.feed_month_count, overview.isPending, overview.isError), detail: "Enregistrements d’alimentation", icon: <Wheat size={17} /> },
                { label: "Quantités distribuées", value: overview.isPending ? "…" : overview.isError ? "—" : formatSummaryQuantity(overview.data?.feed_month_totals ?? []), detail: "Cumul par unité ce mois", icon: <Sprout size={17} /> },
                { label: "Coût alimentaire", value: overview.isPending ? "…" : overview.isError ? "—" : formatFcfa(overview.data?.feed_month_cost_fcfa ?? 0), detail: "Dépenses saisies ce mois", icon: <CircleDollarSign size={17} /> },
              ]}
            />
          )}
          <div className="livestock-record-layout">
            <div>
              <div className="livestock-subsection-heading"><h2>{tab === "care" ? "Journal santé & soins" : "Journal des activités"}</h2><p>{tab === "care" ? "Retrouvez les maladies, traitements, vaccinations et contrôles." : "Suivez les naissances, le lait, les œufs, la croissance et l’alimentation."}</p></div>
              {canManage && activeAnimalsAndGroups.length ? (
                <details className="panel livestock-create-card">
                  <summary><span className="agriculture-add-icon"><Plus size={17} /></span><span><strong>Enregistrer une opération</strong><small>Ajoutez un soin, une production, une naissance ou un repas</small></span><ChevronRight size={16} /></summary>
                  <form className="livestock-form-grid" onSubmit={(event) => void handleRecordSubmit(event)}>
                    <Field label="Type d’opération"><select value={recordType} onChange={(event) => setRecordType(event.target.value as RecordType)}><option value="health">Santé / soin</option><option value="reproduction">Reproduction / naissance</option><option value="production">Production</option><option value="feed">Alimentation</option></select></Field>
                    <Field label="Animal ou lot"><select name="subject" defaultValue="" required><option disabled value="">Choisir une cible</option>{activeAnimalsAndGroups.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} · {subject.species}</option>)}</select></Field>
                    <Field label={recordType === "health" ? "Type de soin" : recordType === "reproduction" ? "Type d’événement" : recordType === "production" ? "Type de production" : "Type d’aliment"}><select name="category" defaultValue={recordType === "health" ? "illness" : recordType === "reproduction" ? "birth" : recordType === "production" ? "milk" : "feed"} key={recordType}>{(recordType === "health" ? [["illness", "Maladie / symptômes"], ["treatment", "Traitement"], ["vaccination", "Vaccination"], ["checkup", "Contrôle"]] : recordType === "reproduction" ? [["birth", "Naissance / mise bas"], ["mating", "Accouplement"], ["pregnancy", "Gestation"], ["mortality", "Mortalité"]] : recordType === "production" ? [["milk", "Lait"], ["eggs", "Œufs"], ["weight", "Poids / croissance"], ["other", "Autre production"]] : [["feed", "Ration / aliment"], ["water", "Eau"], ["supplement", "Complément"]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                    <Field label={recordType === "health" ? "Maladie, soin ou produit" : recordType === "reproduction" ? "Description" : recordType === "production" ? "Description" : "Aliment distribué"}><input maxLength={120} minLength={1} name="title" placeholder={recordType === "health" ? "Ex. Vaccin Newcastle" : recordType === "reproduction" ? "Ex. Mise bas réussie" : recordType === "production" ? "Ex. Collecte du matin" : "Ex. Aliment pondeuse"} required /></Field>
                    <Field label="Date"><input defaultValue={todayInput()} name="event_date" required type="date" /></Field>
                    {recordType === "production" || recordType === "feed" || recordType === "reproduction" ? <Field label={recordType === "reproduction" ? "Nombre de petits" : "Quantité"}><input min="0.001" name="quantity" placeholder="Ex. 12" step="0.001" type="number" /></Field> : null}
                    {recordType === "production" || recordType === "feed" || recordType === "reproduction" ? <Field label="Unité"><MeasurementUnitSelect name="unit" defaultValue={recordType === "production" ? "litres" : recordType === "feed" ? "kg" : "têtes"} /></Field> : null}
                    {recordType === "health" ? <Field label="Prochain contrôle"><input name="next_due_date" type="date" /></Field> : null}
                    {recordType === "feed" || recordType === "health" || recordType === "production" ? <Field label={recordType === "production" ? "Recette (FCFA)" : "Coût (FCFA)"}><input min="0" name="amount_fcfa" placeholder="0" type="number" /></Field> : null}
                    <Field label="Notes"><input maxLength={2000} name="notes" placeholder="Observations complémentaires" /></Field>
                    <button className="button-primary" disabled={submitting === "record"} type="submit">{submitting === "record" ? "Enregistrement…" : "Enregistrer"}</button>
                  </form>
                </details>
              ) : canManage ? <div className="panel livestock-empty compact"><p>Ajoutez d’abord un animal ou un lot pour commencer le suivi.</p></div> : null}
              {tab === "production" ? <p className="livestock-stock-note">Les rations distribuées sont enregistrées ici. Le module Stocks n’est pas encore relié à l’élevage.</p> : null}
              {records.isPending ? <div className="dashboard-loading" role="status">Chargement du journal…</div> : currentRecords.length ? (
                <div className="livestock-record-list">{currentRecords.map((record) => <article className="panel livestock-record-card" key={record.id}><span className={`livestock-record-icon livestock-record-${record.record_type}`}>{record.record_type === "health" ? <Stethoscope size={18} /> : record.record_type === "reproduction" ? <Baby size={18} /> : record.record_type === "production" ? record.category === "eggs" ? <Egg size={18} /> : <Milk size={18} /> : <Wheat size={18} />}</span><div className="livestock-record-copy"><div><span>{recordLabels[record.record_type]} · {record.category}</span><time dateTime={record.event_date}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(`${record.event_date}T12:00:00`))}</time></div><h3>{record.title}</h3><p>{record.animal_name || record.group_name || "Animal / lot"}{record.facility_name ? ` · ${record.facility_name}` : ""}{record.quantity ? ` · ${record.quantity} ${record.unit || ""}` : ""}{record.amount_fcfa ? ` · ${formatFcfa(record.amount_fcfa)}` : ""}</p>{record.next_due_date ? <small className={record.next_due_date < todayInput() ? "livestock-overdue" : ""}><CalendarDays size={13} />{record.next_due_date < todayInput() ? "Échéance dépassée" : "Prochain contrôle"} : {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(`${record.next_due_date}T12:00:00`))}</small> : null}{record.notes ? <small>{record.notes}</small> : null}</div></article>)}</div>
              ) : !records.isError ? <div className="panel livestock-empty compact"><p>Aucun enregistrement pour le moment.</p></div> : null}
            </div>
            <aside className="panel livestock-reminders">
              <div className="livestock-subsection-heading"><h2>Soins à suivre</h2><p>Échéances déjà programmées</p></div>
              {overview.data?.upcoming_care.length ? overview.data.upcoming_care.map((reminder) => <div className={`livestock-reminder ${reminder.overdue ? "is-overdue" : ""}`} key={reminder.id}><span>{reminder.overdue ? <AlertTriangle size={15} /> : <Clock3 size={15} />}</span><div><strong>{reminder.title}</strong><small>{reminder.animal_name || reminder.group_name || "Animal / lot"} · {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(`${reminder.due_date}T12:00:00`))}</small>{canManage ? <button className="livestock-reminder-done" type="button" disabled={submitting === reminder.id} onClick={() => void resolveCare(reminder.id)}><Check size={13} />{submitting === reminder.id ? "Enregistrement…" : "Marquer effectué"}</button> : null}</div></div>) : <p className="livestock-reminder-empty">Aucune échéance enregistrée. Ajoutez une date de contrôle lors d’un soin.</p>}
            </aside>
          </div>
        </section>
      ) : null}
    </div>
  );
}
