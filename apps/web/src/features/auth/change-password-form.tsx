"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, KeyRound } from "lucide-react";
import { apiRequest, getApiErrorMessage } from "@/lib/api/client";

export function ChangePasswordForm() {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
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
    <div className="password-change">
      <button
        aria-label={isOpen ? "Fermer le formulaire de changement de mot de passe" : "Modifier le mot de passe"}
        aria-controls={formId}
        aria-expanded={isOpen}
        className="password-change-toggle"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <KeyRound size={16} aria-hidden="true" />
        <span>{isOpen ? "Fermer le formulaire" : "Modifier le mot de passe"}</span>
        {isOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
      {isOpen ? (
        <form className="password-change-form" id={formId} onSubmit={handleSubmit} ref={formRef}>
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
            {changePassword.isPending ? "Modification en cours…" : "Enregistrer le nouveau mot de passe"}
          </button>
        </form>
      ) : success ? <p className="password-change-success" role="status">{success}</p> : null}
    </div>
  );
}
