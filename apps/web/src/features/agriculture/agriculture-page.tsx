"use client";

import Image from "next/image";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FlaskConical,
  ImagePlus,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sprout,
  Wheat,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  apiBlobRequest,
  apiRequest,
  getApiErrorMessage,
  type UserProfile,
} from "@/lib/api/client";
import type {
  Campaign,
  CampaignPage,
  CampaignStatus,
  Crop,
  Farm,
  FarmPage,
  FinanceSummary,
  FinanceTransaction,
  FinanceTransactionPage,
  Harvest,
  Parcel,
  ParcelPage,
} from "@/features/agriculture/agriculture-types";
import { formatDate, formatFcfa } from "@/features/sales/sales-types";

const pageSize = 100;
const tabs = [
  { id: "farms", label: "Fermes & parcelles", icon: Wheat },
  { id: "campaigns", label: "Campagnes", icon: Sprout },
  { id: "finance", label: "Finances", icon: CircleDollarSign },
  { id: "reports", label: "Rapports", icon: BarChart3 },
] as const;
type AgricultureTab = (typeof tabs)[number]["id"];
type Feedback = { kind: "success" | "error"; message: string } | null;

const campaignLabels: Record<CampaignStatus, string> = {
  planned: "Planifiée",
  simulated: "Simulée",
  active: "En cours",
  closed: "Clôturée",
  archived: "Archivée",
};

const financeCategories: Record<string, string> = {
  input: "Intrants",
  labor: "Main-d’œuvre",
  equipment: "Équipement",
  transport: "Transport",
  maintenance: "Entretien",
  commercialization: "Commercialisation",
  other: "Autre",
};

const monthLabels = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

function formattedNumber(value: string | number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(Number(value));
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p
      className={feedback.kind === "error" ? "auth-error" : "admin-success"}
      role={feedback.kind === "error" ? "alert" : "status"}
    >
      {feedback.message}
    </p>
  );
}

function PrivatePhoto({
  photoUrl,
  alt,
  className = "farm-card-image",
  organizationId,
}: {
  photoUrl: string | null;
  alt: string;
  className?: string;
  organizationId: string;
}) {
  const [loadedPhoto, setLoadedPhoto] = useState<{ url: string; objectUrl: string } | null>(null);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!photoUrl) return;
    void apiBlobRequest(photoUrl, {
      headers: { "X-Organization-ID": organizationId },
    }).then((blob) => {
      if (active) {
        objectUrl = URL.createObjectURL(blob);
        setLoadedPhoto({ url: photoUrl, objectUrl });
      }
    }).catch(() => {
      if (active) setFailedPhotoUrl(photoUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoUrl, organizationId]);

  if (photoUrl && loadedPhoto?.url === photoUrl) {
    return (
      <Image
        className={className}
        src={loadedPhoto.objectUrl}
        alt={alt}
        width={640}
        height={320}
        unoptimized
      />
    );
  }
  return (
    <div className={`${className} farm-card-image-placeholder`} role={failedPhotoUrl === photoUrl ? "img" : undefined} aria-label={failedPhotoUrl === photoUrl ? `${alt} indisponible` : undefined}>
      <Sprout size={38} strokeWidth={1.2} />
      <span>{failedPhotoUrl === photoUrl ? "Photo indisponible" : photoUrl ? "Chargement de la photo…" : "Ajouter une photo"}</span>
    </div>
  );
}

function PhotoPreviewField({
  name,
  label,
  organizationId,
  currentPhotoUrl = null,
}: {
  name: string;
  label: string;
  organizationId: string;
  currentPhotoUrl?: string | null;
}) {
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string } | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<{ path: string; url: string } | null>(null);
  const localUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!currentPhotoUrl) return;
    void apiBlobRequest(currentPhotoUrl, {
      headers: { "X-Organization-ID": organizationId },
    }).then((blob) => {
      if (active) {
        objectUrl = URL.createObjectURL(blob);
        setExistingPhoto({ path: currentPhotoUrl, url: objectUrl });
      }
    }).catch(() => {
      if (active) setExistingPhoto(null);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentPhotoUrl, organizationId]);

  useEffect(() => () => {
    if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
  }, []);

  const preview = selectedPhoto?.url
    ?? (existingPhoto?.path === currentPhotoUrl ? existingPhoto.url : null);

  return (
    <label className="farm-photo-upload photo-preview-field">
      {preview ? (
        <Image className="photo-input-preview" src={preview} alt={`Aperçu : ${label}`} width={240} height={120} unoptimized />
      ) : (
        <span className="photo-input-placeholder"><ImagePlus size={19} />{currentPhotoUrl ? "Chargement de la photo…" : "Aucune photo sélectionnée"}</span>
      )}
      <span className="photo-input-label">{label}</span>
      <small>JPG, PNG ou WebP · 5 Mo max.</small>
      <input
        accept="image/jpeg,image/png,image/webp"
        name={name}
        type="file"
        onChange={(event) => {
          if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
          const file = event.currentTarget.files?.[0];
          if (!file) {
            localUrlRef.current = null;
            setSelectedPhoto(null);
            return;
          }
          const url = URL.createObjectURL(file);
          localUrlRef.current = url;
          setSelectedPhoto({ url });
        }}
      />
    </label>
  );
}

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (value: number) => void;
}) {
  const pages = Math.ceil(total / pageSize);
  return (
    <div className="sales-pagination">
      <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} sur ${total}` : "0 résultat"}</span>
      <div>
        <button className="pagination-button" type="button" aria-label="Page précédente" disabled={page <= 1} onClick={() => onChange(Math.max(page - 1, 1))}>
          <ChevronLeft size={15} />
        </button>
        <span>Page {page} / {Math.max(pages, 1)}</span>
        <button className="pagination-button" type="button" aria-label="Page suivante" disabled={page >= pages} onClick={() => onChange(Math.min(page + 1, pages))}>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export function AgriculturePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AgricultureTab>("farms");
  const [farmFilter, setFarmFilter] = useState<"active" | "archived">("active");
  const [parcelFilter, setParcelFilter] = useState<"active" | "archived">("active");
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [parcelSearch, setParcelSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<"active" | "archived">("active");
  const [campaignPage, setCampaignPage] = useState(1);
  const [financeYear, setFinanceYear] = useState(new Date().getFullYear());
  const [financeType, setFinanceType] = useState<"all" | "income" | "expense">("all");
  const [parcelPage, setParcelPage] = useState(1);
  const [farmFeedback, setFarmFeedback] = useState<Feedback>(null);
  const [parcelFeedback, setParcelFeedback] = useState<Feedback>(null);
  const [campaignFeedback, setCampaignFeedback] = useState<Feedback>(null);
  const [financeFeedback, setFinanceFeedback] = useState<Feedback>(null);
  const [farmSubmitting, setFarmSubmitting] = useState(false);
  const [farmPhotoReset, setFarmPhotoReset] = useState(0);
  const [parcelPhotoReset, setParcelPhotoReset] = useState(0);
  const [parcelSubmitting, setParcelSubmitting] = useState(false);
  const [campaignSubmitting, setCampaignSubmitting] = useState(false);
  const [harvestSubmitting, setHarvestSubmitting] = useState(false);
  const [financeSubmitting, setFinanceSubmitting] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const deferredParcelSearch = useDeferredValue(parcelSearch.trim());
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const membership = profile.data?.memberships[0];
  const organizationId = membership?.organization_id;
  const organizationHeaders = organizationId
    ? { "X-Organization-ID": organizationId }
    : undefined;
  const canManage = Boolean(membership && membership.role !== "reader");
  const today = new Date().toISOString().slice(0, 10);

  const farms = useQuery({
    queryKey: ["agriculture", "farms", organizationId, farmFilter],
    queryFn: () =>
      apiRequest<FarmPage>(`/agriculture/farms?page=1&page_size=${pageSize}&active=${farmFilter === "active"}`, {
        headers: organizationHeaders,
      }),
    enabled: Boolean(membership),
    retry: false,
  });
  const activeFarmOptions = useQuery({
    queryKey: ["agriculture", "farms", organizationId, "all-active-options"],
    queryFn: () =>
      apiRequest<FarmPage>("/agriculture/farms?page=1&page_size=100&active=true", {
        headers: organizationHeaders,
      }),
    enabled: Boolean(membership),
    retry: false,
  });
  const crops = useQuery({
    queryKey: ["agriculture", "crops", organizationId],
    queryFn: () => apiRequest<Crop[]>("/agriculture/crops", { headers: organizationHeaders }),
    enabled: Boolean(membership),
    retry: false,
  });
  const parcels = useQuery({
    queryKey: ["agriculture", "parcels", organizationId, selectedFarmId, parcelFilter, deferredParcelSearch, parcelPage],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(parcelPage), page_size: "20" });
      if (selectedFarmId) params.set("farm_id", selectedFarmId);
      params.set("active", String(parcelFilter === "active"));
      if (deferredParcelSearch) params.set("search", deferredParcelSearch);
      return apiRequest<ParcelPage>(`/agriculture/parcels?${params}`, {
        headers: organizationHeaders,
      });
    },
    enabled: Boolean(membership),
    retry: false,
  });
  const campaignStatus = campaignFilter === "archived" ? "archived" : undefined;
  const campaigns = useQuery({
    queryKey: ["agriculture", "campaigns", organizationId, campaignFilter, selectedFarmId, campaignPage],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(campaignPage), page_size: String(pageSize) });
      params.set("archived", String(campaignFilter === "archived"));
      if (campaignStatus) params.set("status", campaignStatus);
      if (selectedFarmId) params.set("farm_id", selectedFarmId);
      return apiRequest<CampaignPage>(`/agriculture/campaigns?${params}`, {
        headers: organizationHeaders,
      });
    },
    enabled: Boolean(membership),
    retry: false,
  });
  const campaignOptions = useQuery({
    queryKey: ["agriculture", "campaigns", organizationId, "active-options", selectedFarmId],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", page_size: "100" });
      if (selectedFarmId) params.set("farm_id", selectedFarmId);
      return apiRequest<CampaignPage>(`/agriculture/campaigns?${params}`, {
        headers: organizationHeaders,
      });
    },
    enabled: Boolean(membership),
    retry: false,
  });
  const financeSummary = useQuery({
    queryKey: ["agriculture", "finance-summary", organizationId, financeYear, selectedFarmId],
    queryFn: () => {
      const params = new URLSearchParams({ year: String(financeYear) });
      if (selectedFarmId) params.set("farm_id", selectedFarmId);
      return apiRequest<FinanceSummary>(`/agriculture/finance/summary?${params}`, {
        headers: organizationHeaders,
      });
    },
    enabled: Boolean(membership),
    retry: false,
  });
  const transactions = useQuery({
    queryKey: ["agriculture", "finance", organizationId, financeYear, financeType, selectedFarmId],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", page_size: String(pageSize), year: String(financeYear) });
      if (financeType !== "all") params.set("type", financeType);
      if (selectedFarmId) params.set("farm_id", selectedFarmId);
      return apiRequest<FinanceTransactionPage>(`/agriculture/finance/transactions?${params}`, {
        headers: organizationHeaders,
      });
    },
    enabled: Boolean(membership),
    retry: false,
  });
  const activeCampaignOptions = (campaignOptions.data?.items ?? []).filter(
    (campaign) => campaign.status === "active",
  );
  const selectedFarm = [...(farms.data?.items ?? []), ...(activeFarmOptions.data?.items ?? [])]
    .find((farm) => farm.id === selectedFarmId);
  const report = financeSummary.data;

  async function refreshAgriculture() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["agriculture"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] }),
    ]);
  }

  async function handleFarmSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFarmFeedback(null);
    setFarmSubmitting(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 5 * 1024 * 1024) {
      setFarmFeedback({ kind: "error", message: "La photo ne doit pas dépasser 5 Mo." });
      setFarmSubmitting(false);
      return;
    }
    if (!(photo instanceof File) || photo.size === 0) formData.delete("photo");
    try {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      const farm = await apiRequest<Farm>("/agriculture/farms", {
        method: "POST",
        headers: { "X-Organization-ID": organizationId },
        body: formData,
      });
      form.reset();
      setFarmPhotoReset((value) => value + 1);
      setFarmFilter("active");
      setSelectedFarmId(farm.id);
      await refreshAgriculture();
      setFarmFeedback({ kind: "success", message: `La ferme « ${farm.name} » est créée.` });
    } catch (error) {
      setFarmFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setFarmSubmitting(false);
    }
  }

  async function handleParcelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParcelFeedback(null);
    setParcelSubmitting(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      const photo = data.get("photo");
      if (photo instanceof File && photo.size > 5 * 1024 * 1024) {
        throw new Error("La photo ne doit pas dépasser 5 Mo.");
      }
      const parcel = await apiRequest<Parcel>("/agriculture/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify({
          farm_id: data.get("farm_id"),
          crop_id: data.get("crop_id"),
          name: data.get("name"),
          area_hectares: Number(data.get("area_hectares")),
        }),
      });
      let photoWarning = "";
      if (photo instanceof File && photo.size > 0) {
        try {
          const photoData = new FormData();
          photoData.set("photo", photo);
          await apiRequest<Parcel>(`/agriculture/parcels/${parcel.id}/photo`, {
            method: "POST",
            headers: organizationHeaders,
            body: photoData,
          });
        } catch (error) {
          photoWarning = ` La parcelle est créée, mais la photo n’a pas pu être enregistrée : ${getApiErrorMessage(error)}`;
        }
      }
      form.reset();
      setParcelPhotoReset((value) => value + 1);
      setParcelPage(1);
      await refreshAgriculture();
      setParcelFeedback({
        kind: photoWarning ? "error" : "success",
        message: `Parcelle « ${parcel.name} » ajoutée à la ferme.${photoWarning}`,
      });
    } catch (error) {
      setParcelFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setParcelSubmitting(false);
    }
  }

  async function handleCropSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParcelFeedback(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const crop = await apiRequest<Crop>("/agriculture/crops", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify({ name: data.get("crop_name") }),
      });
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["agriculture", "crops"] });
      setParcelFeedback({ kind: "success", message: `Culture « ${crop.name} » ajoutée au catalogue.` });
    } catch (error) {
      setParcelFeedback({ kind: "error", message: getApiErrorMessage(error) });
    }
  }

  async function handleCampaignSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCampaignFeedback(null);
    setCampaignSubmitting(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const campaign = await apiRequest<Campaign>("/agriculture/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify({
          parcel_id: data.get("parcel_id"),
          crop_id: parcels.data?.items.find((parcel) => parcel.id === data.get("parcel_id"))?.crop_id,
          name: data.get("name"),
          season: data.get("season"),
          start_date: data.get("start_date"),
          expected_harvest_date: data.get("expected_harvest_date"),
          area_hectares: Number(data.get("area_hectares")),
          expected_yield_kg_per_hectare: Number(data.get("yield")),
          expected_price_fcfa_per_kg: Number(data.get("price")),
          estimated_input_cost_fcfa: Number(data.get("input_cost")),
          estimated_other_cost_fcfa: Number(data.get("other_cost")),
        }),
      });
      form.reset();
      await refreshAgriculture();
      setCampaignFeedback({ kind: "success", message: `Campagne « ${campaign.name} » planifiée.` });
    } catch (error) {
      setCampaignFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setCampaignSubmitting(false);
    }
  }

  async function campaignAction(campaign: Campaign, action: "simulate" | "start" | "close" | "archive") {
    setCampaignFeedback(null);
    setActionPending(`${campaign.id}:${action}`);
    try {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      if (action === "simulate") {
        const simulation = await apiRequest<{ estimated_margin_fcfa: number }>(
          `/agriculture/campaigns/${campaign.id}/simulate`,
          { method: "POST", headers: { "X-Organization-ID": organizationId } },
        );
        setCampaignFeedback({
          kind: "success",
          message: `Simulation terminée : marge prévisionnelle ${formatFcfa(simulation.estimated_margin_fcfa)}.`,
        });
      } else {
        const updated = await apiRequest<Campaign>(
          `/agriculture/campaigns/${campaign.id}/${action}`,
          { method: "PATCH", headers: { "X-Organization-ID": organizationId } },
        );
        setCampaignFeedback({
          kind: "success",
          message: `Campagne « ${updated.name} » ${action === "start" ? "lancée" : action === "close" ? "clôturée" : "archivée"}.`,
        });
      }
      if (action === "archive") setCampaignPage(1);
      await refreshAgriculture();
    } catch (error) {
      setCampaignFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setActionPending(null);
    }
  }

  async function handleHarvestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCampaignFeedback(null);
    setHarvestSubmitting(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const harvest = await apiRequest<Harvest>("/agriculture/harvests", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify({
        parcel_id: campaignOptions.data?.items.find(
          (campaign) => campaign.id === data.get("campaign_id"),
        )?.parcel_id,
        campaign_id: data.get("campaign_id"),
          harvest_date: data.get("harvest_date"),
          quantity_kg: Number(data.get("quantity_kg")),
          notes: data.get("notes") || null,
        }),
      });
      form.reset();
      await refreshAgriculture();
      setCampaignFeedback({
        kind: "success",
        message: `${formattedNumber(harvest.quantity_kg)} kg de ${harvest.crop} enregistrés.`,
      });
    } catch (error) {
      setCampaignFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setHarvestSubmitting(false);
    }
  }

  async function handleSaleSubmit(event: FormEvent<HTMLFormElement>, campaign: Campaign) {
    event.preventDefault();
    setCampaignFeedback(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const sale = await apiRequest<FinanceTransaction>(
        `/agriculture/campaigns/${campaign.id}/sales`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...organizationHeaders },
          body: JSON.stringify({
            customer_name: data.get("customer_name"),
            quantity_kg: Number(data.get("quantity_kg")),
            unit_price_fcfa_per_kg: Number(data.get("unit_price")),
            transaction_date: data.get("transaction_date"),
            notes: data.get("notes") || null,
          }),
        },
      );
      form.reset();
      await refreshAgriculture();
      setCampaignFeedback({
        kind: "success",
        message: `Vente enregistrée : ${formatFcfa(sale.amount_fcfa)}.`,
      });
    } catch (error) {
      setCampaignFeedback({ kind: "error", message: getApiErrorMessage(error) });
    }
  }

  async function handleFinanceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFinanceFeedback(null);
    setFinanceSubmitting(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const transaction = await apiRequest<FinanceTransaction>(
        "/agriculture/finance/transactions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...organizationHeaders },
          body: JSON.stringify({
            farm_id: data.get("farm_id"),
            campaign_id: data.get("campaign_id") || null,
            transaction_type: data.get("transaction_type"),
            category: data.get("category"),
            label: data.get("label"),
            amount_fcfa: Number(data.get("amount_fcfa")),
            transaction_date: data.get("transaction_date"),
            quantity: data.get("quantity") ? Number(data.get("quantity")) : null,
            unit: data.get("unit") || null,
            notes: data.get("notes") || null,
          }),
        },
      );
      form.reset();
      await refreshAgriculture();
      setFinanceFeedback({
        kind: "success",
        message: `${transaction.transaction_type === "income" ? "Recette" : "Dépense"} de ${formatFcfa(transaction.amount_fcfa)} enregistrée.`,
      });
    } catch (error) {
      setFinanceFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setFinanceSubmitting(false);
    }
  }

  async function farmAction(farm: Farm, action: "archive" | "restore") {
    setFarmFeedback(null);
    setActionPending(`${farm.id}:${action}`);
    try {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      const updated = await apiRequest<Farm>(`/agriculture/farms/${farm.id}/${action}`, {
        method: "PATCH",
        headers: { "X-Organization-ID": organizationId },
      });
      if (action === "archive" && selectedFarmId === farm.id) setSelectedFarmId("");
      if (action === "restore") setSelectedFarmId(updated.id);
      await refreshAgriculture();
      setFarmFeedback({
        kind: "success",
        message: action === "archive" ? `Ferme « ${farm.name} » archivée.` : `Ferme « ${farm.name} » restaurée.`,
      });
    } catch (error) {
      setFarmFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setActionPending(null);
    }
  }

  async function handleFarmUpdateSubmit(
    event: FormEvent<HTMLFormElement>,
    farm: Farm,
  ) {
    event.preventDefault();
    setFarmFeedback(null);
    setActionPending(`${farm.id}:edit`);
    const form = event.currentTarget;
    const data = new FormData(form);
    const photo = data.get("photo");
    if (photo instanceof File && photo.size > 5 * 1024 * 1024) {
      setFarmFeedback({ kind: "error", message: "La photo ne doit pas dépasser 5 Mo." });
      setActionPending(null);
      return;
    }
    if (!(photo instanceof File) || photo.size === 0) data.delete("photo");
    try {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      const updated = await apiRequest<Farm>(`/agriculture/farms/${farm.id}`, {
        method: "PATCH",
        headers: organizationHeaders,
        body: data,
      });
      form.reset();
      setFarmPhotoReset((value) => value + 1);
      await refreshAgriculture();
      setFarmFeedback({ kind: "success", message: `Ferme « ${updated.name} » mise à jour.` });
      form.closest("details")?.removeAttribute("open");
    } catch (error) {
      setFarmFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setActionPending(null);
    }
  }

  async function handleParcelUpdateSubmit(
    event: FormEvent<HTMLFormElement>,
    parcel: Parcel,
  ) {
    event.preventDefault();
    setParcelFeedback(null);
    setActionPending(`${parcel.id}:edit`);
    const form = event.currentTarget;
    const data = new FormData(form);
    const photo = data.get("photo");
    if (photo instanceof File && photo.size > 5 * 1024 * 1024) {
      setParcelFeedback({ kind: "error", message: "La photo ne doit pas dépasser 5 Mo." });
      setActionPending(null);
      return;
    }
    try {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      const updated = await apiRequest<Parcel>(`/agriculture/parcels/${parcel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify({
          name: data.get("name"),
          area_hectares: Number(data.get("area_hectares")),
        }),
      });
      try {
        if (photo instanceof File && photo.size > 0) {
          const photoData = new FormData();
          photoData.set("photo", photo);
          await apiRequest<Parcel>(`/agriculture/parcels/${parcel.id}/photo`, {
            method: "POST",
            headers: organizationHeaders,
            body: photoData,
          });
        } else if (data.get("remove_photo") === "on") {
          await apiRequest<Parcel>(`/agriculture/parcels/${parcel.id}/photo`, {
            method: "DELETE",
            headers: organizationHeaders,
          });
        }
      } catch (error) {
        setParcelPhotoReset((value) => value + 1);
        await refreshAgriculture();
        setParcelFeedback({
          kind: "error",
          message: `Les informations de « ${updated.name} » sont enregistrées, mais la photo n’a pas été modifiée : ${getApiErrorMessage(error)}`,
        });
        return;
      }
      setParcelPhotoReset((value) => value + 1);
      await refreshAgriculture();
      setParcelFeedback({ kind: "success", message: `Parcelle « ${updated.name} » mise à jour.` });
      form.closest("details")?.removeAttribute("open");
    } catch (error) {
      setParcelFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setActionPending(null);
    }
  }

  async function parcelAction(parcel: Parcel, action: "archive" | "restore") {
    setParcelFeedback(null);
    setActionPending(`${parcel.id}:${action}`);
    try {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      await apiRequest<Parcel>(`/agriculture/parcels/${parcel.id}/${action}`, {
        method: "PATCH",
        headers: organizationHeaders,
      });
      await refreshAgriculture();
      setParcelFeedback({
        kind: "success",
        message: action === "archive"
          ? `Parcelle « ${parcel.name} » archivée.`
          : `Parcelle « ${parcel.name} » restaurée.`,
      });
    } catch (error) {
      setParcelFeedback({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setActionPending(null);
    }
  }

  const activeFarms = useMemo(
    () => activeFarmOptions.data?.items ?? [],
    [activeFarmOptions.data],
  );

  return (
    <div className="dashboard-content agriculture-workspace">
      <section className="agriculture-hero">
        <div className="agriculture-hero-copy">
          <p className="eyebrow">Exploitation agricole</p>
          <h1 className="page-title">Cultivez la performance.</h1>
          <p className="page-description">
            Des fermes aux campagnes, pilotez chaque saison avec une vision claire
            des récoltes et de la rentabilité.
          </p>
          <div className="agriculture-hero-stats">
            <span><strong>{activeFarmOptions.data?.total ?? "—"}</strong> ferme(s) active(s)</span>
            <span><strong>{campaigns.data?.total ?? "—"}</strong> campagne(s) affichée(s)</span>
          </div>
        </div>
        <div className="agriculture-hero-art" aria-hidden="true">
          <span className="hero-sun" />
          <span className="hero-field field-one" />
          <span className="hero-field field-two" />
          <span className="hero-field field-three" />
          <Sprout size={54} strokeWidth={1.1} />
        </div>
      </section>

      <div className="agriculture-toolbar">
        <div className="agriculture-tabs" role="tablist" aria-label="Espaces agricoles">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`agriculture-tab-${id}`}
              className="agriculture-tab"
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`agriculture-panel-${id}`}
              onClick={() => setTab(id)}
            >
              <Icon size={16} /><span>{label}</span>
            </button>
          ))}
        </div>
        <label className="agriculture-farm-filter">
          <span>Ferme</span>
          <select
            className="select-compact"
            value={selectedFarmId}
            onChange={(event) => {
              setSelectedFarmId(event.target.value);
              setCampaignPage(1);
              setParcelPage(1);
            }}
          >
            <option value="">Toutes les fermes</option>
            {activeFarms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}
          </select>
        </label>
      </div>

      {(farms.isError || activeFarmOptions.isError || crops.isError) ? (
        <div className="dashboard-error" role="alert">
          <p>{getApiErrorMessage(farms.error ?? activeFarmOptions.error ?? crops.error)}</p>
          <button className="button-secondary" type="button" onClick={() => void refreshAgriculture()}>Réessayer</button>
        </div>
      ) : null}

      {tab === "farms" ? (
        <div id="agriculture-panel-farms" role="tabpanel" aria-labelledby="agriculture-tab-farms">
          <div className="agriculture-section-heading">
            <div>
              <h2>{farmFilter === "active" ? "Vos fermes" : "Fermes archivées"}</h2>
              <p>Chaque ferme rassemble ses parcelles, campagnes et opérations financières.</p>
            </div>
            <div className="segmented-control" role="group" aria-label="Filtrer les fermes">
              <button type="button" aria-pressed={farmFilter === "active"} onClick={() => setFarmFilter("active")}>Actives</button>
              <button type="button" aria-pressed={farmFilter === "archived"} onClick={() => setFarmFilter("archived")}>Archives</button>
            </div>
          </div>
          <FeedbackMessage feedback={farmFeedback} />
          {farmFilter === "active" && canManage ? (
            <details className="panel agriculture-create-card">
              <summary><span className="agriculture-add-icon"><Plus size={17} /></span><span><strong>Ajouter une ferme</strong><small>Nom, localisation et photo de votre exploitation</small></span><ChevronRight size={16} /></summary>
              <form className="agriculture-form-grid" onSubmit={handleFarmSubmit}>
                <Field label="Nom de la ferme">
                  <input autoComplete="off" maxLength={120} minLength={2} name="name" placeholder="Ex. Ferme des Collines" required />
                </Field>
                <Field label="Localisation">
                  <input autoComplete="address-level2" maxLength={180} name="location" placeholder="Région, commune…" />
                </Field>
                <PhotoPreviewField key={`farm-create-photo-${farmPhotoReset}`} name="photo" label="Ajouter une belle photo" organizationId={organizationId!} />
                <button className="button-primary" disabled={farmSubmitting} type="submit">
                  {farmSubmitting ? "Création…" : "Créer la ferme"}
                </button>
              </form>
            </details>
          ) : null}
          {farms.isPending ? (
            <div className="dashboard-loading" role="status">Chargement des fermes…</div>
          ) : farms.data?.items.length ? (
            <div className="farm-card-grid">
              {farms.data.items.map((farm) => (
                <article className="farm-card panel" key={farm.id}>
                  <PrivatePhoto photoUrl={farm.photo_url} alt={`Vue de ${farm.name}`} organizationId={organizationId!} />
                  <div className="farm-card-body">
                    <div className="farm-card-title-row">
                      <div><h3>{farm.name}</h3>{farm.location ? <p><MapPin size={13} />{farm.location}</p> : null}</div>
                      <span className={`status-pill ${farm.is_active ? "delivered" : "cancelled"}`}>{farm.is_active ? "Active" : "Archivée"}</span>
                    </div>
                    <div className="farm-card-stats">
                      <span><strong>{farm.parcel_count}</strong> parcelles</span>
                      <span><strong>{formattedNumber(farm.area_hectares)}</strong> ha</span>
                    </div>
                    <div className="farm-card-actions">
                      <button className="button-secondary" type="button" onClick={() => {
                        setSelectedFarmId(farm.id);
                        setTab("farms");
                        document.getElementById("parcel-section")?.scrollIntoView({ behavior: "smooth" });
                      }}>Voir les parcelles</button>
                      {canManage ? (
                        <>
                          {farm.is_active ? (
                            <details className="agriculture-edit-details">
                              <summary aria-label={`Modifier ${farm.name}`}><Pencil size={14} />Modifier</summary>
                              <form className="agriculture-form-grid" onSubmit={(event) => void handleFarmUpdateSubmit(event, farm)}>
                                <Field label="Nom de la ferme"><input defaultValue={farm.name} maxLength={120} minLength={2} name="name" required /></Field>
                                <Field label="Localisation"><input defaultValue={farm.location ?? ""} maxLength={180} name="location" /></Field>
                                <PhotoPreviewField key={`farm-edit-photo-${farm.id}-${farmPhotoReset}`} name="photo" label="Remplacer la photo" organizationId={organizationId!} currentPhotoUrl={farm.photo_url} />
                                {farm.photo_url ? <label className="photo-remove-option"><input name="remove_photo" type="checkbox" value="true" />Supprimer la photo actuelle</label> : null}
                                <button className="button-primary" disabled={actionPending === `${farm.id}:edit`} type="submit">{actionPending === `${farm.id}:edit` ? "Enregistrement…" : "Enregistrer"}</button>
                              </form>
                            </details>
                          ) : null}
                          <button className="text-action" type="button" disabled={actionPending === `${farm.id}:${farm.is_active ? "archive" : "restore"}`} onClick={() => void farmAction(farm, farm.is_active ? "archive" : "restore")}>
                            {farm.is_active ? <Archive size={14} /> : <RotateCcw size={14} />}
                            {actionPending === `${farm.id}:${farm.is_active ? "archive" : "restore"}` ? "…" : farm.is_active ? "Archiver" : "Restaurer"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="panel agriculture-empty">
              <span className="agriculture-empty-icon"><Sprout size={24} /></span>
              <h3>{farmFilter === "active" ? "Votre première ferme vous attend" : "Aucune ferme archivée"}</h3>
              <p>{farmFilter === "active" ? "Créez une ferme pour y organiser ses parcelles et campagnes." : "Les fermes archivées apparaîtront ici."}</p>
            </div>
          )}

          <section className="panel agriculture-data-panel" id="parcel-section">
            <div className="agriculture-section-heading">
              <div><h2>Parcelles</h2><p>{selectedFarm ? `Parcelles de ${selectedFarm.name}` : "Parcelles de toutes les fermes actives"}</p></div>
              <div className="parcel-toolbar">
                <div className="segmented-control" role="group" aria-label="Filtrer les parcelles">
                  <button type="button" aria-pressed={parcelFilter === "active"} onClick={() => { setParcelFilter("active"); setParcelPage(1); }}>Actives</button>
                  <button type="button" aria-pressed={parcelFilter === "archived"} onClick={() => { setParcelFilter("archived"); setParcelPage(1); }}>Archives</button>
                </div>
                <label className="sales-search"><Search size={15} /><span className="visually-hidden">Rechercher une parcelle</span><input type="search" value={parcelSearch} placeholder="Nom ou culture" onChange={(event) => { setParcelSearch(event.target.value); setParcelPage(1); }} /></label>
              </div>
            </div>
            {canManage && activeFarms.length ? (
              <form className="agriculture-inline-form" onSubmit={handleParcelSubmit}>
                <Field label="Ferme"><select defaultValue={selectedFarmId || activeFarms[0]?.id} name="farm_id" required>{activeFarms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></Field>
                <Field label="Nom de la parcelle"><input maxLength={120} minLength={2} name="name" placeholder="Ex. Parcelle Nord" required /></Field>
                <Field label="Culture"><select defaultValue="" name="crop_id" required><option disabled value="">Choisir une culture</option>{(crops.data ?? []).map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}</select></Field>
                <Field label="Superficie (ha)"><input min="0.01" name="area_hectares" placeholder="2.5" required step="0.01" type="number" /></Field>
                <PhotoPreviewField key={`parcel-photo-${parcelPhotoReset}`} name="photo" label="Photo de la parcelle" organizationId={organizationId!} />
                <button className="button-primary" disabled={parcelSubmitting} type="submit">{parcelSubmitting ? "Ajout…" : "Ajouter"}</button>
              </form>
            ) : null}
            <FeedbackMessage feedback={parcelFeedback} />
            {canManage ? (
              <details className="crop-catalog">
                <summary><Sprout size={14} />Catalogue des cultures <span>{crops.data?.length ?? 0}</span></summary>
                <div className="crop-chip-list">{(crops.data ?? []).map((crop) => <span key={crop.id}>{crop.name}</span>)}</div>
                <form className="crop-add-form" onSubmit={handleCropSubmit}>
                  <input aria-label="Nouvelle culture" maxLength={120} minLength={2} name="crop_name" placeholder="Ajouter une culture…" required />
                  <button className="button-secondary" type="submit">Ajouter</button>
                </form>
              </details>
            ) : null}
            {parcels.isPending ? <div className="dashboard-loading" role="status">Chargement des parcelles…</div> : parcels.data?.items.length ? (
              <>
                <div className="table-wrap">
                  <table className="data-table agriculture-table">
                    <thead><tr><th scope="col">PARCELLE</th><th scope="col">FERME</th><th scope="col">CULTURE</th><th scope="col">SUPERFICIE</th><th scope="col">ÉTAT</th>{canManage ? <th scope="col">ACTIONS</th> : null}</tr></thead>
                    <tbody>{parcels.data.items.map((parcel) => <tr key={parcel.id}>
                      <td className="table-primary">
                        <div className="parcel-name-cell">
                          <PrivatePhoto photoUrl={parcel.photo_url} alt={`Photo de ${parcel.name}`} className="parcel-thumbnail" organizationId={organizationId!} />
                          <span>{parcel.name}</span>
                        </div>
                      </td>
                      <td>{parcel.farm_name}</td>
                      <td><span className="crop-cell"><Sprout size={13} />{parcel.crop}</span></td>
                      <td>{formattedNumber(parcel.area_hectares)} ha</td>
                      <td><span className={`status-pill ${parcel.is_active ? "delivered" : "cancelled"}`}>{parcel.is_active ? "Active" : "Archivée"}</span></td>
                      {canManage ? <td>
                        <div className="parcel-actions">
                          {parcel.is_active ? (
                            <details className="agriculture-edit-details">
                              <summary aria-label={`Modifier ${parcel.name}`}><Pencil size={14} />Modifier</summary>
                              <form className="agriculture-form-grid" onSubmit={(event) => void handleParcelUpdateSubmit(event, parcel)}>
                                <Field label="Nom de la parcelle"><input defaultValue={parcel.name} maxLength={120} minLength={2} name="name" required /></Field>
                                <Field label="Superficie (ha)"><input defaultValue={parcel.area_hectares} min="0.01" name="area_hectares" required step="0.01" type="number" /></Field>
                                <PhotoPreviewField key={`parcel-edit-photo-${parcel.id}-${parcelPhotoReset}`} name="photo" label="Remplacer la photo" organizationId={organizationId!} currentPhotoUrl={parcel.photo_url} />
                                {parcel.photo_url ? <label className="photo-remove-option"><input name="remove_photo" type="checkbox" value="on" />Supprimer la photo actuelle</label> : null}
                                <button className="button-primary" disabled={actionPending === `${parcel.id}:edit`} type="submit">{actionPending === `${parcel.id}:edit` ? "Enregistrement…" : "Enregistrer"}</button>
                              </form>
                            </details>
                          ) : null}
                          <button className="text-action" type="button" disabled={actionPending === `${parcel.id}:${parcel.is_active ? "archive" : "restore"}`} onClick={() => void parcelAction(parcel, parcel.is_active ? "archive" : "restore")}>
                            {parcel.is_active ? <Archive size={14} /> : <RotateCcw size={14} />}
                            {actionPending === `${parcel.id}:${parcel.is_active ? "archive" : "restore"}` ? "…" : parcel.is_active ? "Archiver" : "Restaurer"}
                          </button>
                        </div>
                      </td> : null}
                    </tr>)}</tbody>
                  </table>
                </div>
                <Pagination page={parcelPage} total={parcels.data.total} onChange={setParcelPage} />
              </>
            ) : !parcels.isError ? <div className="agriculture-empty compact"><p>{deferredParcelSearch ? "Aucune parcelle ne correspond à cette recherche." : "Créez une parcelle dans une ferme pour préparer votre première campagne."}</p></div> : null}
          </section>
        </div>
      ) : null}

      {tab === "campaigns" ? (
        <div id="agriculture-panel-campaigns" role="tabpanel" aria-labelledby="agriculture-tab-campaigns">
          <div className="agriculture-section-heading">
            <div><h2>Vos campagnes</h2><p>Planifiez, simulez, lancez puis clôturez chaque saison agricole.</p></div>
            <div className="segmented-control" role="group" aria-label="Filtrer les campagnes">
              <button type="button" aria-pressed={campaignFilter === "active"} onClick={() => { setCampaignFilter("active"); setCampaignPage(1); }}>Actives</button>
              <button type="button" aria-pressed={campaignFilter === "archived"} onClick={() => { setCampaignFilter("archived"); setCampaignPage(1); }}>Archives</button>
            </div>
          </div>
          <FeedbackMessage feedback={campaignFeedback} />
          {campaignFilter === "active" && canManage && activeFarms.length && parcels.data?.items.length ? (
            <details className="panel campaign-planner" open>
              <summary><span className="agriculture-add-icon"><Plus size={17} /></span><span><strong>Planifier une campagne</strong><small>Définissez vos hypothèses avant de la lancer</small></span><ChevronRight size={16} /></summary>
              <form className="campaign-form-grid" onSubmit={handleCampaignSubmit}>
                <Field label="Nom de la campagne"><input maxLength={120} minLength={2} name="name" placeholder="Ex. Maïs · Hivernage 2026" required /></Field>
                <Field label="Saison"><input maxLength={80} minLength={2} name="season" placeholder="Ex. 2026-Hivernage" required /></Field>
                <Field label="Parcelle"><select defaultValue="" name="parcel_id" required><option disabled value="">Choisir une parcelle</option>{(parcels.data?.items ?? []).filter((parcel) => parcel.is_active).map((parcel) => <option key={parcel.id} value={parcel.id}>{parcel.name} · {parcel.crop}</option>)}</select></Field>
                <Field label="Début"><input defaultValue={today} name="start_date" required type="date" /></Field>
                <Field label="Récolte prévue"><input name="expected_harvest_date" required type="date" /></Field>
                <Field label="Surface (ha)"><input min="0.01" name="area_hectares" placeholder="2.5" required step="0.01" type="number" /></Field>
                <Field label="Rendement estimé (kg/ha)"><input min="0" name="yield" placeholder="1800" required step="0.01" type="number" /></Field>
                <Field label="Prix estimé (FCFA/kg)"><input min="0" name="price" placeholder="450" required step="0.01" type="number" /></Field>
                <Field label="Intrants estimés (FCFA)"><input min="0" name="input_cost" placeholder="250000" required type="number" /></Field>
                <Field label="Autres coûts (FCFA)"><input min="0" name="other_cost" placeholder="100000" required type="number" /></Field>
                <button className="button-primary campaign-submit" disabled={campaignSubmitting} type="submit">{campaignSubmitting ? "Planification…" : "Enregistrer le plan"}</button>
              </form>
            </details>
          ) : null}
          {canManage && activeCampaignOptions.some((campaign) => campaign.status === "active") ? (
            <details className="panel harvest-entry-card">
              <summary><Wheat size={17} /><span><strong>Enregistrer une récolte</strong><small>Reliez les quantités à une campagne active</small></span><ChevronRight size={16} /></summary>
              <form className="agriculture-inline-form" onSubmit={handleHarvestSubmit}>
                <Field label="Campagne"><select defaultValue="" name="campaign_id" required><option disabled value="">Choisir une campagne</option>{activeCampaignOptions.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {campaign.parcel_name}</option>)}</select></Field>
                <Field label="Date"><input defaultValue={today} name="harvest_date" required type="date" /></Field>
                <Field label="Quantité (kg)"><input min="0.01" name="quantity_kg" placeholder="1200" required step="0.01" type="number" /></Field>
                <Field label="Note"><input maxLength={500} name="notes" placeholder="Observations" /></Field>
                <button className="button-primary" disabled={harvestSubmitting} type="submit">{harvestSubmitting ? "…" : "Enregistrer"}</button>
              </form>
            </details>
          ) : null}
          {campaigns.isPending ? <div className="dashboard-loading" role="status">Chargement des campagnes…</div> : campaigns.data?.items.length ? (
            <div className="campaign-list">
              {campaigns.data.items.map((campaign) => (
                <article className="panel campaign-card" key={campaign.id}>
                  <div className="campaign-card-top">
                    <div className="campaign-icon"><Sprout size={19} /></div>
                    <div className="campaign-title"><h3>{campaign.name}</h3><p>{campaign.crop} · {campaign.season} · {campaign.farm_name} / {campaign.parcel_name}</p></div>
                    <span className={`status-pill campaign-status-${campaign.status}`}>{campaignLabels[campaign.status]}</span>
                  </div>
                  <div className="campaign-dates"><span>{formatDate(campaign.start_date)} – {formatDate(campaign.expected_harvest_date)}</span><span>{formattedNumber(campaign.area_hectares)} ha</span></div>
                  <div className="campaign-metrics">
                    <div><span>Production prévue</span><strong>{formattedNumber(campaign.expected_production_kg)} kg</strong></div>
                    <div><span>Revenu estimé</span><strong>{formatFcfa(campaign.expected_revenue_fcfa)}</strong></div>
                    <div><span>Coûts estimés</span><strong>{formatFcfa(campaign.estimated_total_cost_fcfa)}</strong></div>
                    <div><span>Marge estimée</span><strong className={campaign.estimated_margin_fcfa >= 0 ? "positive-value" : "negative-value"}>{formatFcfa(campaign.estimated_margin_fcfa)}</strong></div>
                  </div>
                  {campaign.status === "closed" ? (
                    <div className="campaign-actuals">
                      <span>Réel : <strong>{formattedNumber(campaign.actual_production_kg)} kg récoltés · {formattedNumber(campaign.actual_sold_kg)} kg vendus</strong></span>
                      <span><strong>{formatFcfa(campaign.actual_revenue_fcfa)}</strong> commercialisés</span>
                      <span><strong>{formatFcfa(campaign.actual_expenses_fcfa)}</strong> dépensés</span>
                    </div>
                  ) : null}
                  {campaign.status === "closed" && canManage ? (
                    <details className="campaign-sale-form">
                      <summary><ArrowUpRight size={14} />Commercialiser une récolte</summary>
                      <form className="agriculture-inline-form" onSubmit={(event) => void handleSaleSubmit(event, campaign)}>
                        <Field label="Client"><input maxLength={160} minLength={2} name="customer_name" placeholder="Nom du client" required /></Field>
                        <Field label="Quantité (kg)"><input min="0.01" name="quantity_kg" placeholder="500" required step="0.01" type="number" /></Field>
                        <Field label="Prix unitaire (FCFA/kg)"><input min="0.01" name="unit_price" placeholder="450" required step="0.01" type="number" /></Field>
                        <Field label="Date de vente"><input defaultValue={today} name="transaction_date" required type="date" /></Field>
                        <button className="button-primary" type="submit">Enregistrer la vente</button>
                      </form>
                    </details>
                  ) : null}
                  {canManage ? (
                    <div className="campaign-actions">
                      {campaign.status === "planned" || campaign.status === "simulated" ? (
                        <>
                          <button className="button-secondary" type="button" disabled={actionPending === `${campaign.id}:simulate`} onClick={() => void campaignAction(campaign, "simulate")}><FlaskConical size={14} />{actionPending === `${campaign.id}:simulate` ? "Simulation…" : "Simuler"}</button>
                          <button className="button-primary" type="button" disabled={actionPending === `${campaign.id}:start`} onClick={() => void campaignAction(campaign, "start")}><Check size={14} />Lancer la campagne</button>
                        </>
                      ) : null}
                      {campaign.status === "active" ? <button className="button-secondary" type="button" disabled={actionPending === `${campaign.id}:close`} onClick={() => void campaignAction(campaign, "close")}><Check size={14} />Clôturer</button> : null}
                      {campaign.status !== "active" && campaign.status !== "archived" && (campaign.status !== "closed" || Number(campaign.actual_sold_kg) >= Number(campaign.actual_production_kg)) ? <button className="text-action" type="button" disabled={actionPending === `${campaign.id}:archive`} onClick={() => void campaignAction(campaign, "archive")}><Archive size={14} />Archiver</button> : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : !campaigns.isError ? <div className="panel agriculture-empty compact"><span className="agriculture-empty-icon"><ClipboardList size={23} /></span><h3>{campaignFilter === "archived" ? "Aucune campagne archivée" : "Aucune campagne planifiée"}</h3><p>Créez une campagne pour préparer vos cultures, estimer la marge et suivre les récoltes.</p></div> : null}
          {campaigns.data && campaigns.data.total > pageSize ? (
            <Pagination page={campaignPage} total={campaigns.data.total} onChange={setCampaignPage} />
          ) : null}
        </div>
      ) : null}

      {tab === "finance" ? (
        <div id="agriculture-panel-finance" role="tabpanel" aria-labelledby="agriculture-tab-finance">
          <div className="agriculture-section-heading">
            <div><h2>Finances agricoles</h2><p>Recettes, dépenses et intrants rattachés à une ferme ou une campagne.</p></div>
            <label className="year-select-label"><span>Exercice</span><select className="select-compact" value={financeYear} onChange={(event) => setFinanceYear(Number(event.target.value))}>{Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          </div>
          {report ? (
            <div className="finance-summary-grid">
              <article className="finance-summary-card"><span>Recettes</span><strong>{formatFcfa(report.income_fcfa)}</strong><small>Commercialisation incluse</small><span className="finance-icon income"><ArrowDownLeft size={17} /></span></article>
              <article className="finance-summary-card"><span>Dépenses</span><strong>{formatFcfa(report.expenses_fcfa)}</strong><small>Charges saisies sur l’exercice</small><span className="finance-icon expense"><ArrowUpRight size={17} /></span></article>
              <article className="finance-summary-card"><span>Intrants</span><strong>{formatFcfa(report.input_expenses_fcfa)}</strong><small>Engrais, semences, traitements…</small><span className="finance-icon input"><Sprout size={17} /></span></article>
              <article className="finance-summary-card"><span>Solde</span><strong className={report.balance_fcfa >= 0 ? "positive-value" : "negative-value"}>{formatFcfa(report.balance_fcfa)}</strong><small>Recettes moins dépenses</small><span className="finance-icon balance"><CircleDollarSign size={17} /></span></article>
            </div>
          ) : financeSummary.isPending ? <div className="dashboard-loading" role="status">Calcul des mouvements…</div> : null}
          {canManage && activeFarms.length ? (
            <details className="panel finance-entry-panel">
              <summary><span className="agriculture-add-icon"><Plus size={17} /></span><span><strong>Saisir un mouvement</strong><small>Une dépense, un intrant ou une recette hors commercialisation</small></span><ChevronRight size={16} /></summary>
              <form className="campaign-form-grid" onSubmit={handleFinanceSubmit}>
                <Field label="Type"><select name="transaction_type"><option value="expense">Dépense</option><option value="income">Recette</option></select></Field>
                <Field label="Catégorie"><select name="category"><option value="input">Intrants</option><option value="labor">Main-d’œuvre</option><option value="equipment">Équipement</option><option value="transport">Transport</option><option value="maintenance">Entretien</option><option value="other">Autre</option></select></Field>
                <Field label="Ferme"><select name="farm_id" defaultValue={selectedFarmId || activeFarms[0]?.id} required>{activeFarms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></Field>
                <Field label="Campagne (facultatif)"><select name="campaign_id" defaultValue=""><option value="">Aucune campagne</option>{(campaignOptions.data?.items ?? []).filter((campaign) => campaign.status !== "archived").map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></Field>
                <Field label="Libellé"><input maxLength={160} minLength={2} name="label" placeholder="Ex. Achat d’engrais" required /></Field>
                <Field label="Montant (FCFA)"><input min="1" name="amount_fcfa" placeholder="125000" required type="number" /></Field>
                <Field label="Date"><input defaultValue={today} name="transaction_date" required type="date" /></Field>
                <Field label="Quantité (facultatif)"><input min="0.01" name="quantity" placeholder="50" step="0.01" type="number" /></Field>
                <Field label="Unité"><input maxLength={24} name="unit" placeholder="kg, sacs…" /></Field>
                <button className="button-primary campaign-submit" disabled={financeSubmitting} type="submit">{financeSubmitting ? "Enregistrement…" : "Enregistrer le mouvement"}</button>
              </form>
              <FeedbackMessage feedback={financeFeedback} />
            </details>
          ) : null}
          <section className="panel agriculture-data-panel">
            <div className="agriculture-section-heading">
              <div><h2>Journal financier</h2><p>{transactions.data?.total ?? 0} mouvement(s) sur {financeYear}</p></div>
              <label className="sales-filter-label"><span className="visually-hidden">Filtrer les opérations</span><select className="select-compact" value={financeType} onChange={(event) => setFinanceType(event.target.value as typeof financeType)}><option value="all">Recettes et dépenses</option><option value="income">Recettes</option><option value="expense">Dépenses</option></select></label>
            </div>
            {transactions.isPending ? <div className="dashboard-loading" role="status">Chargement du journal…</div> : transactions.data?.items.length ? (
              <div className="table-wrap"><table className="data-table agriculture-table"><thead><tr><th scope="col">DATE</th><th scope="col">LIBELLÉ</th><th scope="col">FERME / CAMPAGNE</th><th scope="col">CATÉGORIE</th><th scope="col">MONTANT</th></tr></thead><tbody>{transactions.data.items.map((item) => <tr key={item.id}><td>{formatDate(item.transaction_date)}</td><td className="table-primary">{item.label}{item.quantity ? <small className="table-subtext">{formattedNumber(item.quantity)} {item.unit}</small> : null}</td><td>{item.farm_name}{item.campaign_name ? <small className="table-subtext">{item.campaign_name}</small> : null}</td><td>{financeCategories[item.category] ?? item.category}</td><td className={item.transaction_type === "income" ? "finance-amount-income" : "finance-amount-expense"}>{item.transaction_type === "income" ? "+" : "−"} {formatFcfa(item.amount_fcfa)}</td></tr>)}</tbody></table></div>
            ) : !transactions.isError ? <div className="agriculture-empty compact"><p>Aucun mouvement financier pour cet exercice.</p></div> : null}
          </section>
          <FeedbackMessage feedback={financeFeedback} />
        </div>
      ) : null}

      {tab === "reports" ? (
        <div id="agriculture-panel-reports" role="tabpanel" aria-labelledby="agriculture-tab-reports">
          <div className="agriculture-section-heading">
            <div><h2>Rapport de campagne & finance</h2><p>Un récapitulatif lisible des mouvements et résultats agricoles saisis.</p></div>
            <label className="year-select-label"><span>Exercice</span><select className="select-compact" value={financeYear} onChange={(event) => setFinanceYear(Number(event.target.value))}>{Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          </div>
          {report ? (
            <>
              <section className="panel report-summary-panel">
                <div className="report-title-row"><span className="agriculture-empty-icon"><BarChart3 size={21} /></span><div><h3>Synthèse agricole · {report.year}</h3><p>Calculée à partir des opérations réellement enregistrées.</p></div></div>
                <div className="report-kpis"><div><span>Recettes</span><strong>{formatFcfa(report.income_fcfa)}</strong></div><div><span>Dépenses</span><strong>{formatFcfa(report.expenses_fcfa)}</strong></div><div><span>Intrants</span><strong>{formatFcfa(report.input_expenses_fcfa)}</strong></div><div><span>Résultat net</span><strong className={report.balance_fcfa >= 0 ? "positive-value" : "negative-value"}>{formatFcfa(report.balance_fcfa)}</strong></div></div>
              </section>
              <section className="panel agriculture-data-panel">
                <div className="agriculture-section-heading"><div><h2>Évolution mensuelle</h2><p>Comparaison des recettes et dépenses en FCFA.</p></div></div>
                <div className="report-month-list">{monthLabels.map((month, index) => {
                  const income = report.monthly_income[index]?.amount_fcfa ?? 0;
                  const expense = report.monthly_expenses[index]?.amount_fcfa ?? 0;
                  const maximum = Math.max(...report.monthly_income.map((item) => item.amount_fcfa), ...report.monthly_expenses.map((item) => item.amount_fcfa), 1);
                  return <div className="report-month-row" key={month}><span>{month}</span><div className="report-month-bars"><span className="report-bar-income" style={{ width: `${(income / maximum) * 100}%` }} /><span className="report-bar-expense" style={{ width: `${(expense / maximum) * 100}%` }} /></div><strong>{income ? formatFcfa(income) : "—"}</strong><small>{expense ? `− ${formatFcfa(expense)}` : "—"}</small></div>;
                })}</div>
                <div className="report-legend"><span><i className="report-bar-income" /> Recettes</span><span><i className="report-bar-expense" /> Dépenses</span></div>
              </section>
            </>
          ) : financeSummary.isPending ? <div className="dashboard-loading" role="status">Préparation du rapport…</div> : <div className="dashboard-error" role="alert"><p>{getApiErrorMessage(financeSummary.error)}</p></div>}
          <section className="panel agriculture-data-panel">
            <div className="agriculture-section-heading"><div><h2>Campagnes de l’exercice</h2><p>Prévisions, rendement et commercialisation.</p></div></div>
            {campaigns.data?.items.length ? <div className="table-wrap"><table className="data-table agriculture-table"><thead><tr><th scope="col">CAMPAGNE</th><th scope="col">STATUT</th><th scope="col">PRODUCTION PRÉVUE</th><th scope="col">REVENU ESTIMÉ</th><th scope="col">REVENU RÉEL</th><th scope="col">MARGE</th></tr></thead><tbody>{campaigns.data.items.map((campaign) => <tr key={campaign.id}><td className="table-primary">{campaign.name}<small className="table-subtext">{campaign.farm_name} · {campaign.crop}</small></td><td>{campaignLabels[campaign.status]}</td><td>{formattedNumber(campaign.expected_production_kg)} kg</td><td>{formatFcfa(campaign.expected_revenue_fcfa)}</td><td>{formatFcfa(campaign.actual_revenue_fcfa)}</td><td className={campaign.estimated_margin_fcfa >= 0 ? "finance-amount-income" : "finance-amount-expense"}>{formatFcfa(campaign.estimated_margin_fcfa)}</td></tr>)}</tbody></table></div> : <div className="agriculture-empty compact"><p>Aucune campagne à inclure dans le rapport.</p></div>}
          </section>
        </div>
      ) : null}
    </div>
  );
}
