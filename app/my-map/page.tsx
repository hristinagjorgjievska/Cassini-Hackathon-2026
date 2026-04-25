import { OhridMap } from "@/components/OhridMap";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function MyMapPage() {
  return (
    <ProtectedRoute>
      <section className="h-[calc(100vh-4rem)] w-full">
        <OhridMap />
      </section>
    </ProtectedRoute>
  );
}