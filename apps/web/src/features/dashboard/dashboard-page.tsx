import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  Leaf,
  Package,
  Plus,
  ShoppingBasket,
  Sprout,
  Wheat,
} from "lucide-react";

const metrics = [
  {
    label: "Chiffre d'affaires",
    value: "12 480 000",
    unit: "FCFA",
    trend: "+12,8 %",
    detail: "vs. mois précédent",
    direction: "up",
    icon: CircleDollarSign,
  },
  {
    label: "Production récoltée",
    value: "8 640",
    unit: "kg",
    trend: "+8,2 %",
    detail: "vs. mois précédent",
    direction: "up",
    icon: Wheat,
  },
  {
    label: "Stocks disponibles",
    value: "24",
    unit: "références",
    trend: "3 alertes",
    detail: "nécessitent votre attention",
    direction: "down",
    icon: Package,
  },
  {
    label: "Tâches en cours",
    value: "18",
    unit: "tâches",
    trend: "4 en retard",
    detail: "sur l'ensemble des équipes",
    direction: "down",
    icon: ClipboardCheck,
  },
];

const chartData = [
  { month: "Jan", current: 44, previous: 32 },
  { month: "Fév", current: 57, previous: 43 },
  { month: "Mar", current: 49, previous: 38 },
  { month: "Avr", current: 70, previous: 51 },
  { month: "Mai", current: 62, previous: 45 },
  { month: "Juin", current: 82, previous: 59 },
  { month: "Juil", current: 73, previous: 56 },
  { month: "Août", current: 91, previous: 66 },
  { month: "Sep", current: 78, previous: 60 },
  { month: "Oct", current: 100, previous: 72 },
  { month: "Nov", current: 86, previous: 67 },
  { month: "Déc", current: 94, previous: 75 },
];

const activities = [
  {
    icon: Sprout,
    title: "Nouvelle campagne lancée",
    description: "Campagne de tomate — Parcelle Nord",
    time: "Il y a 25 min",
  },
  {
    icon: ShoppingBasket,
    title: "Commande enregistrée",
    description: "Commande #CMD-2025-084 · 485 000 FCFA",
    time: "Il y a 1 h",
  },
  {
    icon: Package,
    title: "Stock bientôt épuisé",
    description: "Semences de maïs · 12 kg restants",
    time: "Il y a 3 h",
  },
];

const orders = [
  { reference: "CMD-2025-084", customer: "Marché Central", date: "12 juin 2025", amount: "485 000 FCFA", status: "Confirmée" },
  { reference: "CMD-2025-083", customer: "Saveurs du Sahel", date: "11 juin 2025", amount: "275 500 FCFA", status: "En préparation" },
  { reference: "CMD-2025-082", customer: "Awa Distribution", date: "10 juin 2025", amount: "192 000 FCFA", status: "Confirmée" },
];

const quickActions = [
  { label: "Nouvelle vente", icon: ShoppingBasket },
  { label: "Ajouter une dépense", icon: CircleDollarSign },
  { label: "Enregistrer une récolte", icon: Wheat },
  { label: "Créer une tâche", icon: ClipboardCheck },
];

export function DashboardPage() {
  return (
    <div className="dashboard-content">
      <section className="page-heading" aria-labelledby="dashboard-title">
        <div>
          <p className="eyebrow">Dimanche 1 novembre 2026</p>
          <h1 className="page-title" id="dashboard-title">
            Bonjour Marie <span aria-hidden="true">👋</span>
          </h1>
          <p className="page-description">
            Voici ce qui se passe dans votre entreprise aujourd&apos;hui.
          </p>
        </div>
        <div className="date-chip">
          <CalendarDays size={15} />
          Cette semaine
        </div>
      </section>

      <section className="metrics-grid" aria-label="Indicateurs clés">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const TrendIcon = metric.direction === "up" ? ArrowUpRight : ArrowDownRight;
          return (
            <article className="metric-card" key={metric.label}>
              <div className="metric-heading">
                <span>{metric.label}</span>
                <span className="metric-icon">
                  <Icon size={16} />
                </span>
              </div>
              <div className="metric-value">
                {metric.value}{" "}
                <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: 0 }}>
                  {metric.unit}
                </span>
              </div>
              <div className="metric-foot">
                <span className="metric-trend">
                  <TrendIcon
                    size={12}
                    style={{ display: "inline", verticalAlign: "middle" }}
                  />{" "}
                  {metric.trend}
                </span>
                <span>{metric.detail}</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="dashboard-grid" aria-label="Activité de l'entreprise">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Revenus et production</h2>
              <p className="panel-subtitle">
                Évolution mensuelle de votre activité
              </p>
            </div>
            <select className="select-compact" aria-label="Période du graphique" defaultValue="2025">
              <option value="2026">Année 2026</option>
              <option value="2025">Année 2025</option>
            </select>
          </div>
          <div className="chart-legend" style={{ marginTop: 18 }}>
            <span className="legend-item">
              <span className="legend-dot" /> Revenus
            </span>
            <span className="legend-item">
              <span className="legend-dot muted" /> Production
            </span>
          </div>
          <div
            className="chart"
            role="img"
            aria-label="Graphique de démonstration des revenus et de la production de janvier à décembre"
          >
            <div className="chart-y-labels" aria-hidden="true">
              <span>12 M</span>
              <span>9 M</span>
              <span>6 M</span>
              <span>3 M</span>
              <span>0</span>
            </div>
            <div className="chart-grid" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="chart-bars" aria-hidden="true">
              {chartData.map((item) => (
                <div className="chart-group" key={item.month}>
                  <span className="chart-bar" style={{ height: `${item.current}%` }} />
                  <span className="chart-bar secondary" style={{ height: `${item.previous}%` }} />
                </div>
              ))}
            </div>
            <div className="chart-x-labels" aria-hidden="true">
              {chartData.map((item) => <span key={item.month}>{item.month}</span>)}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Activité récente</h2>
              <p className="panel-subtitle">Les dernières nouvelles de vos équipes</p>
            </div>
            <button className="icon-button" type="button" aria-label="Options d'activité">
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="activity-list">
            {activities.map((activity) => {
              const Icon = activity.icon;
              return (
                <div className="activity-item" key={activity.title}>
                  <span className="activity-marker">
                    <Icon size={15} />
                  </span>
                  <div className="activity-copy">
                    <p>
                      <strong>{activity.title}</strong>
                      <br />
                      {activity.description}
                    </p>
                    <time>{activity.time}</time>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="bottom-grid" aria-label="Suivi et accès rapides">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Commandes récentes</h2>
              <p className="panel-subtitle">Suivez les dernières commandes clients</p>
            </div>
            <button className="button-secondary" type="button">
              Voir tout
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">RÉFÉRENCE</th>
                  <th scope="col">CLIENT</th>
                  <th scope="col">DATE</th>
                  <th scope="col">MONTANT</th>
                  <th scope="col">STATUT</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.reference}>
                    <td className="table-primary">{order.reference}</td>
                    <td>{order.customer}</td>
                    <td>{order.date}</td>
                    <td className="table-primary">{order.amount}</td>
                    <td>
                      <span className={`status-pill${order.status === "En préparation" ? " warning" : ""}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Actions rapides</h2>
              <p className="panel-subtitle">Les tâches les plus courantes</p>
            </div>
          </div>
          <div className="quick-actions">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button className="quick-action" type="button" key={action.label}>
                  <span className="quick-action-icon">
                    <Icon size={15} />
                  </span>
                  <span>{action.label}</span>
                  <Plus size={13} style={{ marginLeft: "auto", color: "#9aa39c" }} />
                </button>
              );
            })}
          </div>
        </article>
      </section>

      <p className="demo-note">
        <Leaf size={11} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
        Aperçu — les chiffres affichés sont des données de démonstration.
      </p>
    </div>
  );
}
