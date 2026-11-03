"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  ChartNoAxesCombined,
  CircleDollarSign,
  Egg,
  Wheat,
} from "lucide-react";
import {
  apiRequest,
  getApiErrorMessage,
  type UserProfile,
} from "@/lib/api/client";
import { formatDate, formatFcfa } from "@/features/sales/sales-types";

type FinanceSource = "agriculture" | "elevage" | "payroll";
type FinanceType = "income" | "expense";

interface MonthlyFinance {
  month: string;
  month_number: number;
  income_fcfa: number;
  expenses_fcfa: number;
}

interface FinanceSourceSummary {
  source: FinanceSource;
  income_fcfa: number;
  expenses_fcfa: number;
  balance_fcfa: number;
  transaction_count: number;
}

interface FinanceSummary {
  year: number;
  income_fcfa: number;
  expenses_fcfa: number;
  balance_fcfa: number;
  transaction_count: number;
  monthly: MonthlyFinance[];
  by_source: FinanceSourceSummary[];
}

interface FinanceTransaction {
  id: string;
  source: FinanceSource;
  transaction_type: FinanceType;
  category: string;
  label: string;
  amount_fcfa: number;
  transaction_date: string;
  location: string;
  detail: string | null;
  counterparty: string | null;
  quantity: number | string | null;
  unit: string | null;
  notes: string | null;
  created_at: string;
}

interface FinanceTransactionPage {
  items: FinanceTransaction[];
  total: number;
  page: number;
  page_size: number;
}

const sourceLabels: Record<FinanceSource, string> = {
  agriculture: "Agriculture",
  elevage: "Élevage",
  payroll: "Paie",
};

const categoryLabels: Record<string, string> = {
  input: "Intrants",
  labor: "Main-d’œuvre",
  equipment: "Équipement",
  transport: "Transport",
  maintenance: "Entretien",
  commercialization: "Commercialisation",
  health: "Santé / soins",
  production: "Production",
  reproduction: "Reproduction",
  salary: "Salaires",
  sale: "Vente",
  other: "Autre",
};

export function FinancesPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [source, setSource] = useState<FinanceSource | "all">("all");
  const [type, setType] = useState<FinanceType | "all">("all");
  const [page, setPage] = useState(1);
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const organizationId = profile.data?.memberships[0]?.organization_id;
  const headers = organizationId ? { "X-Organization-ID": organizationId } : undefined;
  const summary = useQuery({
    queryKey: ["finances", "summary", organizationId, year],
    queryFn: () => {
      if (!headers) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<FinanceSummary>(`/finance/summary?year=${year}`, { headers });
    },
    enabled: Boolean(headers),
    retry: false,
  });
  const transactions = useQuery({
    queryKey: ["finances", "transactions", organizationId, year, source, type, page],
    queryFn: () => {
      if (!headers) throw new Error("Aucune organisation active n’est associée au compte.");
      const params = new URLSearchParams({
        year: String(year),
        page: String(page),
        page_size: "20",
      });
      if (source !== "all") params.set("source", source);
      if (type !== "all") params.set("type", type);
      return apiRequest<FinanceTransactionPage>(`/finance/transactions?${params}`, { headers });
    },
    enabled: Boolean(headers),
    retry: false,
  });

  const months = summary.data?.monthly ?? [];
  const highestMonthlyAmount = Math.max(
    1,
    ...months.flatMap((month) => [month.income_fcfa, month.expenses_fcfa]),
  );
  const totalPages = Math.ceil((transactions.data?.total ?? 0) / 20);
  const isPending = profile.isPending || summary.isPending || transactions.isPending;
  const error = profile.error ?? summary.error ?? transactions.error;
  const sourceSummary = summary.data?.by_source ?? [];

  return (
    <div className="dashboard-content finances-workspace">
      <section className="page-heading" aria-labelledby="finances-title">
        <div>
          <p className="eyebrow">Pilotage de l’entreprise</p>
          <h1 className="page-title" id="finances-title">Finances</h1>
          <p className="page-description">
            Une vue consolidée des recettes et dépenses enregistrées en agriculture et en élevage.
          </p>
        </div>
        <label className="year-select-label finances-year-select">
          <span>Exercice</span>
          <select
            className="select-compact"
            onChange={(event) => {
              setYear(Number(event.currentTarget.value));
              setPage(1);
            }}
            value={year}
          >
            {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - index).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </section>

      <div className="finances-info" role="note">
        <CircleDollarSign size={18} />
        <p>
          Ce bilan reprend les mouvements financiers déjà saisis dans les modules métier.
          Les commandes et ventes non enregistrées comme mouvements financiers ne sont pas incluses.
        </p>
        <div>
          <Link href="/agriculture">Agriculture <ArrowRight size={13} /></Link>
          <Link href="/elevage">Élevage <ArrowRight size={13} /></Link>
        </div>
      </div>

      {profile.data && !organizationId ? (
        <p className="auth-error" role="alert">Aucune organisation active n’est associée au compte.</p>
      ) : null}
      {profile.isError || summary.isError || transactions.isError ? (
        <p className="auth-error" role="alert">{getApiErrorMessage(error)}</p>
      ) : null}

      {isPending ? (
        <p className="stocks-loading" role="status">Consolidation des mouvements financiers…</p>
      ) : summary.data ? (
        <>
          <section className="finance-summary-grid finances-summary-grid" aria-label="Bilan financier annuel">
            <article className="finance-summary-card">
              <span>Recettes</span>
              <strong>{formatFcfa(summary.data.income_fcfa)}</strong>
              <small>{summary.data.year} · tous secteurs</small>
              <span className="finance-icon income"><ArrowDownLeft size={17} /></span>
            </article>
            <article className="finance-summary-card">
              <span>Dépenses</span>
              <strong>{formatFcfa(summary.data.expenses_fcfa)}</strong>
              <small>{summary.data.year} · tous secteurs</small>
              <span className="finance-icon expense"><ArrowUpRight size={17} /></span>
            </article>
            <article className="finance-summary-card">
              <span>Solde d’activité</span>
              <strong className={summary.data.balance_fcfa >= 0 ? "positive-value" : "negative-value"}>
                {formatFcfa(summary.data.balance_fcfa)}
              </strong>
              <small>Recettes moins dépenses enregistrées</small>
              <span className="finance-icon balance"><CircleDollarSign size={17} /></span>
            </article>
            <article className="finance-summary-card">
              <span>Mouvements</span>
              <strong>{summary.data.transaction_count}</strong>
              <small>sur l’exercice sélectionné</small>
              <span className="finance-icon input"><ChartNoAxesCombined size={17} /></span>
            </article>
          </section>

          <div className="finances-overview-grid">
            <section className="panel finances-chart-panel" aria-labelledby="finances-chart-title">
              <div className="finances-section-heading">
                <div>
                  <p className="eyebrow">Évolution annuelle</p>
                  <h2 id="finances-chart-title">Recettes & dépenses</h2>
                </div>
                <div className="finances-chart-legend">
                  <span><i className="income" /> Recettes</span>
                  <span><i className="expense" /> Dépenses</span>
                </div>
              </div>
              <div className="finances-month-chart">
                {months.map((month) => {
                  const incomeHeight = month.income_fcfa
                    ? Math.max(3, (month.income_fcfa / highestMonthlyAmount) * 100)
                    : 0;
                  const expenseHeight = month.expenses_fcfa
                    ? Math.max(3, (month.expenses_fcfa / highestMonthlyAmount) * 100)
                    : 0;
                  return (
                    <div className="finances-month-column" key={month.month_number}>
                      <div className="finances-month-values">
                        <span
                          className="finances-bar income"
                          style={{ height: `${incomeHeight}%` }}
                          title={`Recettes ${month.month} : ${formatFcfa(month.income_fcfa)}`}
                        />
                        <span
                          className="finances-bar expense"
                          style={{ height: `${expenseHeight}%` }}
                          title={`Dépenses ${month.month} : ${formatFcfa(month.expenses_fcfa)}`}
                        />
                      </div>
                      <span className="finances-month-label">{month.month}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel finances-source-panel" aria-labelledby="finances-source-title">
              <div className="finances-section-heading">
                <div>
                  <p className="eyebrow">Répartition</p>
                  <h2 id="finances-source-title">Par activité</h2>
                </div>
              </div>
              <div className="finances-source-list">
                {sourceSummary.map((item) => {
                  const Icon = item.source === "agriculture"
                    ? Wheat
                    : item.source === "elevage"
                      ? Egg
                      : Banknote;
                  return (
                    <article className="finances-source-card" key={item.source}>
                      <span className={`finances-source-icon ${item.source}`}><Icon size={17} /></span>
                      <div className="finances-source-copy">
                        <strong>{sourceLabels[item.source]}</strong>
                        <small>{item.transaction_count} mouvement(s)</small>
                      </div>
                      <b className={item.balance_fcfa >= 0 ? "positive-value" : "negative-value"}>
                        {formatFcfa(item.balance_fcfa)}
                      </b>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="panel finances-ledger-panel" aria-labelledby="finances-ledger-title">
            <div className="finances-ledger-heading">
              <div>
                <p className="eyebrow">Historique vérifiable</p>
                <h2 id="finances-ledger-title">Journal financier</h2>
                <p>{transactions.data?.total ?? 0} mouvement(s) correspondant aux filtres</p>
              </div>
              <div className="finances-filters">
                <label>
                  <span className="visually-hidden">Filtrer par activité</span>
                  <select
                    className="select-compact"
                    onChange={(event) => {
                      setSource(event.currentTarget.value as FinanceSource | "all");
                      setPage(1);
                    }}
                    value={source}
                  >
                    <option value="all">Toutes les activités</option>
                    <option value="agriculture">Agriculture</option>
                    <option value="elevage">Élevage</option>
                    <option value="payroll">Paie</option>
                  </select>
                </label>
                <label>
                  <span className="visually-hidden">Filtrer par type</span>
                  <select
                    className="select-compact"
                    onChange={(event) => {
                      setType(event.currentTarget.value as FinanceType | "all");
                      setPage(1);
                    }}
                    value={type}
                  >
                    <option value="all">Recettes et dépenses</option>
                    <option value="income">Recettes</option>
                    <option value="expense">Dépenses</option>
                  </select>
                </label>
              </div>
            </div>

            {transactions.isPending ? (
              <p className="stocks-loading" role="status">Chargement du journal…</p>
            ) : transactions.data?.items.length ? (
              <div className="table-wrap">
                <table className="data-table finances-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Mouvement</th>
                      <th scope="col">Activité / lieu</th>
                      <th scope="col">Catégorie</th>
                      <th scope="col">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.data.items.map((item) => (
                      <tr key={`${item.source}-${item.id}`}>
                        <td>{formatDate(item.transaction_date)}</td>
                        <td className="table-primary">
                          {item.label}
                          {item.detail ? <small className="table-subtext">{item.detail}</small> : null}
                          {item.quantity ? <small className="table-subtext">{item.quantity} {item.unit}</small> : null}
                        </td>
                        <td>
                          {sourceLabels[item.source]} · {item.location}
                          {item.counterparty ? <small className="table-subtext">{item.counterparty}</small> : null}
                        </td>
                        <td>{categoryLabels[item.category] ?? item.category}</td>
                        <td className={item.transaction_type === "income" ? "finance-amount-income" : "finance-amount-expense"}>
                          {item.transaction_type === "income" ? "+" : "−"} {formatFcfa(item.amount_fcfa)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="agriculture-empty compact">
                <p>Aucun mouvement financier pour ces filtres sur {year}.</p>
              </div>
            )}

            {totalPages > 1 ? (
              <nav className="stocks-pagination finances-pagination" aria-label="Pagination du journal financier">
                <button disabled={page === 1} onClick={() => setPage((current) => current - 1)} type="button">
                  Précédent
                </button>
                <span>Page {page} sur {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} type="button">
                  Suivant
                </button>
              </nav>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
