import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Construction } from "lucide-react";

const modules: Record<string, { title: string; description: string }> = {
  operations: {
    title: "Opérations",
    description: "Planifiez les activités et suivez le travail de vos équipes.",
  },
  agriculture: {
    title: "Agriculture",
    description: "Pilotez vos exploitations, parcelles, campagnes et récoltes.",
  },
  elevage: {
    title: "Élevage",
    description: "Suivez vos bâtiments, animaux, lots, soins et productions.",
  },
  stocks: {
    title: "Stocks",
    description: "Centralisez vos produits, inventaires et mouvements de stock.",
  },
  productions: {
    title: "Productions",
    description: "Organisez les lots et le suivi de vos productions.",
  },
  ventes: {
    title: "Ventes",
    description: "Gérez vos clients, commandes, factures et règlements.",
  },
  finances: {
    title: "Finances",
    description: "Suivez vos dépenses, recettes, budgets et marges.",
  },
  rh: {
    title: "Ressources humaines",
    description: "Organisez vos collaborateurs, équipes et responsabilités.",
  },
  communication: {
    title: "Communication",
    description: "Préparez vos actualités, contenus et médias.",
  },
  entreprise: {
    title: "Entreprise",
    description: "Retrouvez les informations et la structure de votre entreprise.",
  },
  administration: {
    title: "Administration",
    description: "Configurez les utilisateurs, rôles et paramètres de la plateforme.",
  },
  aide: {
    title: "Centre d'aide",
    description: "Retrouvez les ressources et informations pour vous accompagner.",
  },
};

export function generateStaticParams() {
  return Object.keys(modules).map((module) => ({ module }));
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const page = modules[module];
  if (!page) notFound();

  return (
    <div className="dashboard-content">
      <section className="page-heading" aria-labelledby="module-title">
        <div>
          <p className="eyebrow">Espace de travail</p>
          <h1 className="page-title" id="module-title">{page.title}</h1>
          <p className="page-description">{page.description}</p>
        </div>
      </section>
      <section className="panel module-placeholder">
        <span className="module-placeholder-icon">
          <Construction size={21} />
        </span>
        <h2>Votre espace {page.title.toLowerCase()} prend forme</h2>
        <p>
          La navigation et les fondations de ce module sont en place. Les
          fonctionnalités métier seront ajoutées progressivement, avec des
          données fiables et reliées aux autres activités de l&apos;entreprise.
        </p>
        <Link className="module-back-link" href="/">
          Retour au tableau de bord <ArrowRight size={14} />
        </Link>
      </section>
    </div>
  );
}
