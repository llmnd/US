"use client";

import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, PackagePlus, Pencil, Plus, Sprout, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  apiRequest,
  formatUploadLimit,
  getApiErrorMessage,
  getUploadLimitBytes,
  type UserProfile,
} from "@/lib/api/client";
import { formatFcfa } from "@/features/sales/sales-types";
import type { StoreProduct } from "@/features/store/store-types";
import { useProductPhoto } from "@/features/store/use-product-photo";
import { MeasurementUnitSelect } from "@/features/shared/measurement-unit-select";

const productsQueryKey = ["sales", "products"];
const MAX_PRODUCT_PHOTO_BYTES = getUploadLimitBytes(5 * 1024 * 1024);

function ProductThumbnail({
  product,
  organizationId,
}: {
  product: StoreProduct;
  organizationId: string;
}) {
  const { imageUrl, hasError } = useProductPhoto(product.photo_url, organizationId);
  return (
    <div className="production-product-image">
      {imageUrl ? (
        <Image
          alt=""
          fill
          sizes="(max-width: 700px) 90vw, 320px"
          src={imageUrl}
          unoptimized
        />
      ) : (
        <span className="production-product-placeholder">
          <Sprout size={34} strokeWidth={1.3} aria-hidden="true" />
          {hasError ? <small>Photo indisponible</small> : null}
          {product.photo_url && !hasError ? <small>Chargement de la photo…</small> : null}
        </span>
      )}
    </div>
  );
}

function ProductPhotoField({
  product,
  organizationId,
}: {
  product: StoreProduct | null;
  organizationId: string;
}) {
  const { imageUrl, hasError } = useProductPhoto(product?.photo_url ?? null, organizationId);
  const [selectedPhoto, setSelectedPhoto] = useState<{ name: string; url: string } | null>(null);
  const localPhotoUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (localPhotoUrl.current) URL.revokeObjectURL(localPhotoUrl.current);
  }, []);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (localPhotoUrl.current) URL.revokeObjectURL(localPhotoUrl.current);
    localPhotoUrl.current = file ? URL.createObjectURL(file) : null;
    setSelectedPhoto(
      file && localPhotoUrl.current
        ? { name: file.name, url: localPhotoUrl.current }
        : null,
    );
  }

  const previewUrl = selectedPhoto?.url ?? imageUrl;
  return (
    <div className="auth-field production-photo-field">
      <span>Photo du produit <small>(facultatif, {formatUploadLimit(MAX_PRODUCT_PHOTO_BYTES)} max.)</small></span>
      <label className="production-photo-input">
        {previewUrl ? (
          <Image
            alt={selectedPhoto ? `Aperçu : ${selectedPhoto.name}` : ""}
            className="production-photo-preview"
            fill
            sizes="(max-width: 600px) 100vw, 600px"
            src={previewUrl}
            unoptimized
          />
        ) : (
          <span className="production-photo-placeholder">
            <ImagePlus size={21} />
            {hasError ? "Photo existante indisponible" : "Choisir une photo"}
          </span>
        )}
        <span className="production-photo-overlay">
          <ImagePlus size={15} />
          {selectedPhoto ? "Changer la photo" : product?.photo_url ? "Remplacer la photo" : "Choisir une photo"}
        </span>
        <input
          accept="image/jpeg,image/png,image/webp"
          name="photo"
          onChange={handlePhotoChange}
          type="file"
        />
      </label>
      {selectedPhoto ? (
        <small className="production-photo-name" role="status">
          Aperçu : {selectedPhoto.name}
        </small>
      ) : hasError && product?.photo_url ? (
        <small className="production-photo-name" role="alert">
          La photo enregistrée ne peut pas être chargée. Vous pouvez en sélectionner une autre.
        </small>
      ) : null}
    </div>
  );
}

export function ProductionPage() {
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const membership = profile.data?.memberships[0];
  const products = useQuery({
    queryKey: [...productsQueryKey, membership?.organization_id],
    queryFn: () => {
      if (!membership) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<StoreProduct[]>("/sales/products", {
        headers: { "X-Organization-ID": membership.organization_id },
      });
    },
    enabled: Boolean(membership),
    retry: false,
  });
  const canManage = Boolean(
    membership && ["owner", "admin", "manager"].includes(membership.role),
  );
  const canOperateCatalog = canManage || membership?.role === "operator";
  const saveProduct = useMutation({
    mutationFn: ({ id, data }: { id: string | null; data: FormData }) => {
      if (!membership) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<StoreProduct>(
        id ? `/sales/products/${id}` : "/sales/products",
        {
          method: id ? "PATCH" : "POST",
          headers: { "X-Organization-ID": membership.organization_id },
          body: data,
        },
      );
    },
    onSuccess: async (product) => {
      setEditingProduct(null);
      setIsFormOpen(false);
      setFeedback({
        kind: "success",
        text: `Le produit « ${product.name} » a été enregistré.`,
      });
      await queryClient.invalidateQueries({ queryKey: productsQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["store", "products"] });
    },
    onError: (error) => {
      setFeedback({ kind: "error", text: getApiErrorMessage(error) });
    },
  });

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const formData = new FormData(event.currentTarget);
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > MAX_PRODUCT_PHOTO_BYTES) {
      setFeedback({
        kind: "error",
        text: `La photo ne doit pas dépasser ${formatUploadLimit(MAX_PRODUCT_PHOTO_BYTES)}.`,
      });
      return;
    }
    if (!(photo instanceof File) || photo.size === 0) formData.delete("photo");
    const publication = formData.get("is_published") === "on";
    formData.set("is_published", String(publication));
    if (editingProduct) {
      formData.set("is_active", String(formData.get("is_active") === "on"));
    }
    saveProduct.mutate({ id: editingProduct?.id ?? null, data: formData });
  }

  const productItems = products.data ?? [];
  const onlineCount = productItems.filter(
    (product) => product.is_active && product.is_published,
  ).length;
  const stockCount = productItems.reduce((sum, product) => sum + product.stock_quantity, 0);

  return (
    <div className="dashboard-content production-workspace">
      <section className="page-heading" aria-labelledby="production-title">
        <div>
          <p className="eyebrow">Catalogue et stocks</p>
          <h1 className="page-title" id="production-title">Productions</h1>
          <p className="page-description">
            Préparez vos fiches produit, gérez les disponibilités et choisissez ce qui paraît dans la boutique.
          </p>
        </div>
        <div className="date-chip">{onlineCount} en vente</div>
      </section>

      <section className="production-stats" aria-label="Résumé du catalogue">
        <div><span>Produits enregistrés</span><strong>{productItems.length}</strong></div>
        <div><span>En vente</span><strong>{onlineCount}</strong></div>
        <div><span>Unités en stock</span><strong>{stockCount.toLocaleString("fr-FR")}</strong></div>
      </section>

      {canManage ? (
        <section className="panel production-form-panel" aria-labelledby="production-form-title">
          {isFormOpen ? (
            <div className="panel-header">
              <div>
                <h2 className="panel-title" id="production-form-title">
                  {editingProduct ? "Modifier le produit" : "Ajouter un produit"}
                </h2>
                <p className="panel-subtitle">
                  Les produits mis en vente deviennent visibles dans la boutique publique.
                </p>
              </div>
              <button
                className="button-secondary"
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setIsFormOpen(false);
                  setFeedback(null);
                }}
              >
                <X size={14} /> Fermer
              </button>
            </div>
          ) : (
            <div className="production-form-closed">
              <span className="production-add-icon"><PackagePlus size={19} /></span>
              <div>
                <h2 className="panel-title">Gérer le catalogue produit</h2>
                <p className="panel-subtitle">Le formulaire reste fermé jusqu’à ce que vous en ayez besoin.</p>
              </div>
              <button
                className="button-secondary"
                type="button"
                onClick={() => setIsFormOpen(true)}
              >
                <Plus size={15} /> Ajouter
              </button>
            </div>
          )}
          {feedback ? (
            <p
              className={feedback.kind === "error" ? "auth-error" : "admin-success"}
              role={feedback.kind === "error" ? "alert" : "status"}
            >
              {feedback.text}
            </p>
          ) : null}
          {isFormOpen ? (
            <form
              key={editingProduct?.id ?? "new-product"}
              className="production-form"
              onSubmit={submitProduct}
            >
            <label className="auth-field">
              <span>Nom du produit</span>
              <input
                defaultValue={editingProduct?.name ?? ""}
                maxLength={160}
                minLength={2}
                name="name"
                placeholder="Ex. Miel de saison"
                required
              />
            </label>
            <label className="auth-field">
              <span>Catégorie <small>(facultatif)</small></span>
              <input
                defaultValue={editingProduct?.category ?? ""}
                maxLength={80}
                name="category"
                placeholder="Ex. Épicerie"
              />
            </label>
            <label className="auth-field">
              <span>Prix (FCFA)</span>
              <input
                defaultValue={editingProduct?.price_fcfa ?? ""}
                max="9000000000000000"
                min="1"
                name="price_fcfa"
                required
                type="number"
              />
            </label>
            <label className="auth-field">
              <span>Stock disponible</span>
              <input
                defaultValue={editingProduct?.stock_quantity ?? 0}
                max="2000000000"
                min="0"
                name="stock_quantity"
                required
                type="number"
              />
            </label>
            <label className="auth-field">
              <span>Unité de vente</span>
              <MeasurementUnitSelect
                defaultValue={editingProduct?.unit ?? "unité"}
                name="unit"
                required
              />
            </label>
            <ProductPhotoField
              key={editingProduct?.id ?? "new-product-photo"}
              product={editingProduct}
              organizationId={membership?.organization_id ?? ""}
            />
            <label className="auth-field production-description-field">
              <span>Description <small>(facultatif)</small></span>
              <textarea
                defaultValue={editingProduct?.description ?? ""}
                maxLength={4000}
                name="description"
                placeholder="Présentez brièvement ce produit…"
                rows={3}
              />
            </label>
            <div className="production-toggles">
              <label>
                <input
                  defaultChecked={editingProduct?.is_published ?? false}
                  name="is_published"
                  type="checkbox"
                />
                <span><strong>Mettre en vente</strong><small>Visible par les visiteurs sur la boutique.</small></span>
              </label>
              {editingProduct ? (
                <label>
                  <input defaultChecked={editingProduct.is_active} name="is_active" type="checkbox" />
                  <span><strong>Produit actif</strong><small>Désactiver pour le retirer du catalogue.</small></span>
                </label>
              ) : null}
            </div>
            <button className="button-primary production-submit" disabled={saveProduct.isPending} type="submit">
              {editingProduct ? <Check size={16} /> : <Plus size={16} />}
              {saveProduct.isPending
                ? "Enregistrement…"
                : editingProduct
                  ? "Enregistrer les modifications"
                  : "Créer le produit"}
            </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {products.isError ? (
        <div className="dashboard-error" role="alert">
          <p>{getApiErrorMessage(products.error)}</p>
          <button className="button-secondary" type="button" onClick={() => void products.refetch()}>
            Réessayer
          </button>
        </div>
      ) : null}
      {products.isPending ? (
        <div className="dashboard-loading" role="status">Chargement des produits…</div>
      ) : productItems.length ? (
        <section className="production-product-grid" aria-label="Produits de l'organisation">
          {productItems.map((product) => (
            <article className="panel production-product-card" key={product.id}>
              <ProductThumbnail product={product} organizationId={membership?.organization_id ?? ""} />
              <div className="production-product-details">
                <div className="production-product-title">
                  <div>
                    {product.category ? <span className="store-product-category">{product.category}</span> : null}
                    <h2>{product.name}</h2>
                  </div>
                  <span className={`production-status ${product.is_active && product.is_published ? "is-published" : ""}`}>
                    {product.is_active && product.is_published ? "En vente" : product.is_active ? "Brouillon" : "Désactivé"}
                  </span>
                </div>
                {product.description ? <p className="production-product-description">{product.description}</p> : null}
                <div className="production-product-meta">
                  <strong>{formatFcfa(product.price_fcfa)} <small>/ {product.unit}</small></strong>
                  <span>{product.stock_quantity.toLocaleString("fr-FR")} en stock</span>
                </div>
                {canOperateCatalog ? (
                  <button
                    className="production-edit-button"
                    type="button"
                    onClick={() => {
                      setEditingProduct(product);
                      setIsFormOpen(true);
                      setFeedback(null);
                      document.getElementById("production-title")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                  >
                    <Pencil size={14} /> Modifier le produit
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : !products.isError ? (
        <section className="production-empty panel">
          <span><PackagePlus size={22} /></span>
          <h2>Votre catalogue est encore vide.</h2>
          <p>Ajoutez un produit puis activez « Mettre en vente » pour le publier sur la boutique.</p>
          {canOperateCatalog ? (
            <button
              className="button-primary"
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setIsFormOpen(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Ajouter un produit <Plus size={15} />
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
