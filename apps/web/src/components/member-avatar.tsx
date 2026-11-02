"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiBlobRequest } from "@/lib/api/client";

interface MemberAvatarProps {
  organizationId: string;
  userId: string;
  name: string;
  photoUrl: string | null;
  className?: string;
}

export function MemberAvatar({
  organizationId,
  userId,
  name,
  photoUrl,
  className = "",
}: MemberAvatarProps) {
  const image = useQuery({
    queryKey: ["member-photo", organizationId, userId, photoUrl],
    queryFn: async () => URL.createObjectURL(await apiBlobRequest(photoUrl!, {
      cache: "no-store",
      headers: { "X-Organization-ID": organizationId },
    })),
    enabled: Boolean(photoUrl),
    retry: false,
  });
  useEffect(() => {
    return () => {
      if (image.data) URL.revokeObjectURL(image.data);
    };
  }, [image.data]);

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("fr");

  return (
    <span
      className={`member-avatar ${className}`.trim()}
      aria-label={`Profil de ${name}`}
      title={photoUrl && image.isError ? `Photo de ${name} indisponible` : `Profil de ${name}`}
    >
      {image.data
        ? <Image src={image.data} alt="" width={48} height={48} unoptimized />
        : initials}
    </span>
  );
}
