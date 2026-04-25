import { regions, getDisturbanceColor, disturbanceColors, disturbanceDescriptions } from "@/lib/waterData";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function MyWaterPage() {
  // Flatten all water sources across all regions into a single list
  const allWaterSources = Object.values(regions).flatMap((region) => region.waterSources);
  // Optional: deduplicate by label to avoid showing identical items if they are repeated
  const uniqueWaterSources = Array.from(new Map(allWaterSources.map((ws) => [ws.label, ws])).values());

  return (
    <ProtectedRoute>
      <section className="min-h-[calc(100vh-4rem)] w-full bg-[#f8fafc] p-6 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#1e293b]">Water Status Dashboard</h1>
          <p className="mt-2 text-[#64748b]">Real-time disturbance reports for all monitored water viewing points.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {uniqueWaterSources.map((source) => {
            const badgeColor = getDisturbanceColor(source.disturbancePercentage);
            return (
              <div
                key={source.id + source.label}
                className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <h2 className="text-xl font-semibold text-slate-800">{source.label}</h2>
                  <div
                    className="flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: badgeColor }}
                  >
                    {source.disturbancePercentage}%
                  </div>
                </div>

                {source.disturbances.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Disturbances</h3>
                    <ul className="flex flex-col gap-3">
                      {source.disturbances.map((d) => (
                        <li key={d.id} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                          <div
                            className="mt-1 h-3 w-3 shrink-0 rounded-full shadow-sm"
                            style={{ backgroundColor: disturbanceColors[d.type] }}
                          />
                          <span className="text-sm leading-relaxed text-slate-700">
                            {disturbanceDescriptions[d.type]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    Water source is clear of disturbances.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
    </ProtectedRoute>
  );
}