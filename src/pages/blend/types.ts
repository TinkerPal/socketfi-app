export type AppNetwork = "PUBLIC" | "TESTNET";
export type BlendAction = "supply" | "withdraw" | "borrow" | "repay";
export type SortMode = "tvl" | "yield" | "borrow" | "utilization";
export type PoolFilter = "all" | "active" | "on_ice" | "frozen";

export type Reserve = {
  asset: string;
  index: number;
  symbol: string;
  name: string;
  decimals: number;
  supplyApr: number | null;
  supplyApy: number | null;
  borrowApr: number | null;
  borrowApy: number | null;
  utilizationPercent: number | null;
  collateralFactorPercent: number | null;
  liabilityFactorPercent: number | null;
  totalSupply: number;
  totalBorrow: number;
  availableLiquidity: number;
  priceUsd: number | null;
  suppliedUsd: number | null;
  borrowedUsd: number | null;
};

export type Pool = {
  id: string;
  name: string;
  network: AppNetwork;
  version: string;
  status: number | null;
  statusLabel: "ACTIVE" | "ON_ICE" | "FROZEN" | "UNKNOWN";
  active: boolean;
  canSupply: boolean;
  canWithdraw: boolean;
  canBorrow: boolean;
  canRepay: boolean;
  reserveCount: number;
  suppliedUsd: number | null;
  borrowedUsd: number | null;
  backstopUsd: number | null;
  utilizationPercent: number | null;
  bestSupplyApr: number | null;
  lowestBorrowApr: number | null;
  reserves: Reserve[];
};

export type Dashboard = {
  activePools: number;
  onIcePools: number;
  frozenPools: number;
  unknownPools: number;
  totalPools: number;
  totalSuppliedUsd: number | null;
  totalBorrowedUsd: number | null;
  totalBackstopUsd: number | null;
  bestOpportunity: null | {
    poolId: string;
    poolName: string;
    symbol: string;
    supplyApr: number;
  };
};

export type UserReserve = Reserve & {
  balance: string | number;
  supplied: string;
  collateral: string;
  borrowed: string;
};
