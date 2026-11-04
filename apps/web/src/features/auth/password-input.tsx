"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput(props: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="password-input-wrap">
      <input {...props} type={isVisible ? "text" : "password"} />
      <button
        aria-label={isVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={isVisible}
        className="password-input-toggle"
        onClick={() => setIsVisible((visible) => !visible)}
        type="button"
      >
        {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  );
}
