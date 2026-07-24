"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath = "/" }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={loginAction} className="space-y-5">
      <input name="next" type="hidden" value={nextPath} />

      <div>
        <label className="field-label" htmlFor="identifier">
          Email/User Name
        </label>
        <input
          autoComplete="username"
          className="input-field"
          id="identifier"
          name="identifier"
          placeholder="team@nexttrading.local or haifang"
          required
          spellCheck={false}
          type="text"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <input
            autoComplete="current-password"
            className="input-field pr-12"
            id="password"
            name="password"
            placeholder="Enter your password"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:text-slate-700"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <SubmitButton className="btn-primary w-full" pendingLabel="Signing in...">
        Sign In
      </SubmitButton>
    </form>
  );
}
