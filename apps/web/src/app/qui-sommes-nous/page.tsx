import type { Metadata } from "next";
import { AboutPage } from "@/features/store/brand-pages";

export const metadata: Metadata = {
  title: "Qui sommes-nous ?",
  description: "Découvrez Oulimata, sa boutique en ligne et sa sélection de produits Aloe vera.",
};

export default function AboutRoute() {
  return <AboutPage />;
}
