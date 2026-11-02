"use client";

import { useEffect, useState } from "react";
import { apiBlobRequest } from "@/lib/api/client";

export function useProductPhoto(photoPath: string | null, organizationId?: string) {
  const [photo, setPhoto] = useState<{
    path: string;
    url: string | null;
    hasError: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!photoPath) return;

    const request = organizationId
      ? apiBlobRequest(photoPath, {
          headers: { "X-Organization-ID": organizationId },
          cache: "no-store",
        })
      : apiBlobRequest(photoPath);

    void request.then((blob) => {
      if (active) {
        objectUrl = URL.createObjectURL(blob);
        setPhoto({ path: photoPath, url: objectUrl, hasError: false });
      }
    }).catch(() => {
      if (active) setPhoto({ path: photoPath, url: null, hasError: true });
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [organizationId, photoPath]);

  return {
    imageUrl: photo?.path === photoPath ? photo.url : null,
    hasError: photo?.path === photoPath && photo.hasError,
  };
}
