export default function Loading() {
  return <div className="page"><div className="skeleton skeleton-title" /><div className="grid grid-4">{[1,2,3,4].map((n) => <div className="skeleton skeleton-card" key={n} />)}</div></div>;
}
