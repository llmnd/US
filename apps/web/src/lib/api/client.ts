const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface OrganizationMembership {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: "owner" | "admin" | "manager" | "operator" | "reader";
}

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  memberships: OrganizationMembership[];
  customer_account: boolean;
}

export function getApiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    if (error instanceof TypeError) {
      return "Impossible de joindre l’API Mamari. Vérifiez que le serveur API est démarré et que son adresse est correcte.";
    }
    return "Une erreur inattendue est survenue. Réessayez.";
  }

  if (typeof error.details === "object" && error.details !== null && "detail" in error.details) {
    const detail = error.details.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          typeof item === "object" && item !== null && "msg" in item
            ? String(item.msg)
            : "",
        )
        .filter(Boolean);
      if (messages.length) return messages.join(" ");
    }
  }

  return error.message;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const details: unknown = await response.json().catch(() => undefined);
    throw new ApiError(
      `La requête API a échoué (${response.status}).`,
      response.status,
      details,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiBlobRequest(
  path: string,
  init?: RequestInit,
): Promise<Blob> {
  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      Accept: "image/*",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const details: unknown = await response.json().catch(() => undefined);
    throw new ApiError(
      `La requête API a échoué (${response.status}).`,
      response.status,
      details,
    );
  }
  return response.blob();
}
