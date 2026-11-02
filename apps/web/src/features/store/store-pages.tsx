"use client";

import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronRight,
  Leaf,
  LoaderCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Tractor,
  Wheat,
  Star,
  Quote,
  Truck,
  Sun,
  CalendarDays,
  Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { apiRequest, getApiErrorMessage } from "@/lib/api/client";
import { formatFcfa } from "@/features/sales/sales-types";
import type { StoreOrder, StoreProduct, StoreProductPage } from "./store-types";
import { useShopCart } from "./use-shop-cart";
import { useProductPhoto } from "./use-product-photo";

const storeProductsQueryKey = ["store", "products"];

/* ------------------------------------------------------------------ */
/*  HEADER                                                             */
/* ------------------------------------------------------------------ */
function PublicHeader() {
  const { cart } = useShopCart();
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);

  return (
    <header className="public-header">
      <Link className="public-brand" href="/" aria-label="Mamari, accueil">
        <span className="brand-mark"><Leaf size={19} strokeWidth={2.2} /></span>
        <span className="public-brand-copy">
          <span>mamari</span>
          <small>Terre &amp; traditions</small>
        </span>
      </Link>
      <nav className="public-navigation" aria-label="Navigation principale">
        <span className="public-nav-links">
          <Link href="/#activites">Nos activités</Link>
          <Link href="/#histoire">Notre histoire</Link>
          <Link href="/produits">La boutique</Link>
        </span>
        <span className="public-nav-actions">
          <Link className="public-cart-link" href="/panier" aria-label={`Panier${cartCount ? `, ${cartCount} article(s)` : ""}`}>
            <ShoppingBag size={17} />
            <span>Panier</span>
            {cartCount ? <span className="public-cart-count">{cartCount}</span> : null}
          </Link>
          <Link className="public-login-link" href="/login">
            Espace équipe <ArrowRight size={14} />
          </Link>
        </span>
      </nav>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  FOOTER                                                             */
/* ------------------------------------------------------------------ */
function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-main">
        <div className="public-footer-about">
          <Link className="public-brand" href="/" aria-label="Mamari, accueil">
            <span className="brand-mark"><Leaf size={18} /></span>
            <span>mamari</span>
          </Link>
          <p>Des activités agricoles durables et des produits choisis avec soin, au rythme des saisons.</p>
        </div>
        <nav className="public-footer-nav" aria-label="Découvrir Mamari">
          <h2>Découvrir</h2>
          <Link href="/#activites">Nos activités</Link>
          <Link href="/#histoire">Notre histoire</Link>
          <Link href="/produits">La boutique</Link>
          <Link href="/panier">Votre panier</Link>
        </nav>
        <div className="public-footer-team">
          <h2>Une question ?</h2>
          <p>Notre équipe est à votre écoute pour vous accompagner.</p>
          <Link href="/login">Espace équipe <ArrowRight size={14} /></Link>
        </div>
      </div>
      <div className="public-footer-bottom">
        <span>© {new Date().getFullYear()} Mamari. Tous droits réservés.</span>
        <span>Du champ à votre table.</span>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  PRODUCT IMAGE                                                      */
/* ------------------------------------------------------------------ */
function ProductImage({
  product,
  className = "store-product-image",
}: {
  product: StoreProduct;
  className?: string;
}) {
  const { imageUrl, hasError } = useProductPhoto(product.photo_url);
  return (
    <div className={className}>
      {imageUrl ? (
        <Image alt="" fill sizes="(max-width: 700px) 90vw, (max-width: 1100px) 45vw, 28vw" src={imageUrl} unoptimized />
      ) : (
        <span className="store-product-placeholder">
          <Sprout size={38} strokeWidth={1.3} aria-hidden="true" />
          {hasError ? <small>Photo indisponible</small> : null}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PRODUCT CARD                                                       */
/* ------------------------------------------------------------------ */
function StoreProductCard({
  product,
  onAdd,
}: {
  product: StoreProduct;
  onAdd?: (product: StoreProduct) => void;
}) {
  const unavailable = product.stock_quantity < 1;
  return (
    <article className="store-product-card">
      <ProductImage product={product} />
      <div className="store-product-copy">
        <div className="store-product-heading">
          <div>
            {product.category ? <span className="store-product-category">{product.category}</span> : null}
            <h3>{product.name}</h3>
          </div>
          {unavailable ? <span className="store-stock-empty">Épuisé</span> : null}
        </div>
        {product.description ? <p>{product.description}</p> : null}
        <div className="store-product-bottom">
          <span className="store-product-price">
            {formatFcfa(product.price_fcfa)}
            <small> / {product.unit}</small>
          </span>
          {onAdd ? (
            <button className="store-add-button" type="button" disabled={unavailable} onClick={() => onAdd(product)}>
              <Plus size={16} /> Ajouter
            </button>
          ) : (
            <Link className="store-card-link" href="/produits">
              Découvrir <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  HOME                                                               */
/* ------------------------------------------------------------------ */
export function PublicHomePage() {
  const products = useQuery({
    queryKey: storeProductsQueryKey,
    queryFn: () => apiRequest<StoreProductPage>("/store/products"),
    retry: false,
  });
  const featuredProducts = products.data?.items.slice(0, 3) ?? [];
  const [subscribed, setSubscribed] = useState(false);

  function handleNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubscribed(true);
    event.currentTarget.reset();
  }

  return (
    <div className="public-site">
      <PublicHeader />
      <main>
        {/* ---------- HERO ---------- */}
        <section className="public-hero">
          <div className="public-hero-photo">
            <Image
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 72vw"
              src="/images/login-corn.png"
            />
            <div className="public-hero-shade" />
            <div className="public-hero-copy">
              <p className="public-eyebrow">Cultiver · Élever · Partager</p>
              <h1>La terre nous rassemble.</h1>
              <p>
                Des savoir-faire vivants, des produits choisis avec soin et une
                entreprise qui grandit au rythme des saisons.
              </p>
              <Link className="public-primary-link" href="/produits">
                Découvrir nos produits <ArrowRight size={17} />
              </Link>
              <p className="public-hero-meta">
                <span>·</span>
                <Users size={12} /> 1 200+ familles nous font confiance
              </p>
            </div>
            <div className="public-hero-stamp">
              <Leaf size={19} />
              <span>Du champ<br />à votre table</span>
            </div>
          </div>
          <div className="public-hero-note">
            <span>Une aventure ancrée dans le vivant</span>
            <p>Nous faisons grandir des activités agricoles durables et des liens de confiance.</p>
          </div>
        </section>

        {/* ---------- STATS ---------- */}
        <section className="public-stats">
          <div className="public-stats-grid">
            <div><strong>8</strong><span>années d&apos;expérience</span></div>
            <div><strong>12</strong><span>hectares cultivés</span></div>
            <div><strong>45</strong><span>produits de la ferme</span></div>
            <div><strong>1 200<span className="accent">+</span></strong><span>familles servies</span></div>
          </div>
        </section>

        {/* ---------- ACTIVITÉS ---------- */}
        <section className="public-section public-activities" id="activites">
          <div className="public-section-heading">
            <div>
              <p className="public-eyebrow">Ce qui nous anime</p>
              <h2>Des activités qui prennent racine.</h2>
            </div>
            <p>
              De la préparation des cultures à la valorisation des récoltes,
              chaque activité participe à une même ambition.
            </p>
          </div>
          <div className="public-activity-grid">
            <article className="public-activity-card">
              <span><Wheat size={21} /></span>
              <h3>Agriculture</h3>
              <p>Des parcelles suivies avec attention et des cultures au rythme des saisons.</p>
            </article>
            <article className="public-activity-card">
              <span><Sprout size={21} /></span>
              <h3>Élevage</h3>
              <p>Des élevages conduits avec soin, au cœur d&apos;une exploitation vivante.</p>
            </article>
            <article className="public-activity-card">
              <span><Tractor size={21} /></span>
              <h3>Productions</h3>
              <p>Des produits sélectionnés et préparés pour rejoindre votre quotidien.</p>
            </article>
          </div>
        </section>

        {/* ---------- HISTOIRE ---------- */}
        <section className="public-section public-story" id="histoire">
          <div className="public-story-copy">
            <p className="public-eyebrow">Notre histoire</p>
            <h2>Une aventure qui a pris racine.</h2>
            <p>
              Depuis 2016, Mamari cultive bien plus que des produits : un lien de
              confiance avec la terre et ceux qui la travaillent. Chaque saison
              nous rappelle l&apos;importance du rythme juste et du travail bien fait.
            </p>
            <ul className="public-story-timeline">
              <li>
                <span>2016</span>
                <div>
                  <strong>Premières parcelles</strong>
                  <p>Une petite exploitation familiale voit le jour.</p>
                </div>
              </li>
              <li>
                <span>2020</span>
                <div>
                  <strong>L&apos;élevage rejoint l&apos;aventure</strong>
                  <p>Diversification et respect du bien-être animal.</p>
                </div>
              </li>
              <li>
                <span>2024</span>
                <div>
                  <strong>La boutique en ligne</strong>
                  <p>Nos produits livrés directement chez vous.</p>
                </div>
              </li>
            </ul>
            <Link className="public-text-link" href="/produits">
              Découvrir nos produits <ArrowRight size={15} />
            </Link>
          </div>
          <div className="public-story-visual">
            <Image
              alt=""
              fill
              sizes="(max-width: 900px) 90vw, 45vw"
              src="/images/login-corn.png"
              style={{ objectPosition: "center 30%" }}
            />
            <div className="public-story-badge">
              <Leaf size={18} />
              <div>
                <strong>100% local</strong>
                <span>cultivé &amp; engagé</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- PRODUITS VEDETTES ---------- */}
        <section className="public-section public-featured">
          <div className="public-section-heading">
            <div>
              <p className="public-eyebrow">La boutique Mamari</p>
              <h2>Les produits du moment.</h2>
            </div>
            <Link className="public-text-link" href="/produits">
              Tous les produits <ArrowRight size={15} />
            </Link>
          </div>
          {products.isPending ? (
            <p className="store-loading" role="status">Découverte de la boutique…</p>
          ) : products.isError ? (
            <p className="store-feedback store-feedback-error" role="alert">
              {getApiErrorMessage(products.error)}
            </p>
          ) : featuredProducts.length ? (
            <div className="store-product-grid">
              {featuredProducts.map((product) => (
                <StoreProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="public-products-empty">
              <ShoppingBag size={21} />
              <p>Nos premiers produits arrivent bientôt dans la boutique.</p>
            </div>
          )}
        </section>

        {/* ---------- DÉMARCHE ---------- */}
        <section className="public-section public-process">
          <div className="public-section-heading">
            <div>
              <p className="public-eyebrow">Notre démarche</p>
              <h2>Du champ à votre table.</h2>
            </div>
            <p>Chaque étape est menée avec soin, dans le respect du vivant et des saisons.</p>
          </div>
          <div className="public-process-grid">
            <article>
              <span className="public-process-number">01</span>
              <span className="public-process-icon"><Sprout size={22} /></span>
              <h3>Semer</h3>
              <p>Nous préparons la terre et semons au bon moment.</p>
            </article>
            <article>
              <span className="public-process-number">02</span>
              <span className="public-process-icon"><Wheat size={22} /></span>
              <h3>Cultiver</h3>
              <p>Un suivi quotidien, sans compromis sur la qualité.</p>
            </article>
            <article>
              <span className="public-process-number">03</span>
              <span className="public-process-icon"><Sun size={22} /></span>
              <h3>Récolter</h3>
              <p>À pleine maturité, pour des saveurs authentiques.</p>
            </article>
            <article>
              <span className="public-process-number">04</span>
              <span className="public-process-icon"><Truck size={22} /></span>
              <h3>Partager</h3>
              <p>Livré chez vous, frais et prêt à savourer.</p>
            </article>
          </div>
        </section>

        {/* ---------- TÉMOIGNAGES ---------- */}
        <section className="public-section public-testimonials">
          <div className="public-section-heading">
            <div>
              <p className="public-eyebrow">Ils nous font confiance</p>
              <h2>Des voix qui nous animent.</h2>
            </div>
          </div>
          <div className="public-testimonials-grid">
            <blockquote>
              <Quote size={20} />
              <p>« Une qualité irréprochable et un contact toujours chaleureux. On sent le soin dans chaque produit. »</p>
              <footer>
                <span className="public-testimonial-avatar">AD</span>
                <div>
                  <strong>Awa D.</strong>
                  <small>Cliente fidèle</small>
                </div>
              </footer>
            </blockquote>
            <blockquote>
              <Quote size={20} />
              <p>« Des produits qui ont du goût et une histoire. Ma famille ne jure plus que par Mamari. »</p>
              <footer>
                <span className="public-testimonial-avatar">KM</span>
                <div>
                  <strong>Kofi M.</strong>
                  <small>Client depuis 2022</small>
                </div>
              </footer>
            </blockquote>
            <blockquote>
              <Quote size={20} />
              <p>« Un partenariat de confiance, des livraisons ponctuelles et un vrai respect des saisons. »</p>
              <footer>
                <span className="public-testimonial-avatar">FS</span>
                <div>
                  <strong>Fatou S.</strong>
                  <small>Restauratrice partenaire</small>
                </div>
              </footer>
            </blockquote>
          </div>
        </section>

        {/* ---------- BANNIÈRE CONTACT ---------- */}
        <section className="public-contact-banner">
          <div>
            <p className="public-eyebrow">L&apos;aventure Mamari</p>
            <h2>Une question ou une envie de collaborer ?</h2>
          </div>
          <Link className="public-secondary-link" href="/produits">
            Visiter la boutique <ChevronRight size={16} />
          </Link>
        </section>

        {/* ---------- NEWSLETTER ---------- */}
        <section className="public-newsletter">
          <div className="public-newsletter-inner">
            <div>
              <p className="public-eyebrow">Rejoignez-nous</p>
              <h2>Recevez des nouvelles du champ.</h2>
              <p>
                Nouveautés, récoltes de saison et recettes : une lettre au rythme
                des saisons, directement dans votre boîte mail.
              </p>
              <div className="public-newsletter-meta">
                <CalendarDays size={14} /> Une lettre par mois · Sans engagement
              </div>
            </div>
            <form className="public-newsletter-form" onSubmit={handleNewsletter}>
              {subscribed ? (
                <p className="public-newsletter-success" role="status">
                  <Check size={16} /> Merci ! Vous êtes bien inscrit·e.
                </p>
              ) : (
                <>
                  <input type="email" name="email" placeholder="votre@email.com" required aria-label="Votre adresse email" />
                  <button type="submit">
                    S&apos;inscrire <ArrowRight size={15} />
                  </button>
                </>
              )}
            </form>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  STORE PAGE                                                         */
/* ------------------------------------------------------------------ */
export function StorePage() {
  const { cart, setCart } = useShopCart();
  const products = useQuery({
    queryKey: storeProductsQueryKey,
    queryFn: () => apiRequest<StoreProductPage>("/store/products"),
    retry: false,
  });

  const availableProducts = products.data?.items ?? [];
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

  function addProduct(product: StoreProduct) {
    setCart((current) => ({
      ...current,
      [product.id]: Math.min((current[product.id] ?? 0) + 1, product.stock_quantity),
    }));
  }

  return (
    <div className="public-site">
      <PublicHeader />
      <main className="public-section store-page">
        <div className="store-page-heading">
          <div>
            <p className="public-eyebrow">La boutique Mamari</p>
            <h1>Des produits choisis avec soin.</h1>
            <p>Parcourez notre sélection et ajoutez vos produits au panier.</p>
          </div>
          <Link className="store-back-link" href="/panier">
            <ShoppingBag size={15} /> Mon panier
            {cartCount ? <span className="store-heading-cart-count">{cartCount}</span> : null}
          </Link>
        </div>

        {products.isPending ? (
          <p className="store-loading" role="status">Chargement des produits…</p>
        ) : products.isError ? (
          <div className="store-feedback store-feedback-error" role="alert">
            {getApiErrorMessage(products.error)}
          </div>
        ) : availableProducts.length ? (
          <div className="store-layout store-catalog-layout">
            <section aria-label="Produits disponibles" className="store-catalog store-catalog-full">
              <div className="store-product-grid">
                {availableProducts.map((product) => (
                  <StoreProductCard key={product.id} product={product} onAdd={addProduct} />
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="public-products-empty">
            <ShoppingBag size={22} />
            <p>La boutique prépare ses premiers produits. Revenez nous voir bientôt.</p>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CART PAGE                                                          */
/* ------------------------------------------------------------------ */
const checkoutSteps = ["Panier", "Coordonnées", "Confirmation"] as const;

export function CartPage() {
  const queryClient = useQueryClient();
  const { cart, setCart } = useShopCart();
  const [step, setStep] = useState(0);
  const [completedOrder, setCompletedOrder] = useState<StoreOrder | null>(null);
  const products = useQuery({
    queryKey: storeProductsQueryKey,
    queryFn: () => apiRequest<StoreProductPage>("/store/products"),
    retry: false,
  });
  const checkout = useMutation({
    mutationFn: (data: {
      customer_name: string;
      customer_phone: string;
      customer_email?: string;
      delivery_address?: string;
      items: { product_id: string; quantity: number }[];
    }) => apiRequest<StoreOrder>("/store/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: async (order) => {
      setCart({});
      setCompletedOrder(order);
      setStep(2);
      await queryClient.invalidateQueries({ queryKey: storeProductsQueryKey });
    },
  });

  const availableProducts = products.data?.items ?? [];
  const cartItems = availableProducts
    .filter((product) => cart[product.id])
    .map((product) => ({
      product,
      quantity: cart[product.id],
    }));
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasUnavailableItems = cartItems.some(
    ({ product, quantity }) => quantity > product.stock_quantity,
  );
  const total = cartItems.reduce(
    (sum, item) => sum + item.product.price_fcfa * item.quantity,
    0,
  );

  function changeQuantity(product: StoreProduct, adjustment: number) {
    setCart((current) => {
      const next = (current[product.id] ?? 0) + adjustment;
      if (next < 1) {
        const remaining = { ...current };
        delete remaining[product.id];
        return remaining;
      }
      return { ...current, [product.id]: Math.min(next, product.stock_quantity) };
    });
  }

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    checkout.mutate({
      customer_name: String(formData.get("customer_name") ?? ""),
      customer_phone: String(formData.get("customer_phone") ?? ""),
      customer_email: String(formData.get("customer_email") ?? "") || undefined,
      delivery_address: String(formData.get("delivery_address") ?? "") || undefined,
      items: cartItems.map(({ product, quantity }) => ({
        product_id: product.id,
        quantity,
      })),
    });
  }

  return (
    <div className="public-site">
      <PublicHeader />
      <main className="public-section store-page cart-page">
        <div className="store-page-heading">
          <div>
            <p className="public-eyebrow">Votre sélection Mamari</p>
            <h1>{step === 2 ? "Merci pour votre commande." : "Votre panier."}</h1>
            <p>Votre commande en quelques étapes, sans paiement en ligne.</p>
          </div>
          {step < 2 ? (
            <Link className="store-back-link" href="/produits">
              <ArrowLeft size={15} /> Continuer mes achats
            </Link>
          ) : null}
        </div>

        <nav className="checkout-progress" aria-label="Étapes de commande">
          {checkoutSteps.map((label, index) => {
            const isCurrent = step === index;
            const isComplete = step > index;
            const canNavigateBack = index < step && index < 2;
            return (
              <button
                key={label}
                className={`checkout-progress-step${isCurrent ? " is-current" : ""}${isComplete ? " is-complete" : ""}`}
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                disabled={!canNavigateBack}
                onClick={() => setStep(index)}
              >
                <span>{isComplete ? <Check size={15} /> : index + 1}</span>
                <strong>{label}</strong>
              </button>
            );
          })}
        </nav>

        {products.isPending && step < 2 ? (
          <p className="store-loading" role="status">Chargement de votre panier…</p>
        ) : products.isError && step < 2 ? (
          <div className="store-feedback store-feedback-error" role="alert">
            {getApiErrorMessage(products.error)}
          </div>
        ) : step === 2 && completedOrder ? (
          <section className="checkout-complete">
            <span className="checkout-complete-icon"><Check size={27} /></span>
            <p className="public-eyebrow">Commande transmise</p>
            <h2>Merci, {completedOrder.customer_name} !</h2>
            <p>
              Votre demande <strong>{completedOrder.reference}</strong> est bien reçue.
              Notre équipe vous contactera au {completedOrder.customer_phone} pour confirmer
              la disponibilité et les modalités de règlement.
            </p>
            <div className="checkout-complete-summary">
              <span>{completedOrder.items.reduce((sum, item) => sum + item.quantity, 0)} article(s)</span>
              <strong>{formatFcfa(completedOrder.amount_fcfa)}</strong>
            </div>
            <Link className="button-primary checkout-home-link" href="/produits">
              Retour à la boutique <ArrowRight size={16} />
            </Link>
          </section>
        ) : !cartItems.length ? (
          <section className="checkout-empty">
            <span><ShoppingBag size={24} /></span>
            <h2>Votre panier est vide.</h2>
            <p>Choisissez quelques produits dans notre boutique pour commencer votre commande.</p>
            <Link className="button-primary checkout-home-link" href="/produits">
              Découvrir les produits <ArrowRight size={16} />
            </Link>
          </section>
        ) : step === 0 ? (
          <section className="checkout-step-panel" aria-labelledby="checkout-cart-title">
            <div className="checkout-step-heading">
              <div>
                <p className="public-eyebrow">Étape 1 sur 3</p>
                <h2 id="checkout-cart-title">Vérifiez votre panier</h2>
                <p>{itemCount} article(s) sélectionné(s)</p>
              </div>
              <ShoppingBag size={22} />
            </div>
            <div className="checkout-cart-layout">
              <ul className="checkout-cart-list">
                {cartItems.map(({ product, quantity }) => (
                  <li className="checkout-cart-item" key={product.id}>
                    <ProductImage product={product} className="checkout-product-image" />
                    <div className="checkout-cart-product-copy">
                      {product.category ? <span className="store-product-category">{product.category}</span> : null}
                      <h3>{product.name}</h3>
                      <p>{formatFcfa(product.price_fcfa)} / {product.unit}</p>
                    </div>
                    <div className="store-quantity">
                      <button type="button" aria-label={`Retirer une unité de ${product.name}`} onClick={() => changeQuantity(product, -1)}>
                        <Minus size={13} />
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Ajouter une unité de ${product.name}`}
                        disabled={quantity >= product.stock_quantity}
                        onClick={() => changeQuantity(product, 1)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <strong className="checkout-line-total">
                      {formatFcfa(product.price_fcfa * quantity)}
                    </strong>
                  </li>
                ))}
              </ul>
              <aside className="checkout-summary">
                <h3>Résumé</h3>
                {hasUnavailableItems ? (
                  <p className="checkout-stock-warning" role="alert">
                    Un stock a changé. Ajustez les quantités avant de continuer.
                  </p>
                ) : null}
                <div><span>Sous-total ({itemCount} article(s))</span><strong>{formatFcfa(total)}</strong></div>
                <div><span>Livraison</span><span>À confirmer</span></div>
                <div className="checkout-summary-total"><span>Total estimé</span><strong>{formatFcfa(total)}</strong></div>
                <button className="button-primary checkout-next-button" type="button" disabled={hasUnavailableItems} onClick={() => setStep(1)}>
                  Passer aux coordonnées <ArrowRight size={16} />
                </button>
                <p><ShieldCheck size={14} /> Aucun paiement demandé à cette étape.</p>
              </aside>
            </div>
          </section>
        ) : (
          <section className="checkout-step-panel checkout-details-panel" aria-labelledby="checkout-details-title">
            <div className="checkout-step-heading">
              <div>
                <p className="public-eyebrow">Étape 2 sur 3</p>
                <h2 id="checkout-details-title">Où pouvons-nous vous joindre ?</h2>
                <p>Nous vous recontacterons pour confirmer votre commande.</p>
              </div>
              <span className="checkout-details-count">{itemCount} article(s) · {formatFcfa(total)}</span>
            </div>
            <div className="checkout-details-layout">
              <form className="checkout-customer-form" onSubmit={submitOrder}>
                <label className="auth-field">
                  <span>Votre nom</span>
                  <input autoComplete="name" maxLength={160} minLength={2} name="customer_name" required />
                </label>
                <label className="auth-field">
                  <span>Téléphone pour vous joindre</span>
                  <input autoComplete="tel" maxLength={32} minLength={6} name="customer_phone" required type="tel" />
                </label>
                <label className="auth-field">
                  <span>E-mail <small>(facultatif)</small></span>
                  <input autoComplete="email" maxLength={320} name="customer_email" type="email" />
                </label>
                <label className="auth-field">
                  <span>Adresse ou indications <small>(facultatif)</small></span>
                  <textarea maxLength={500} name="delivery_address" rows={3} />
                </label>
                {checkout.isError ? (
                  <p className="auth-error checkout-form-error" role="alert">
                    {getApiErrorMessage(checkout.error)}
                  </p>
                ) : null}
                <div className="checkout-form-actions">
                  <button className="button-secondary" type="button" onClick={() => setStep(0)}>
                    <ArrowLeft size={15} /> Retour au panier
                  </button>
                  <button className="button-primary" disabled={checkout.isPending} type="submit">
                    {checkout.isPending ? <LoaderCircle className="auth-spinner" size={16} /> : null}
                    {checkout.isPending ? "Envoi en cours…" : "Confirmer la commande"}
                    {!checkout.isPending ? <ArrowRight size={16} /> : null}
                  </button>
                </div>
                <p className="store-payment-note">
                  Aucun paiement en ligne. Le règlement sera organisé avec notre équipe.
                </p>
              </form>
              <aside className="checkout-summary checkout-details-summary">
                <h3>Votre sélection</h3>
                {cartItems.map(({ product, quantity }) => (
                  <div className="checkout-summary-product" key={product.id}>
                    <span>{quantity} × {product.name}</span>
                    <strong>{formatFcfa(product.price_fcfa * quantity)}</strong>
                  </div>
                ))}
                <div className="checkout-summary-total"><span>Total estimé</span><strong>{formatFcfa(total)}</strong></div>
                <p><ShieldCheck size={14} /> Vous pourrez confirmer les détails avec notre équipe.</p>
              </aside>
            </div>
          </section>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}