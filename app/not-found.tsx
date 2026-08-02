import Link from "next/link";

export default function NotFound() {
  return <main className="recovery-page"><section className="recovery-card"><span className="eyebrow">SURGICAL SOCIETY PÉCS</span><h1>Page not found</h1><p>The page may have moved. Return to the academy login to continue.</p><Link className="primary-button full-button" href="/">Return to the academy →</Link></section></main>;
}
