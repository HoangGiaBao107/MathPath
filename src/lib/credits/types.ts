export type CreditOwner =
  { kind: "guest"; guestSessionId: string } | { kind: "user"; userId: string };

export type CreditBucket = "guest_free" | "account_free" | "purchased" | "plan_daily";

export type CreditReservation = {
  reservationId: string;
  owner: CreditOwner;
  bucket: CreditBucket;
  requestId: string;
};

export const creditPolicy = {
  timezone: "Asia/Ho_Chi_Minh",
  guestTotalRequests: 5,
  registeredFreeDailyRequests: 5,
  paidPlans: [
    { slug: "plus", name: "Plus", monthlyPriceVnd: 70_000, requestsPerDay: 15 },
    { slug: "pro", name: "Pro", monthlyPriceVnd: 100_000, requestsPerDay: 25 },
    { slug: "pro_max", name: "Pro Max", monthlyPriceVnd: 125_000, requestsPerDay: 50 },
  ],
} as const;

export interface CreditService {
  reserve(owner: CreditOwner, requestId: string): Promise<CreditReservation>;
  commit(reservationId: string, usageId: string): Promise<void>;
  release(reservationId: string, reason: string): Promise<void>;
}
