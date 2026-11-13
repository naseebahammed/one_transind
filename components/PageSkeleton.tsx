export function PageSkeleton({
  kpis = 4,
  hasFilters = false,
  panels = 2,
}: {
  kpis?: number;
  hasFilters?: boolean;
  panels?: number;
}) {
  return (
    <div aria-busy="true" aria-label="Loading content" style={{ display: "grid", gap: 16 }}>
      {hasFilters && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="skeleton" style={{ width: 90, height: 32, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 130, height: 32, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 140, height: 32, borderRadius: 8 }} />
        </div>
      )}
      {kpis > 0 && (
        <div className="kpis">
          {Array.from({ length: kpis }).map((_, i) => (
            <div key={i} className="kpi" style={{ minHeight: 90, display: "grid", gap: 8 }}>
              <div className="skeleton" style={{ width: "45%", height: 13 }} />
              <div className="skeleton" style={{ width: "70%", height: 24 }} />
              <div className="skeleton" style={{ width: "35%", height: 11 }} />
            </div>
          ))}
        </div>
      )}
      <div className="grid">
        <div className="panel c12" style={{ minHeight: 240, display: "grid", gap: 14, alignContent: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="skeleton" style={{ width: 180, height: 18 }} />
            <div className="skeleton" style={{ width: 80, height: 14 }} />
          </div>
          <div className="skeleton" style={{ width: "100%", height: 170 }} />
        </div>
        {panels > 1 && (
          <>
            <div className="panel c7" style={{ minHeight: 220, display: "grid", gap: 14, alignContent: "start" }}>
              <div className="skeleton" style={{ width: 160, height: 18 }} />
              <div className="skeleton" style={{ width: "100%", height: 140 }} />
            </div>
            <div className="panel c5" style={{ minHeight: 220, display: "grid", gap: 14, alignContent: "start" }}>
              <div className="skeleton" style={{ width: 140, height: 18 }} />
              <div className="skeleton" style={{ width: "100%", height: 140 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
