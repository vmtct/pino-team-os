"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <div className="card">
        <div className="eyebrow">PINO TEAM OS</div>
        <h1>Something went wrong.</h1>
        <p className="subtitle">Không thể tải dữ liệu lúc này.</p>
        <button className="button" onClick={() => reset()}>Try again</button>
      </div>
    </div>
  );
}
