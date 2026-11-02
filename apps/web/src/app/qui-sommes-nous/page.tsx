import type { Metadata } from "next";
import { AboutPage } from "@/features/store/store-pages";

export const metadata: Metadata = {
  title: "Qui sommes-nous ?",
  description:
    "Découvrez l’histoire humaine et agricole de Mamari, portée par le terrain, l’apprentissage et le travail partagé.",
};

export default function AboutRoute() {
  return <AboutPage />;
}
