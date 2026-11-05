"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Leaf, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { apiRequest, getApiErrorMessage } from "@/lib/api/client";
import type { StoreProductPage } from "./store-types";
import { ProductImage, PublicFooter, PublicHeader } from "./store-pages";

export function PublicHomePage() {
  const products = useQuery({
    queryKey: ["store", "products"],
    queryFn: () => apiRequest<StoreProductPage>("/store/products"),
    retry: false,
  });
  const featuredProducts = products.data?.items.slice(0, 3) ?? [];

  return (
    <div className="public-site oulimata-site">
      <PublicHeader />
      <main>
        <section className="oulimata-hero">
          <div className="oulimata-hero-copy">
            <p className="public-eyebrow">La boutique Aloe vera d&apos;Oulimata</p>
            <h1>La nature prend soin de <em>vous.</em></h1>
            <p>Découvrez notre sélection de produits Aloe vera et trouvez ceux qui vous accompagnent au quotidien.</p>
            <Link className="public-primary-link" href="/produits">
              Voir tous les produits <ArrowRight size={17} />
            </Link>
            <div className="oulimata-trust-note"><ShieldCheck size={16} /> Des produits sélectionnés avec attention</div>
          </div>
          <div className="oulimata-hero-art" aria-hidden="true">
            <span className="oulimata-art-orbit oulimata-art-orbit-one" />
            <span className="oulimata-art-orbit oulimata-art-orbit-two" />
            <div className="oulimata-art-leaf"><Leaf size={110} strokeWidth={0.9} /></div>
            <span className="oulimata-art-label"><Sparkles size={15} /> Aloe vera</span>
          </div>
        </section>

        <section className="oulimata-promise" aria-label="Notre approche">
          <article><span><Leaf size={19} /></span><div><strong>Au cœur de la nature</strong><small>Une sélection inspirée par l&apos;Aloe vera</small></div></article>
          <article><span><ShieldCheck size={19} /></span><div><strong>Choisis avec attention</strong><small>Des produits présentés en toute clarté</small></div></article>
          <article><span><ShoppingBag size={19} /></span><div><strong>Commande simplement</strong><small>Parcourez, choisissez et ajoutez au panier</small></div></article>
        </section>

        <section className="public-section oulimata-featured" aria-labelledby="oulimata-products-title">
          <div className="public-section-heading">
            <div>
              <p className="public-eyebrow">La sélection Oulimata</p>
              <h2 id="oulimata-products-title">Nos produits Aloe vera.</h2>
            </div>
            <Link className="public-text-link" href="/produits">Toute la boutique <ArrowRight size={15} /></Link>
          </div>
          {products.isPending ? (
            <p className="store-loading" role="status">Chargement des produits…</p>
          ) : products.isError ? (
            <p className="store-feedback store-feedback-error" role="alert">{getApiErrorMessage(products.error)}</p>
          ) : featuredProducts.length ? (
            <div className="store-product-grid">
              {featuredProducts.map((product) => (
                <article className="store-product-card oulimata-product-card" key={product.id}>
                  <ProductImage product={product} />
                  <div className="store-product-copy">
                    {product.category ? <span className="store-product-category">{product.category}</span> : null}
                    <h3>{product.name}</h3>
                    <p>{product.description || "Découvrez ce produit de notre sélection Aloe vera."}</p>
                    <strong>{new Intl.NumberFormat("fr-FR").format(product.price_fcfa)} FCFA</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="oulimata-empty-products">
              <span><Leaf size={24} /></span>
              <h3>La sélection arrive bientôt.</h3>
              <p>Les produits seront affichés ici dès qu&apos;ils seront disponibles.</p>
            </div>
          )}
          {featuredProducts.length ? (
            <Link className="public-primary-link oulimata-catalog-link" href="/produits">
              Parcourir la boutique <ArrowRight size={16} />
            </Link>
          ) : null}
        </section>

        <section className="oulimata-about-callout">
          <span className="oulimata-about-icon"><Leaf size={26} /></span>
          <div><p className="public-eyebrow">Bienvenue chez Oulimata</p><h2>Une boutique pensée autour de l&apos;Aloe vera.</h2><p>Explorez une sélection de produits et choisissez ceux qui correspondent à vos envies.</p></div>
          <Link className="public-secondary-link" href="/qui-sommes-nous">En savoir plus <ArrowRight size={15} /></Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="public-site oulimata-site">
      <PublicHeader />
      <main className="oulimata-about-page">
        <section className="oulimata-about-hero">
          <span className="oulimata-about-icon"><Leaf size={32} /></span>
          <p className="public-eyebrow">Qui sommes-nous ?</p>
          <h1>Oulimata, une boutique autour de l&apos;Aloe vera.</h1>
          <p>Une adresse pour découvrir des produits Aloe vera sélectionnés avec attention et commander simplement.</p>
          <Link className="public-primary-link" href="/produits">Découvrir la boutique <ArrowRight size={16} /></Link>
        </section>
        <section className="oulimata-about-points">
          <article><span><Leaf size={20} /></span><h2>Une sélection dédiée</h2><p>Retrouvez les produits proposés par la boutique et leurs informations directement sur chaque fiche.</p></article>
          <article><span><ShoppingBag size={20} /></span><h2>Une commande facile</h2><p>Choisissez vos articles, ajoutez-les au panier et retrouvez le récapitulatif avant de commander.</p></article>
          <article><span><ShieldCheck size={20} /></span><h2>Des informations claires</h2><p>Les détails, prix et disponibilités sont consultables dans le catalogue en ligne.</p></article>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
