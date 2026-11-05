import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";
import "lenis/dist/lenis.css";
import "./globals.css";
import "./refined.css";
import "./refined-plus.css";
import "./auth.css";
import "./public.css";

export const metadata: Metadata = {
  title: {
    default: "Oulimata — Boutique Aloe vera",
    template: "%s — Oulimata",
  },
  description:
    "Découvrez et commandez les produits Aloe vera de la boutique Oulimata.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
