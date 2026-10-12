/** Money and share counts are stored as decimal strings to avoid float drift. */
export type DecimalString = string;
export interface Position { symbol: string; quantity: DecimalString; avgCost: DecimalString }
export type TxType = "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW" | "DIVIDEND";
export interface Transaction {
  id: string; ts: number; type: TxType; symbol?: string; quantity?: DecimalString;
  price?: DecimalString; amount: DecimalString; realized?: DecimalString; note?: string;
}
export type OrderSide = "BUY" | "SELL";
export type OrderKind = "LIMIT" | "STOP" | "TAKE_PROFIT";
export interface TargetOrder {
  id: string; symbol: string; side: OrderSide; kind: OrderKind; quantity: DecimalString;
  triggerPrice: DecimalString; status: "ACTIVE" | "FILLED" | "CANCELLED"; createdAt: number;
}
export interface ScheduledOrder {
  id: string; kind: "DCA" | "TOPUP"; symbol?: string; amount: DecimalString;
  frequency: "WEEKLY" | "MONTHLY"; day: number; lastRunTimestamp: number;
}
export interface PerformancePoint { date: string; value: number }
export interface Profile {
  id: string; name: string; currency: string; drip?: boolean; lastDivTs?: number; slippage?: number; demo?: [string, number][]; demoLive?: boolean; updatedAt?: number; fee?: number; currentCashBalance: DecimalString;
  startingCapital: DecimalString; createdAt: number; archived: boolean;
  positions: Position[]; transactions: Transaction[]; scheduledOrders: ScheduledOrder[];
  targetPriceOrders: TargetOrder[]; performanceHistory: PerformancePoint[];
}
export interface Quote { symbol: string; price: number; prevClose: number; ts: number; source: "live" | "mock" }
export interface Notice { id: string; text: string; tone: "good" | "bad" | "info" }
