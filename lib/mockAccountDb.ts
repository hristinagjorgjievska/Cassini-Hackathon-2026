export type IndicatorStatus = "healthy" | "warning" | "critical";

export type Account = {
  id: string;
  name: string;
  email: string;
  region: string;
  memberSince: string;
};

export type Indicator = {
  id: string;
  label: string;
  value: number;
  unit: string;
  target: number;
  warningDelta: number;
  criticalDelta: number;
};

export type IndicatorWithStatus = Indicator & {
  status: IndicatorStatus;
};

export type DashboardPayload = {
  account: Account;
  indicators: IndicatorWithStatus[];
  summary: {
    totalPointers: number;
    averagePh: number;
    alertCount: number;
    overallStatus: IndicatorStatus;
    generatedAt: string;
  };
};

const db: Record<string, { account: Account; indicators: Indicator[] }> = {
  "demo-1": {
    account: {
      id: "demo-1",
      name: "Marko",
      email: "marko@example.com",
      region: "Ohrid",
      memberSince: "2024-02-18",
    },
    indicators: [
      {
        id: "ph-ohrid",
        label: "Ohrid Lake pH",
        value: 7.4,
        unit: "pH",
        target: 7.0,
        warningDelta: 0.6,
        criticalDelta: 1.2,
      },
      {
        id: "ph-vardar",
        label: "Vardar pH",
        value: 8.3,
        unit: "pH",
        target: 7.0,
        warningDelta: 0.6,
        criticalDelta: 1.2,
      },
      {
        id: "temp-ohrid",
        label: "Ohrid Temperature",
        value: 23.5,
        unit: "C",
        target: 21.0,
        warningDelta: 2.0,
        criticalDelta: 4.0,
      },
      {
        id: "turbidity-ohrid",
        label: "Ohrid Turbidity",
        value: 4.1,
        unit: "NTU",
        target: 2.0,
        warningDelta: 1.5,
        criticalDelta: 3.0,
      },
    ],
  },
};

function calcStatus(indicator: Indicator): IndicatorStatus {
  const diff = Math.abs(indicator.value - indicator.target);
  if (diff >= indicator.criticalDelta) return "critical";
  if (diff >= indicator.warningDelta) return "warning";
  return "healthy";
}

function calcOverallStatus(items: IndicatorWithStatus[]): IndicatorStatus {
  if (items.some((i) => i.status === "critical")) return "critical";
  if (items.some((i) => i.status === "warning")) return "warning";
  return "healthy";
}

export async function getAccountDashboard(
  accountId: string,
): Promise<DashboardPayload | null> {
  const record = db[accountId];
  if (!record) return null;

  const indicatorsWithStatus = record.indicators.map((indicator) => ({
    ...indicator,
    status: calcStatus(indicator),
  }));

  const phItems = indicatorsWithStatus.filter((item) => item.unit === "pH");
  const averagePh =
    phItems.length > 0
      ? Number(
        (
          phItems.reduce((sum, item) => sum + item.value, 0) / phItems.length
        ).toFixed(2),
      )
      : 0;

  const alertCount = indicatorsWithStatus.filter(
    (item) => item.status !== "healthy",
  ).length;

  return {
    account: record.account,
    indicators: indicatorsWithStatus,
    summary: {
      totalPointers: indicatorsWithStatus.length,
      averagePh,
      alertCount,
      overallStatus: calcOverallStatus(indicatorsWithStatus),
      generatedAt: new Date().toISOString(),
    },
  };
}
