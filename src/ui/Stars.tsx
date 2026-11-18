export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span className="stars" aria-label={`${n} av ${max} stjerner`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? "star on" : "star"} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}
