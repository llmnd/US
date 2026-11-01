"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Coins,
  Factory,
  Image,
  LayoutDashboard,
  Leaf,
  LogOut,
  Package,
  Settings2,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import {
  ApiError,
  apiRequest,
  getApiErrorMessage,
  type UserProfile,
} from "@/lib/api/client";

const navigation = [
  { label: "Vue d'ensemble", href: "/", icon: LayoutDashboard },
  { label: "Opérations", href: "/operations", icon: ClipboardList },
  { label: "Agriculture", href: "/agriculture", icon: Leaf },
  { label: "Élevage", href: "/elevage", icon: Activity },
  { label: "Stocks", href: "/stocks", icon: Package },
  { label: "Productions", href: "/productions", icon: Factory },
  { label: "Ventes", href: "/ventes", icon: ShoppingCart },
  { label: "Finances", href: "/finances", icon: Coins },
  { label: "Ressources humaines", href: "/rh", icon: UsersRound },
  { label: "Communication", href: "/communication", icon: Image },
  { label: "Entreprise", href: "/entreprise", icon: Building2 },
  { label: "Administration", href: "/administration", icon: Settings2 },
];

const roleLabels = {
  owner: "Propriétaire",
  admin: "Administratrice",
  manager: "Gestionnaire",
  operator: "Opérateur",
  reader: "Lecture seule",
} as const;

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isPublicRoute = pathname === "/login";
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    enabled: !isPublicRoute,
    retry: false,
  });

  useEffect(() => {
    if (!isPublicRoute && profile.error instanceof ApiError && profile.error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isPublicRoute, pathname, profile.error, router]);

  if (isPublicRoute) return <>{children}</>;

  if (profile.isPending) {
    return (
      <div className="auth-loading" role="status">
        <span className="brand-mark">
          <Leaf size={19} />
        </span>
        <span>Chargement de votre espace…</span>
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <div className="auth-loading">
        <p className="auth-error">{getApiErrorMessage(profile.error)}</p>
        <button className="button-primary" type="button" onClick={() => void profile.refetch()}>
          Réessayer
        </button>
      </div>
    );
  }

  const membership = profile.data.memberships[0];
  if (!membership) {
    return (
      <div className="auth-loading">
        <p className="auth-error">Aucune organisation active n&apos;est associée à votre compte.</p>
        <button
          className="button-secondary"
          type="button"
          onClick={() => router.replace("/login")}
        >
          Retour à la connexion
        </button>
      </div>
    );
  }

  const currentPage =
    navigation.find((item) => item.href === pathname)?.label ?? "Vue d'ensemble";

  async function handleLogout() {
    if (logoutPending) return;
    setLogoutError(null);
    setLogoutPending(true);
    try {
      await apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
      queryClient.clear();
      router.replace("/login");
    } catch (error) {
      setLogoutError(getApiErrorMessage(error));
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navigation principale">
        <Link className="brand" href="/" aria-label="Mamari, accueil">
          <span className="brand-mark">
            <Leaf size={19} strokeWidth={2.2} />
          </span>
          <span>
            <span className="brand-name">mamari</span>
            <span className="brand-caption">Gestion d&apos;entreprise</span>
          </span>
        </Link>

        <nav aria-label="Modules">
          <div className="nav-label">Espace de travail</div>
          <div className="nav-list">
            {navigation.map(({ label, href, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  className="nav-link"
                  href={href}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="sidebar-footer">
          <Link className="nav-link" href="/aide">
            <CircleHelp size={17} strokeWidth={1.8} />
            <span>Centre d&apos;aide</span>
            <ChevronRight size={14} className="nav-badge" />
          </Link>
          <div className="profile">
            <span className="profile-avatar">
              {profile.data.full_name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0))
                .join("")
                .toLocaleUpperCase("fr")}
            </span>
            <span className="profile-copy">
              <strong title={profile.data.full_name}>{profile.data.full_name}</strong>
              <span title={profile.data.username}>
                {roleLabels[membership.role]} · {profile.data.username}
              </span>
            </span>
            <button
              className="profile-logout"
              type="button"
              onClick={() => void handleLogout()}
              disabled={logoutPending}
              aria-label={logoutPending ? "Déconnexion en cours" : "Se déconnecter"}
              aria-busy={logoutPending}
              title="Se déconnecter"
            >
              <LogOut size={15} aria-hidden="true" />
              <span>{logoutPending ? "Déconnexion…" : "Se déconnecter"}</span>
            </button>
          </div>
          {logoutError ? <p className="logout-error" role="alert">{logoutError}</p> : null}
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{membership.organization_name}</span>
            <ChevronRight size={14} />
            <strong>{currentPage}</strong>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Calendrier">
              <CalendarDays size={16} />
            </button>
            <button className="icon-button" type="button" aria-label="Notifications">
              <Bell size={16} />
            </button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
