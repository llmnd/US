"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Leaf, LoaderCircle } from "lucide-react";
import {
  apiRequest,
  getApiErrorMessage,
  type UserProfile,
} from "@/lib/api/client";

function AuthBrand() {
  return (
    <Link className="auth-brand" href="/" aria-label="Mamari, accueil">
      <span className="brand-mark">
        <Leaf size={19} strokeWidth={2.2} />
      </span>
      <span className="brand-name">mamari</span>
    </Link>
  );
}

function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <main className="auth-page">
      <section className="auth-visual" aria-hidden="true">
        <Image
          className="auth-visual-main"
          src="/images/login-corn.png"
          alt=""
          fill
          priority
          sizes="(max-width: 860px) 100vw, 55vw"
        />

        <div className="auth-visual-shade" />

        <div className="auth-visual-mark">
          <Leaf size={16} strokeWidth={1.8} />
          <span>mamari</span>
        </div>

        <div className="auth-photo-card auth-photo-card-tractor">
          <Image
            src="/images/login-tractor.png"
            alt=""
            fill
            sizes="(max-width: 860px) 24vw, 14vw"
          />
        </div>
        <div className="auth-photo-card auth-photo-card-cows">
          <Image
            src="/images/login-cows.png"
            alt=""
            fill
            sizes="(max-width: 860px) 24vw, 14vw"
          />
        </div>

        <div className="auth-visual-copy">
          <span>Au rythme de vos saisons</span>
          <p>La sérénité de piloter votre activité, simplement.</p>
        </div>
      </section>

      <section className="auth-content">
        <div className="auth-card">
          <AuthBrand />
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-title">{title}</h1>
          <p className="page-description">{description}</p>
          {children}
        </div>
        <p className="auth-footer">
          Mamari · Le pilotage clair de votre entreprise.
        </p>
      </section>
    </main>
  );
}

export function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const profile = await apiRequest<UserProfile>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username")?.toString(),
          password: formData.get("password")?.toString(),
        }),
      });
      queryClient.setQueryData(["auth", "me"], profile);
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const destination =
        requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
          ? requestedPath
          : "/dashboard";
      router.replace(destination);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Votre espace de travail"
      title="Ravi de vous retrouver"
      description="Connectez-vous pour accéder au pilotage de votre entreprise."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span>Identifiant</span>
          <input
            autoComplete="username"
            autoFocus
            defaultValue="mamari"
            name="username"
            placeholder="mamari"
            required
            type="text"
          />
        </label>
        <label className="auth-field">
          <span>Mot de passe</span>
          <input
            autoComplete="current-password"
            minLength={6}
            name="password"
            placeholder="Votre mot de passe"
            required
            type="password"
          />
        </label>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="button-primary auth-submit"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <LoaderCircle className="auth-spinner" size={16} />
          ) : null}
          Se connecter
          {!isSubmitting ? <ArrowRight size={16} /> : null}
        </button>
      </form>
      <p className="auth-switch">
        Accès réservé aux utilisateurs de Mamari.
      </p>
    </AuthLayout>
  );
}