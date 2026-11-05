"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Leaf, ShieldCheck, ShoppingBag } from "lucide-react";
import { apiRequest, getApiErrorMessage } from "@/lib/api/client";
import type { StoreProduct, StoreProductPage } from "./store-types";
import { PublicFooter, PublicHeader, StoreProductCard } from "./store-pages";
import { useShopCart } from "./use-shop-cart";

export function PublicHomePage() {
  const { cart, setCart } = useShopCart();
  const products = useQuery({
    queryKey: ["store", "products"],
    queryFn: () => apiRequest<StoreProductPage>("/store/products"),
    retry: false,
  });
  const featuredProducts = products.data?.items.slice(0, 3) ?? [];

  function addProduct(product: StoreProduct) {
    setCart((current) => ({
      ...current,
      [product.id]: Math.min((current[product.id] ?? 0) + 1, product.stock_quantity),
    }));
  }

  function removeProduct(product: StoreProduct) {
    setCart((current) => {
      const next = (current[product.id] ?? 0) - 1;
      if (next < 1) {
        const remaining = { ...current };
        delete remaining[product.id];
        return remaining;
      }
      return { ...current, [product.id]: next };
    });
  }

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
          </div>
          <div className="oulimata-hero-art" aria-hidden="true">
            <span className="oulimata-art-orbit oulimata-art-orbit-one" />
            <span className="oulimata-art-orbit oulimata-art-orbit-two" />
            <div className="oulimata-art-leaf"><Leaf size={110} strokeWidth={0.9} /></div>
          </div>
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
                <StoreProductCard
                  key={product.id}
                  product={product}
                  className="oulimata-product-card"
                  quantity={cart[product.id] ?? 0}
                  onAdd={addProduct}
                  onRemove={removeProduct}
                  descriptionFallback="Découvrez ce produit de notre sélection Aloe vera."
                />
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
