import { z } from "zod";

/**
 * Campaign data layer.
 *
 * All values are MOCK / ANONYMIZED and hardcoded so the dashboard is fully
 * deterministic across reloads. No Math.random(), no network calls, no real
 * brand names. The numbers below are intentionally tuned so that a handful of
 * campaigns are clean and several carry deliberate billing / margin /
 * underdelivery / attention / supply risk — giving the risk engine real signal.
 */

export const CHANNELS = [
  "CTV",
  "Display",
  "Video",
  "Mobile",
  "Native",
  "High Impact",
] as const;

export const SUPPLY_QUALITY_FLAGS = ["ok", "review"] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD)");

/** Strongly-typed, validated schema for a single raw campaign record. */
export const campaignSchema = z
  .object({
    campaign_id: z.string().regex(/^CMP-\d{4}$/),
    advertiser: z.string().min(1),
    agency: z.string().min(1),
    channel: z.enum(CHANNELS),
    ad_format: z.string().min(1),
    start_date: isoDate,
    end_date: isoDate,
    booked_budget: z.number().nonnegative(),
    contracted_cpm: z.number().positive(),
    booked_impressions: z.number().int().positive(),
    delivered_impressions: z.number().int().nonnegative(),
    billable_impressions: z.number().int().nonnegative(),
    invoice_amount: z.number().positive(),
    publisher_cost: z.number().nonnegative(),
    data_cost: z.number().nonnegative(),
    creative_cost: z.number().nonnegative(),
    attention_score: z.number().min(0).max(100),
    supply_quality_flag: z.enum(SUPPLY_QUALITY_FLAGS),
  })
  .strict();

export type Channel = (typeof CHANNELS)[number];
export type SupplyQualityFlag = (typeof SUPPLY_QUALITY_FLAGS)[number];
export type Campaign = z.infer<typeof campaignSchema>;

const rawCampaigns: Campaign[] = [
  // ---- Clean campaigns (0 flags / Low risk) ------------------------------
  {
    campaign_id: "CMP-1001",
    advertiser: "Sample Streaming Brand",
    agency: "Meridian Media",
    channel: "CTV",
    ad_format: "30s Spot",
    start_date: "2026-01-06",
    end_date: "2026-03-01",
    booked_budget: 162000,
    contracted_cpm: 32.0,
    booked_impressions: 5_200_000,
    delivered_impressions: 5_150_000,
    billable_impressions: 5_000_000,
    invoice_amount: 158000,
    publisher_cost: 70000,
    data_cost: 8000,
    creative_cost: 6000,
    attention_score: 72,
    supply_quality_flag: "ok",
  },
  {
    campaign_id: "CMP-1002",
    advertiser: "Sample Retail Brand",
    agency: "Northpoint Group",
    channel: "Display",
    ad_format: "Responsive Display",
    start_date: "2026-01-13",
    end_date: "2026-02-28",
    booked_budget: 92000,
    contracted_cpm: 4.5,
    booked_impressions: 21_000_000,
    delivered_impressions: 20_500_000,
    billable_impressions: 20_000_000,
    invoice_amount: 88500,
    publisher_cost: 40000,
    data_cost: 6000,
    creative_cost: 3000,
    attention_score: 58,
    supply_quality_flag: "ok",
  },
  {
    campaign_id: "CMP-1003",
    advertiser: "Sample Auto Brand",
    agency: "Atlas Media Partners",
    channel: "Video",
    ad_format: "Instream Video",
    start_date: "2026-02-02",
    end_date: "2026-03-22",
    booked_budget: 55000,
    contracted_cpm: 18.0,
    booked_impressions: 3_100_000,
    delivered_impressions: 3_020_000,
    billable_impressions: 3_000_000,
    invoice_amount: 52500,
    publisher_cost: 26000,
    data_cost: 3000,
    creative_cost: 4000,
    attention_score: 65,
    supply_quality_flag: "ok",
  },
  {
    campaign_id: "CMP-1004",
    advertiser: "Sample Telecom Brand",
    agency: "Vantage Media",
    channel: "Mobile",
    ad_format: "Rewarded Video",
    start_date: "2026-02-10",
    end_date: "2026-04-05",
    booked_budget: 73000,
    contracted_cpm: 6.0,
    booked_impressions: 12_500_000,
    delivered_impressions: 12_300_000,
    billable_impressions: 12_000_000,
    invoice_amount: 69000,
    publisher_cost: 33000,
    data_cost: 5000,
    creative_cost: 2000,
    attention_score: 54,
    supply_quality_flag: "ok",
  },
  {
    campaign_id: "CMP-1012",
    advertiser: "Sample Apparel Brand",
    agency: "Harbor Media",
    channel: "Native",
    ad_format: "In-Feed Native",
    start_date: "2026-03-02",
    end_date: "2026-04-19",
    booked_budget: 41000,
    contracted_cpm: 9.0,
    booked_impressions: 4_600_000,
    delivered_impressions: 4_520_000,
    billable_impressions: 4_500_000,
    invoice_amount: 39500,
    publisher_cost: 20000,
    data_cost: 3000,
    creative_cost: 2000,
    attention_score: 60,
    supply_quality_flag: "ok",
  },

  // ---- Single / double flag campaigns (Medium risk) ----------------------
  {
    campaign_id: "CMP-1005",
    advertiser: "Sample Finance Brand",
    agency: "Crescent Media Group",
    channel: "High Impact",
    ad_format: "Cinematic Canvas",
    start_date: "2026-01-20",
    end_date: "2026-03-08",
    booked_budget: 112000,
    contracted_cpm: 28.0,
    booked_impressions: 4_100_000,
    delivered_impressions: 4_050_000,
    billable_impressions: 4_000_000,
    invoice_amount: 95000, // expected 112,000 -> gap 17,000 (billing risk)
    publisher_cost: 48000,
    data_cost: 6000,
    creative_cost: 7000,
    attention_score: 61,
    supply_quality_flag: "ok",
  },
  {
    campaign_id: "CMP-1006",
    advertiser: "Sample CPG Brand",
    agency: "Harbor Media",
    channel: "Display",
    ad_format: "Standard Banner",
    start_date: "2026-02-03",
    end_date: "2026-03-30",
    booked_budget: 40000,
    contracted_cpm: 5.0,
    booked_impressions: 8_200_000,
    delivered_impressions: 8_100_000,
    billable_impressions: 8_000_000,
    invoice_amount: 38000, // margin 0.118 + attention 42 (>$25k) risk
    publisher_cost: 28000,
    data_cost: 4000,
    creative_cost: 1500,
    attention_score: 42,
    supply_quality_flag: "ok",
  },
  {
    campaign_id: "CMP-1007",
    advertiser: "Sample Travel Brand",
    agency: "Meridian Media",
    channel: "Video",
    ad_format: "Outstream Video",
    start_date: "2026-01-27",
    end_date: "2026-03-15",
    booked_budget: 100000,
    contracted_cpm: 20.0,
    booked_impressions: 6_000_000,
    delivered_impressions: 5_000_000, // delivery 0.833 (underdelivery)
    billable_impressions: 5_000_000,
    invoice_amount: 90000, // expected 100,000 -> gap 10,000 (billing)
    publisher_cost: 45000,
    data_cost: 5000,
    creative_cost: 6000,
    attention_score: 55,
    supply_quality_flag: "ok",
  },
  {
    campaign_id: "CMP-1010",
    advertiser: "Sample Beauty Brand",
    agency: "Vantage Media",
    channel: "Native",
    ad_format: "In-Feed Native",
    start_date: "2026-02-17",
    end_date: "2026-04-12",
    booked_budget: 48000,
    contracted_cpm: 8.0,
    booked_impressions: 6_100_000,
    delivered_impressions: 6_000_000,
    billable_impressions: 6_000_000,
    invoice_amount: 47000, // margin 0.149 + supply review
    publisher_cost: 32000,
    data_cost: 6000,
    creative_cost: 2000,
    attention_score: 51,
    supply_quality_flag: "review",
  },
  {
    campaign_id: "CMP-1011",
    advertiser: "Sample Beverage Brand",
    agency: "Crescent Media Group",
    channel: "High Impact",
    ad_format: "Interscroller",
    start_date: "2026-03-09",
    end_date: "2026-04-26",
    booked_budget: 70000,
    contracted_cpm: 35.0,
    booked_impressions: 2_050_000,
    delivered_impressions: 2_020_000,
    billable_impressions: 2_000_000,
    invoice_amount: 68000, // attention 40 (>$25k) + supply review
    publisher_cost: 30000,
    data_cost: 4000,
    creative_cost: 5000,
    attention_score: 40,
    supply_quality_flag: "review",
  },
  {
    campaign_id: "CMP-1013",
    advertiser: "Sample Pharma Brand",
    agency: "Meridian Media",
    channel: "High Impact",
    ad_format: "Cinematic Canvas",
    start_date: "2026-02-24",
    end_date: "2026-04-19",
    booked_budget: 140000,
    contracted_cpm: 40.0,
    booked_impressions: 3_600_000,
    delivered_impressions: 3_560_000,
    billable_impressions: 3_500_000,
    invoice_amount: 118000, // expected 140,000 -> gap 22,000 (largest leakage)
    publisher_cost: 60000,
    data_cost: 7000,
    creative_cost: 8000,
    attention_score: 63,
    supply_quality_flag: "ok",
  },

  // ---- Multi-flag campaigns (High risk) ----------------------------------
  {
    campaign_id: "CMP-1008",
    advertiser: "Sample Gaming Brand",
    agency: "Northpoint Group",
    channel: "CTV",
    ad_format: "15s Spot",
    start_date: "2026-01-12",
    end_date: "2026-03-01",
    booked_budget: 130000,
    contracted_cpm: 30.0,
    booked_impressions: 5_000_000,
    delivered_impressions: 4_200_000, // delivery 0.84 (underdelivery)
    billable_impressions: 4_200_000,
    invoice_amount: 110000, // expected 126,000 -> gap 16,000 (billing) + margin 0.209
    publisher_cost: 70000,
    data_cost: 9000,
    creative_cost: 8000,
    attention_score: 38, // attention risk (>$25k)
    supply_quality_flag: "review", // supply risk -> 5 flags total
  },
  {
    campaign_id: "CMP-1009",
    advertiser: "Sample QSR Brand",
    agency: "Atlas Media Partners",
    channel: "Mobile",
    ad_format: "Interstitial",
    start_date: "2026-02-09",
    end_date: "2026-04-02",
    booked_budget: 90000,
    contracted_cpm: 7.0,
    booked_impressions: 15_000_000,
    delivered_impressions: 12_000_000, // delivery 0.80 (underdelivery)
    billable_impressions: 12_000_000,
    invoice_amount: 75000, // expected 84,000 -> gap 9,000 (billing) + margin 0.293
    publisher_cost: 40000,
    data_cost: 8000,
    creative_cost: 5000,
    attention_score: 44, // attention risk (>$25k) -> 4 flags
    supply_quality_flag: "ok",
  },
  {
    campaign_id: "CMP-1014",
    advertiser: "Sample Insurance Brand",
    agency: "Northpoint Group",
    channel: "Display",
    ad_format: "Standard Banner",
    start_date: "2026-03-16",
    end_date: "2026-05-10",
    booked_budget: 88000,
    contracted_cpm: 4.0,
    booked_impressions: 25_000_000,
    delivered_impressions: 21_000_000, // delivery 0.84 (underdelivery)
    billable_impressions: 21_000_000,
    invoice_amount: 80000, // margin 0.225
    publisher_cost: 50000,
    data_cost: 9000,
    creative_cost: 3000,
    attention_score: 47, // attention risk (>$25k)
    supply_quality_flag: "review", // 4 flags
  },
];

/** Validated, frozen campaign dataset consumed by the risk engine. */
export const campaigns: readonly Campaign[] = Object.freeze(
  z.array(campaignSchema).parse(rawCampaigns),
);
