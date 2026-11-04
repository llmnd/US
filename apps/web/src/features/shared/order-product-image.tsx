"use client";

import Image from "next/image";
import { Sprout } from "lucide-react";
import { useProductPhoto } from "@/features/store/use-product-photo";

export function OrderProductImage({
  name,
  photoPath,
  organizationId,
}: {
  name: string;
  photoPath: string | null;
  organizationId?: string;
}) {
  const { imageUrl } = useProductPhoto(photoPath, organizationId);

  return (
    <span className="order-product-image">
      {imageUrl ? (
        <Image alt={name} fill sizes="64px" src={imageUrl} unoptimized />
      ) : (
        <Sprout aria-hidden="true" size={20} strokeWidth={1.6} />
      )}
    </span>
  );
}
