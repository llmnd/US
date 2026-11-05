"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Facebook,
  FileImage,
  Heart,
  Megaphone,
  Music2,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import {
  apiBlobRequest,
  apiRequest,
  formatUploadLimit,
  getApiErrorMessage,
  getUploadLimitBytes,
  type UserProfile,
} from "@/lib/api/client";

type SocialPlatform = "tiktok" | "facebook" | "both";
type ContentFormat = "video" | "photo" | "story";
type PostStatus = "draft" | "scheduled" | "published" | "archived";
type PostFilter = PostStatus | "all";

const MAX_MEDIA_UPLOAD_BYTES = getUploadLimitBytes(25 * 1024 * 1024);
const MEDIA_SIZE_ERROR =
  `Le média ne doit pas dépasser ${formatUploadLimit(MAX_MEDIA_UPLOAD_BYTES)}.`;

interface CommunicationPost {
  id: string;
  title: string;
  caption: string;
  hashtags: string | null;
  platform: SocialPlatform;
  content_format: ContentFormat;
  status: PostStatus;
  scheduled_date: string | null;
  published_at: string | null;
  published_url: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  created_at: string;
  updated_at: string;
}

interface CommunicationPostPage {
  items: CommunicationPost[];
  total: number;
  page: number;
  page_size: number;
}

interface CommunicationSummary {
  total: number;
  drafts: number;
  scheduled: number;
  published: number;
  upcoming: number;
}

type PostDialogState =
  | { mode: "edit"; post: CommunicationPost }
  | { mode: "publish"; post: CommunicationPost }
  | { mode: "delete"; post: CommunicationPost }
  | null;

const statusLabels: Record<PostStatus, string> = {
  draft: "Brouillon",
  scheduled: "Planifiée",
  published: "Publiée",
  archived: "Archivée",
};

const platformLabels: Record<SocialPlatform, string> = {
  tiktok: "TikTok",
  facebook: "Facebook",
  both: "TikTok + Facebook",
};

const formatLabels: Record<ContentFormat, string> = {
  video: "Vidéo",
  photo: "Photo",
  story: "Story",
};

const filterOptions: { value: PostFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "draft", label: "Brouillons" },
  { value: "scheduled", label: "Planifiées" },
  { value: "published", label: "Publiées" },
  { value: "archived", label: "Archives" },
];

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatPublishedDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function PlatformMark({ platform }: { platform: SocialPlatform }) {
  if (platform === "facebook") return <Facebook size={14} aria-hidden="true" />;
  if (platform === "both") return <span className="communication-both-mark">TK · f</span>;
  return <Music2 size={14} aria-hidden="true" />;
}

function PostMedia({
  post,
  organizationId,
}: {
  post: CommunicationPost;
  organizationId: string;
}) {
  const media = useQuery({
    queryKey: ["communication", "media", organizationId, post.id, post.media_url],
    queryFn: async () => URL.createObjectURL(await apiBlobRequest(post.media_url!, {
      cache: "no-store",
      headers: { "X-Organization-ID": organizationId },
    })),
    enabled: Boolean(post.media_url),
    retry: false,
  });
  useEffect(() => {
    return () => {
      if (media.data) URL.revokeObjectURL(media.data);
    };
  }, [media.data]);

  if (media.isError) {
    return <div className="communication-media-placeholder" role="img" aria-label="Média indisponible">
      <FileImage size={20} /><span>Média indisponible</span>
    </div>;
  }
  if (!media.data) {
    return <div className="communication-media-placeholder">
      {post.content_format === "video" ? <Video size={22} /> : <FileImage size={22} />}
      <span>{media.isPending ? "Chargement du média…" : "Aucun média joint"}</span>
    </div>;
  }
  if (post.media_mime_type?.startsWith("video/")) {
    return <video className="communication-media-preview" controls preload="metadata" src={media.data} />;
  }
  // Authenticated media is rendered from a protected blob URL.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="communication-media-preview" src={media.data} alt={`Média : ${post.title}`} />;
}

export function CommunicationPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<PostFilter>("all");
  const [platform, setPlatform] = useState<SocialPlatform | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<PostDialogState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const createDetailsRef = useRef<HTMLDetailsElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
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
  const summary = useQuery({
    queryKey: ["communication", "summary", organizationId],
    queryFn: () => apiRequest<CommunicationSummary>("/communication/summary", { headers }),
    enabled: Boolean(organizationId && canManage),
    retry: false,
  });
  const posts = useQuery({
    queryKey: ["communication", "posts", organizationId, filter, platform, search, page],
    queryFn: () => {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (filter !== "all") params.set("status", filter);
      if (platform !== "all") params.set("platform", platform);
      if (search.trim().length >= 2) params.set("search", search.trim());
      return apiRequest<CommunicationPostPage>(`/communication/posts?${params}`, { headers });
    },
    enabled: Boolean(organizationId && canManage),
    retry: false,
  });

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (dialog && !element.open) element.showModal();
    else if (!dialog && element.open) element.close();
  }, [dialog]);

  async function refreshPosts() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["communication", "posts"] }),
      queryClient.invalidateQueries({ queryKey: ["communication", "summary"] }),
    ]);
  }

  const createPost = useMutation({
    mutationFn: async ({
      body,
      mediaFile,
    }: {
      body: {
        title: string;
        caption: string;
        hashtags: string | null;
        platform: SocialPlatform;
        content_format: ContentFormat;
        status: "draft" | "scheduled";
        scheduled_date: string | null;
      };
      mediaFile: File | null;
    }) => {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      const post = await apiRequest<CommunicationPost>("/communication/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      if (!mediaFile) return { post, mediaError: null };
      const formData = new FormData();
      formData.set("media", mediaFile);
      try {
        const withMedia = await apiRequest<CommunicationPost>(
          `/communication/posts/${post.id}/media`,
          { method: "POST", headers, body: formData },
        );
        return { post: withMedia, mediaError: null };
      } catch (error) {
        return { post, mediaError: getApiErrorMessage(error) };
      }
    },
    onSuccess: async ({ post, mediaError }) => {
      setFormError(
        mediaError ? `La publication a été créée, mais le média n’a pas été ajouté : ${mediaError}` : null,
      );
      setMessage(`« ${post.title} » ${post.status === "scheduled" ? "a été planifiée." : "a été enregistrée en brouillon."}`);
      createDetailsRef.current?.querySelector("form")?.reset();
      if (createDetailsRef.current) createDetailsRef.current.open = false;
      await refreshPosts();
    },
    onError: (error) => {
      setMessage(null);
      setFormError(getApiErrorMessage(error));
    },
  });

  const updatePost = useMutation({
    mutationFn: ({
      postId,
      changes,
    }: {
      postId: string;
      changes: {
        title: string;
        caption: string;
        hashtags: string | null;
        platform: SocialPlatform;
        content_format: ContentFormat;
        status: "draft" | "scheduled" | "archived";
        scheduled_date: string | null;
      };
    }) => apiRequest<CommunicationPost>(`/communication/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(changes),
    }),
    onSuccess: async (post) => {
      setFormError(null);
      setMessage(`« ${post.title} » a été mise à jour.`);
      dialogRef.current?.close();
      setDialog(null);
      await refreshPosts();
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  const uploadMedia = useMutation({
    mutationFn: ({ postId, mediaFile }: { postId: string; mediaFile: File }) => {
      const formData = new FormData();
      formData.set("media", mediaFile);
      return apiRequest<CommunicationPost>(`/communication/posts/${postId}/media`, {
        method: "POST",
        headers,
        body: formData,
      });
    },
    onSuccess: async (post) => {
      setFormError(null);
      setMessage(`Le média de « ${post.title} » a été ajouté.`);
      await refreshPosts();
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  const removeMedia = useMutation({
    mutationFn: (postId: string) => apiRequest<CommunicationPost>(
      `/communication/posts/${postId}/media`,
      { method: "DELETE", headers },
    ),
    onSuccess: async () => {
      setFormError(null);
      setMessage("Le média a été retiré.");
      await refreshPosts();
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  const markPublished = useMutation({
    mutationFn: ({ postId, url }: { postId: string; url: string | null }) =>
      apiRequest<CommunicationPost>(`/communication/posts/${postId}/mark-published`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ published_url: url || null }),
      }),
    onSuccess: async (post) => {
      setFormError(null);
      setMessage(`« ${post.title} » a été marquée comme publiée.`);
      dialogRef.current?.close();
      setDialog(null);
      await refreshPosts();
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  const deletePost = useMutation({
    mutationFn: (postId: string) => apiRequest<void>(`/communication/posts/${postId}`, {
      method: "DELETE",
      headers,
    }),
    onSuccess: async () => {
      setFormError(null);
      setMessage("Le brouillon a été supprimé.");
      dialogRef.current?.close();
      setDialog(null);
      await refreshPosts();
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFormError(null);
    setMessage(null);
    const media = data.get("media");
    const mediaFile = media instanceof File && media.size > 0 ? media : null;
    if (mediaFile && mediaFile.size > MAX_MEDIA_UPLOAD_BYTES) {
      setFormError(MEDIA_SIZE_ERROR);
      return;
    }
    const scheduledDate = String(data.get("scheduled_date") ?? "") || null;
    const status = String(data.get("status")) as "draft" | "scheduled";
    createPost.mutate({
      body: {
        title: String(data.get("title") ?? "").trim(),
        caption: String(data.get("caption") ?? "").trim(),
        hashtags: String(data.get("hashtags") ?? "").trim() || null,
        platform: String(data.get("platform")) as SocialPlatform,
        content_format: String(data.get("content_format")) as ContentFormat,
        status,
        scheduled_date: status === "scheduled" ? scheduledDate : null,
      },
      mediaFile,
    });
  }

  function submitDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    const data = new FormData(event.currentTarget);
    setFormError(null);
    if (dialog.mode === "edit") {
      const scheduledDate = String(data.get("scheduled_date") ?? "") || null;
      const nextStatus = String(data.get("status")) as "draft" | "scheduled" | "archived";
      updatePost.mutate({
        postId: dialog.post.id,
        changes: {
          title: String(data.get("title") ?? "").trim(),
          caption: String(data.get("caption") ?? "").trim(),
          hashtags: String(data.get("hashtags") ?? "").trim() || null,
          platform: String(data.get("platform")) as SocialPlatform,
          content_format: String(data.get("content_format")) as ContentFormat,
          status: nextStatus,
          scheduled_date: scheduledDate,
        },
      });
    } else if (dialog.mode === "publish") {
      markPublished.mutate({
        postId: dialog.post.id,
        url: String(data.get("published_url") ?? "").trim() || null,
      });
    } else {
      deletePost.mutate(dialog.post.id);
    }
  }

  const rows = posts.data?.items ?? [];
  const totalPages = Math.ceil((posts.data?.total ?? 0) / 20);
  const isMutating = createPost.isPending || updatePost.isPending || uploadMedia.isPending
    || removeMedia.isPending || markPublished.isPending || deletePost.isPending;

  return (
    <div className="dashboard-content communication-workspace">
      <section className="page-heading" aria-labelledby="communication-title">
        <div>
          <p className="eyebrow">Votre présence en ligne</p>
          <h1 className="page-title" id="communication-title">Communication</h1>
          <p className="page-description">
            Préparez vos contenus, planifiez vos prises de parole et suivez leur publication.
          </p>
        </div>
        <Link className="communication-tiktok-link" href="/entreprise">
          Configurer les réseaux <ArrowUpRight size={15} />
        </Link>
      </section>

      <section className="communication-social-grid" aria-label="Réseaux sociaux">
        <article className="communication-social-card tiktok">
          <div className="communication-social-card-top">
            <span className="communication-social-icon"><Music2 size={19} /></span>
            <span className="communication-social-status pending">À configurer</span>
          </div>
          <div className="communication-social-identity">
            <p className="eyebrow">TikTok</p>
            <h2>Votre profil TikTok</h2>
          </div>
          <div className="communication-facebook-note">
            <Heart size={16} />
            <span>Ajoutez le lien de votre profil dans la fiche de l’entreprise.</span>
          </div>
          <Link href="/entreprise">Ouvrir la fiche entreprise <ArrowUpRight size={14} /></Link>
          <small>Aucun compte externe n’est associé automatiquement.</small>
        </article>
        <article className="communication-social-card facebook">
          <div className="communication-social-card-top">
            <span className="communication-social-icon"><Facebook size={19} /></span>
            <span className="communication-social-status pending">Lien à compléter</span>
          </div>
          <div className="communication-social-identity">
            <p className="eyebrow">Facebook</p>
            <h2>Votre page Facebook</h2>
          </div>
          <div className="communication-facebook-note">
            <Heart size={16} />
            <span>Le compte Facebook est à ajouter pour relier la page officielle et ses indicateurs.</span>
          </div>
          <span className="communication-social-placeholder">Adresse de la page non renseignée</span>
          <small>Aucun chiffre n’est affiché tant que la page n’est pas identifiée.</small>
        </article>
      </section>

      <div className="communication-publishing-note" role="note">
        <Sparkles size={17} />
        <p>
          Le planning prépare les contenus, mais ne publie pas automatiquement sur TikTok ou Facebook.
          Après publication manuelle, marquez le contenu comme publié pour garder l’historique.
        </p>
      </div>

      {profile.isPending ? (
        <p className="dashboard-loading" role="status">Vérification des accès…</p>
      ) : profile.isError ? (
        <p className="auth-error" role="alert">{getApiErrorMessage(profile.error)}</p>
      ) : !canManage ? (
        <p className="auth-error" role="alert">
          La préparation des contenus est réservée au propriétaire, aux administrateurs et aux responsables.
        </p>
      ) : null}
      {message ? <p className="sales-success-message communication-feedback" role="status">{message}</p> : null}
      {formError ? <p className="auth-error communication-feedback" role="alert">{formError}</p> : null}

      {canManage ? (
        <>
          <section className="communication-summary-grid" aria-label="Suivi éditorial">
            <article><span className="communication-summary-icon"><Megaphone size={17} /></span><div><small>Contenus préparés</small><strong>{summary.data?.total ?? 0}</strong></div></article>
            <article><span className="communication-summary-icon draft"><Pencil size={17} /></span><div><small>Brouillons</small><strong>{summary.data?.drafts ?? 0}</strong></div></article>
            <article><span className="communication-summary-icon scheduled"><CalendarDays size={17} /></span><div><small>À publier</small><strong>{summary.data?.upcoming ?? 0}</strong></div></article>
            <article><span className="communication-summary-icon published"><Check size={17} /></span><div><small>Publications suivies</small><strong>{summary.data?.published ?? 0}</strong></div></article>
          </section>
          {summary.isError ? (
            <div className="dashboard-error" role="alert">
              <p>{getApiErrorMessage(summary.error)}</p>
              <button className="button-secondary" type="button" onClick={() => void summary.refetch()}>Réessayer</button>
            </div>
          ) : null}

          <details className="panel communication-create-panel" ref={createDetailsRef}>
            <summary>
              <span className="communication-create-icon"><Plus size={17} /></span>
              <span><strong>Préparer un contenu</strong><small>Rédigez une légende, joignez un média et choisissez où le publier.</small></span>
              <span className="communication-create-cta">Nouveau contenu</span>
            </summary>
            <form className="communication-create-form" onSubmit={submitCreate}>
              <label className="auth-field communication-form-wide">
                <span>Titre interne</span>
                <input maxLength={160} minLength={2} name="title" placeholder="Ex. Les coulisses de la récolte" required />
              </label>
              <label className="auth-field">
                <span>Réseau prévu</span>
                <select defaultValue="tiktok" name="platform">
                  <option value="tiktok">TikTok</option>
                  <option value="facebook">Facebook</option>
                  <option value="both">TikTok et Facebook</option>
                </select>
              </label>
              <label className="auth-field">
                <span>Format</span>
                <select defaultValue="video" name="content_format">
                  <option value="video">Vidéo</option>
                  <option value="photo">Photo</option>
                  <option value="story">Story</option>
                </select>
              </label>
              <label className="auth-field">
                <span>État initial</span>
                <select defaultValue="draft" name="status">
                  <option value="draft">Brouillon</option>
                  <option value="scheduled">Planifier</option>
                </select>
              </label>
              <label className="auth-field">
                <span>Date prévue (si planifiée)</span>
                <input name="scheduled_date" type="date" />
              </label>
              <label className="auth-field communication-form-wide">
                <span>Légende</span>
                <textarea maxLength={5000} minLength={2} name="caption" placeholder="Présentez votre contenu et votre message…" required rows={4} />
              </label>
              <label className="auth-field communication-form-wide">
                <span>Hashtags (facultatif)</span>
                <input maxLength={1000} name="hashtags" placeholder="#Oulimata #AloeVera" />
              </label>
              <label className="auth-field communication-media-input communication-form-wide">
                <span>Média (facultatif)</span>
                <input accept="image/jpeg,image/png,image/webp,video/mp4" name="media" type="file" />
                <small>JPG, PNG, WebP ou MP4 · {formatUploadLimit(MAX_MEDIA_UPLOAD_BYTES)} maximum · aucun envoi automatique vers les réseaux.</small>
              </label>
              <div className="communication-create-actions communication-form-wide">
                <span>Le contenu reste privé dans l’espace de travail de l’organisation.</span>
                <button className="button-primary" disabled={createPost.isPending} type="submit">
                  <Plus size={15} /> {createPost.isPending ? "Enregistrement…" : "Enregistrer le contenu"}
                </button>
              </div>
            </form>
          </details>

          <section className="panel communication-planner-panel" aria-labelledby="communication-planner-title">
            <div className="communication-planner-heading">
              <div>
                <p className="eyebrow">Calendrier éditorial</p>
                <h2 id="communication-planner-title">Vos contenus</h2>
                <p>{posts.data?.total ?? 0} contenu(s) dans cette vue</p>
              </div>
              <div className="communication-filters">
                <label>
                  <span className="visually-hidden">Filtrer par état</span>
                  <select
                    className="select-compact"
                    onChange={(event) => {
                      setFilter(event.currentTarget.value as PostFilter);
                      setPage(1);
                    }}
                    value={filter}
                  >
                    {filterOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="visually-hidden">Filtrer par réseau social</span>
                  <select
                    className="select-compact"
                    onChange={(event) => {
                      setPlatform(event.currentTarget.value as SocialPlatform | "all");
                      setPage(1);
                    }}
                    value={platform}
                  >
                    <option value="all">Tous les réseaux</option>
                    <option value="tiktok">TikTok</option>
                    <option value="facebook">Facebook</option>
                    <option value="both">TikTok + Facebook</option>
                  </select>
                </label>
              </div>
            </div>
            <label className="sales-search communication-search">
              <Search size={15} aria-hidden="true" />
              <span className="visually-hidden">Rechercher un contenu</span>
              <input onChange={(event) => { setSearch(event.currentTarget.value); setPage(1); }} placeholder="Titre, légende ou hashtag" type="search" value={search} />
            </label>

            {posts.isError ? (
              <div className="dashboard-error" role="alert">
                <p>{getApiErrorMessage(posts.error)}</p>
                <button className="button-secondary" type="button" onClick={() => void posts.refetch()}>Réessayer</button>
              </div>
            ) : posts.isPending ? (
              <p className="dashboard-loading" role="status">Chargement du planning…</p>
            ) : rows.length ? (
              <div className="communication-post-grid">
                {rows.map((post) => (
                  <article className="communication-post-card" key={post.id}>
                    <div className="communication-post-media">
                      <PostMedia organizationId={organizationId ?? ""} post={post} />
                      <span className={`communication-status-badge ${post.status}`}>{statusLabels[post.status]}</span>
                    </div>
                    <div className="communication-post-body">
                      <div className="communication-post-meta">
                        <span className={`communication-platform-badge ${post.platform}`}>
                          <PlatformMark platform={post.platform} /> {platformLabels[post.platform]}
                        </span>
                        <span className="communication-format-label">
                          {post.content_format === "video" ? <Video size={13} /> : <FileImage size={13} />}
                          {formatLabels[post.content_format]}
                        </span>
                      </div>
                      <h3>{post.title}</h3>
                      <p className="communication-post-caption">{post.caption}</p>
                      {post.hashtags ? <p className="communication-post-hashtags">{post.hashtags}</p> : null}
                      <div className="communication-post-date">
                        <Clock3 size={14} />
                        {post.status === "published" && post.published_at
                          ? `Publiée le ${formatPublishedDate(post.published_at)}`
                          : post.scheduled_date
                            ? `${post.status === "scheduled" ? "Prévue le" : "Date cible"} ${formatLongDate(post.scheduled_date)}`
                            : "Date de publication à définir"}
                      </div>
                      {post.published_url ? (
                        <a className="communication-published-link" href={post.published_url} rel="noopener noreferrer" target="_blank">
                          Voir la publication <ArrowUpRight size={13} />
                        </a>
                      ) : null}
                      <div className="communication-post-actions">
                        {post.status !== "published" ? (
                          <>
                            <button
                              className="communication-action"
                              onClick={() => { setFormError(null); setDialog({ mode: "edit", post }); }}
                              type="button"
                            >
                              <Pencil size={14} /> Modifier
                            </button>
                            <label className="communication-action communication-upload-action">
                              <FileImage size={14} /> {post.media_url ? "Remplacer média" : "Ajouter média"}
                              <input
                                accept="image/jpeg,image/png,image/webp,video/mp4"
                                disabled={uploadMedia.isPending || post.status === "archived"}
                                onChange={(event) => {
                                  const file = event.currentTarget.files?.[0];
                                  if (file && file.size > MAX_MEDIA_UPLOAD_BYTES) {
                                    setFormError(MEDIA_SIZE_ERROR);
                                  } else if (file) {
                                    uploadMedia.mutate({ postId: post.id, mediaFile: file });
                                  }
                                  event.currentTarget.value = "";
                                }}
                                type="file"
                              />
                            </label>
                            {post.status !== "archived" ? (
                              <button
                                className="communication-action publish"
                                onClick={() => { setFormError(null); setDialog({ mode: "publish", post }); }}
                                type="button"
                              >
                                <Send size={14} /> Publiée
                              </button>
                            ) : null}
                            {post.status === "draft" || post.status === "archived" ? (
                              <button
                                aria-label={`Supprimer ${post.title}`}
                                className="communication-action delete"
                                onClick={() => { setFormError(null); setDialog({ mode: "delete", post }); }}
                                type="button"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {post.media_url && post.status !== "published" ? (
                          <button
                            className="communication-action delete"
                            disabled={removeMedia.isPending}
                            onClick={() => removeMedia.mutate(post.id)}
                            type="button"
                          >
                            Retirer média
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="communication-empty">
                <span><Megaphone size={22} /></span>
                <h3>{search || filter !== "all" || platform !== "all" ? "Aucun contenu correspondant" : "Le planning est prêt"}</h3>
                <p>
                  {search || filter !== "all" || platform !== "all"
                    ? "Modifiez les filtres ou votre recherche."
                    : "Préparez un brouillon ou planifiez votre première publication TikTok ou Facebook."}
                </p>
              </div>
            )}
            {totalPages > 1 ? (
              <nav className="stocks-pagination communication-pagination" aria-label="Pagination des contenus">
                <button disabled={page === 1} onClick={() => setPage((current) => current - 1)} type="button">Précédent</button>
                <span>Page {page} sur {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} type="button">Suivant</button>
              </nav>
            ) : null}
          </section>
        </>
      ) : null}

      {dialog ? (
        <dialog
          aria-labelledby="communication-dialog-title"
          className="parcel-edit-dialog communication-dialog"
          onClose={() => { setDialog(null); setFormError(null); }}
          onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
          ref={dialogRef}
        >
          <div className="parcel-edit-dialog-content">
            <div className="parcel-edit-dialog-heading">
              <div>
                <h2 id="communication-dialog-title">
                  {dialog.mode === "edit" ? "Modifier le contenu" : dialog.mode === "publish" ? "Confirmer la publication" : "Supprimer le brouillon ?"}
                </h2>
                <p>{dialog.post.title}</p>
              </div>
              <button aria-label="Fermer" className="parcel-edit-dialog-close" onClick={() => dialogRef.current?.close()} type="button">×</button>
            </div>
            <form
              className="communication-dialog-form"
              key={`${dialog.mode}-${dialog.post.id}`}
              onSubmit={submitDialog}
            >
              {dialog.mode === "edit" ? (
                <>
                  <label className="auth-field communication-dialog-wide">
                    <span>Titre interne</span>
                    <input defaultValue={dialog.post.title} maxLength={160} minLength={2} name="title" required />
                  </label>
                  <label className="auth-field">
                    <span>Réseau</span>
                    <select defaultValue={dialog.post.platform} name="platform">
                      <option value="tiktok">TikTok</option>
                      <option value="facebook">Facebook</option>
                      <option value="both">TikTok et Facebook</option>
                    </select>
                  </label>
                  <label className="auth-field">
                    <span>Format</span>
                    <select defaultValue={dialog.post.content_format} name="content_format">
                      <option value="video">Vidéo</option>
                      <option value="photo">Photo</option>
                      <option value="story">Story</option>
                    </select>
                  </label>
                  <label className="auth-field">
                    <span>État</span>
                    <select defaultValue={dialog.post.status} name="status">
                      <option value="draft">Brouillon</option>
                      <option value="scheduled">Planifiée</option>
                      <option value="archived">Archivée</option>
                    </select>
                  </label>
                  <label className="auth-field">
                    <span>Date prévue</span>
                    <input defaultValue={dialog.post.scheduled_date ?? ""} name="scheduled_date" type="date" />
                  </label>
                  <label className="auth-field communication-dialog-wide">
                    <span>Légende</span>
                    <textarea defaultValue={dialog.post.caption} maxLength={5000} minLength={2} name="caption" required rows={4} />
                  </label>
                  <label className="auth-field communication-dialog-wide">
                    <span>Hashtags</span>
                    <input defaultValue={dialog.post.hashtags ?? ""} maxLength={1000} name="hashtags" />
                  </label>
                </>
              ) : dialog.mode === "publish" ? (
                <div className="communication-dialog-wide communication-publish-confirm">
                  <p>
                    Après avoir publié ce contenu manuellement sur {platformLabels[dialog.post.platform]},
                    confirmez ici pour conserver sa date et son lien dans l’historique.
                  </p>
                  <label className="auth-field">
                    <span>Lien de la publication (facultatif)</span>
                    <input name="published_url" placeholder="https://…" type="url" />
                  </label>
                </div>
              ) : (
                <div className="communication-dialog-wide communication-delete-confirm">
                  <p>Ce contenu et son média seront supprimés définitivement. Les publications déjà publiées restent conservées.</p>
                </div>
              )}
              {formError ? <p className="auth-error communication-dialog-wide" role="alert">{formError}</p> : null}
              <div className="parcel-edit-dialog-actions communication-dialog-wide">
                <button className="button-secondary" onClick={() => dialogRef.current?.close()} type="button">Annuler</button>
                <button
                  className={dialog.mode === "delete" ? "button-danger" : "button-primary"}
                  disabled={isMutating}
                  type={dialog.mode === "delete" ? "button" : "submit"}
                  onClick={dialog.mode === "delete" ? () => deletePost.mutate(dialog.post.id) : undefined}
                >
                  {dialog.mode === "edit"
                    ? updatePost.isPending ? "Enregistrement…" : "Enregistrer"
                    : dialog.mode === "publish"
                      ? markPublished.isPending ? "Confirmation…" : "Confirmer publiée"
                      : deletePost.isPending ? "Suppression…" : "Supprimer le brouillon"}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
