"use client";

import { useRef, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, getApiErrorMessage } from "@/lib/api/client";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const changePassword = useMutation({
    mutationFn: (passwords: { current_password: string; new_password: string }) =>
      apiRequest<{ message: string }>("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwords),
      }),
    onSuccess: (response) => {
      formRef.current?.reset();
      setValidationError(null);
      setSuccess(response.message);
    },
    onError: () => setSuccess(null),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    setValidationError(null);
    const formData = new FormData(event.currentTarget);
    const currentPassword = formData.get("current_password")?.toString() ?? "";
    const newPassword = formData.get("new_password")?.toString() ?? "";
    const confirmation = formData.get("password_confirmation")?.toString() ?? "";
    if (newPassword !== confirmation) {
      setValidationError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    changePassword.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  return (
    <form className="password-change-form" onSubmit={handleSubmit} ref={formRef}>
      <label>
        <span>Mot de passe actuel</span>
        <input autoComplete="current-password" maxLength={128} minLength={6} name="current_password" required type="password" />
      </label>
      <label>
        <span>Nouveau mot de passe</span>
        <input autoComplete="new-password" maxLength={128} minLength={6} name="new_password" required type="password" />
      </label>
      <label>
        <span>Confirmer le nouveau mot de passe</span>
        <input autoComplete="new-password" maxLength={128} minLength={6} name="password_confirmation" required type="password" />
      </label>
      {validationError ? <p className="password-change-error" role="alert">{validationError}</p> : null}
      {changePassword.isError ? (
        <p className="password-change-error" role="alert">{getApiErrorMessage(changePassword.error)}</p>
      ) : null}
      {success ? <p className="password-change-success" role="status">{success}</p> : null}
      <button className="button-primary" disabled={changePassword.isPending} type="submit">
        {changePassword.isPending ? "Modification en cours…" : "Modifier le mot de passe"}
      </button>
    </form>
  );
}
