"use client";

import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath = "/" }: LoginFormProps) {
  return (
    <form action={loginAction} className="space-y-5">
      <input name="next" type="hidden" value={nextPath} />

      <div>
        <label className="field-label" htmlFor="email">
          Work Email
        </label>
        <input className="input-field" id="email" name="email" placeholder="team@nexttrading.local" required type="email" />
      </div>

      <div>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input className="input-field" id="password" name="password" placeholder="Enter your password" required type="password" />
      </div>

      <SubmitButton className="btn-primary w-full" pendingLabel="Signing in...">
        Sign In
      </SubmitButton>
    </form>
  );
}

