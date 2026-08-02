"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{12,128}$/;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("error")) {
      queueMicrotask(() => setMessage("This reset link has expired or has already been used. Request a new link from the login page."));
      return;
    }
    getSupabaseBrowserClient().auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setReady(Boolean(data.session));
      if (!data.session) setMessage("This reset link is no longer valid. Request a new link from the login page.");
    }).catch(() => setMessage("The secure reset session could not be opened."));
  }, []);

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordPattern.test(password)) {
      setMessage("Use at least 12 characters with uppercase, lowercase, a number and a symbol.");
      return;
    }
    if (password !== confirmation) {
      setMessage("The two passwords do not match.");
      return;
    }
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("Your password could not be changed. Request a new reset link and try again.");
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    router.replace("/?passwordUpdated=1");
  }

  return <main className="recovery-page">
    <section className="recovery-card" aria-labelledby="recovery-title">
      <Image src="/ssp-logo.png" width={118} height={118} alt="Surgical Society Pécs crest" priority />
      <span className="eyebrow">SECURE ACCOUNT RECOVERY</span>
      <h1 id="recovery-title">Choose a new password</h1>
      <p>Your new password protects your private learning record. Staff will still use their authenticator after signing in.</p>
      {message && <div className="recovery-message" role="status">{message}</div>}
      {ready && <form onSubmit={updatePassword}>
        <label className="form-field"><span>New password</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <small className="password-hint">At least 12 characters with uppercase, lowercase, a number and a symbol.</small>
        <label className="form-field"><span>Confirm new password</span><input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save password and return to login →"}</button>
      </form>}
      {!ready && <button className="secondary-button full-button" type="button" onClick={() => router.replace("/")}>Return to login</button>}
    </section>
  </main>;
}
