import { Map } from "@/components/ui/map";

export function OhridMap() {
    return (
        <div className="h-[500px] w-full">
            <Map center={[20.7922, 41.1231]} zoom={11} />
        </div>
    );
}