"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="recovery-page"><section className="recovery-card"><span className="eyebrow">SURGICAL SOCIETY PÉCS</span><h1>Something went wrong</h1><p>Your information has not been changed. Please try the page again.</p><button className="primary-button full-button" onClick={reset}>Try again →</button></section></main>;
}
