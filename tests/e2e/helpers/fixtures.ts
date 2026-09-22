export const PRODUCT = {
  id: "product-1",
  name: "Growth Portfolio",
  target_annual_rate_bps: 2500,
  cycle_days: 180,
  status: "active",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

export function buildPosition(overrides: Partial<Record<string, unknown>> = {}) {
  const startDate = "2025-01-01T00:00:00.000Z";
  const maturityDate = "2025-06-30T00:00:00.000Z";
  return {
    position: {
      id: "position-1",
      user_id: "11111111-1111-4111-8111-111111111111",
      product_id: PRODUCT.id,
      principal_minor_units: "10000000",
      units: "10000000",
      start_date: startDate,
      maturity_date: maturityDate,
      status: "active",
      created_at: startDate,
      updated_at: startDate,
    },
    product: PRODUCT,
    elapsedDays: 60,
    remainingDays: 120,
    accruedReturn: "1000000",
    currentValue: "11000000",
    estimatedMaturityValue: "12500000",
    ...overrides,
  };
}

export function emptyDashboardSnapshot() {
  return {
    balances: { cash: "0", invested: "0", earnings: "0" },
    activePosition: null,
    product: PRODUCT,
    latestDeposit: null,
    portfolioValueMinorUnits: "0",
    totalEarningsMinorUnits: "0",
    todaysEarningsMinorUnits: "0",
  };
}

export function activeDashboardSnapshot() {
  return {
    balances: { cash: "0", invested: "10000000", earnings: "1000000" },
    activePosition: buildPosition(),
    product: PRODUCT,
    latestDeposit: null,
    portfolioValueMinorUnits: "11000000",
    totalEarningsMinorUnits: "1000000",
    todaysEarningsMinorUnits: "5000",
  };
}

export function performanceSeries() {
  const points = [];
  for (let i = 0; i <= 10; i++) {
    const date = new Date("2025-01-01T00:00:00.000Z");
    date.setDate(date.getDate() + i);
    points.push({ date: date.toISOString().slice(0, 10), value: String(10_000_000 + i * 10_000) });
  }
  return points;
}
