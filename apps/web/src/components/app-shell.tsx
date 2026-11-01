"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Coins,
  Factory,
  Image,
  LayoutDashboard,
  Leaf,
  Package,
  Settings2,
  ShoppingCart,
  UsersRound,
} from "lucide-react";

const navigation = [
  { label: "Vue d'ensemble", href: "/", icon: LayoutDashboard },
  { label: "Opérations", href: "/operations", icon: ClipboardList, badge: "4" },
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

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const currentPage =
    navigation.find((item) => item.href === pathname)?.label ?? "Vue d'ensemble";

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

        <button className="workspace-switcher" type="button" aria-label="Entreprise active">
          <span className="workspace-avatar">AM</span>
          <span className="workspace-copy">
            <strong>AgriMariam</strong>
            <span>Entreprise principale</span>
          </span>
          <ChevronDown size={15} color="#879189" />
        </button>

        <nav aria-label="Modules">
          <div className="nav-label">Espace de travail</div>
          <div className="nav-list">
            {navigation.map(({ label, href, icon: Icon, badge }) => {
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
                  {badge ? <span className="nav-badge">{badge}</span> : null}
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
            <span className="profile-avatar">MD</span>
            <span className="profile-copy">
              <strong>Marie Diallo</strong>
              <span>Administratrice</span>
            </span>
            <ChevronDown size={15} color="#879189" />
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>AgriMariam</span>
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
