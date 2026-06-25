import OpenAI from "openai";
import {
  AI_MEMO_JSON_SCHEMA,
  aiBriefPayloadSchema,
  aiMemoSchema,
  renderPayloadForPrompt,
  type AiBriefPayload,
} from "@/lib/ai-brief-payload";

/**
 * Server-side AI narrative route (OpenAI).
 *
 * Turns the deterministic computed results into an analyst-style narrative
 * memo. The model NARRATES — it never computes, recomputes, or invents values.
 * It only ever sees the sanitized payload (computed KPIs, flags, sufficiency,
 * validation summary, campaign-level computed outputs) — never raw uploaded
 * rows or original file contents. The API key lives only on the server
 * (process.env.OPENAI_API_KEY); it is never sent to the browser. If the key is
 * missing or the provider fails, the client keeps the deterministic brief as a
 * fallback.
 */

export const runtime = "nodejs";

const DEFAULT_MODEL = "gpt-5.4-mini";
const MAX_OUTPUT_TOKENS = 4096;

const SYSTEM_PROMPT = `You are a careful finance/ops analyst writing an internal review memo for an advertising-finance team. You are given ONLY pre-computed, deterministic results from a campaign-risk engine, expressed as JSON.

Absolute rules:
- Use ONLY the numbers shown in the provided data. Do NOT do any arithmetic, recompute, re-derive, or "sanity-check" by calculating. Quote figures exactly as shown.
- A figure shown as "N/A" means it is NOT computable from the supplied data. Treat it as N/A and explain WHY it is unavailable (use the stated reason / missing field). NEVER convert N/A to 0, and never estimate, infer, or fill in a missing CPM, cost, invoice, delivery, attention, or supply-quality value.
- All currency is already formatted as dollars and all margins/delivery rates as percentages with one decimal (e.g. $12,000, 32.9%, 87.5%). Use these formatted values verbatim. NEVER output a raw decimal such as 0.329 or 0.875, and never recompute them.
- Write for a finance audience in plain business language. Do NOT expose internal field or variable names (e.g. risk_score, risk_partial, gross_margin, delivery_rate, invoice_amount). Say "gross margin", "delivery rate", "invoice amount", "risk level", etc.
- The phrase "potential leakage" may ONLY be used when invoice-gap analysis is available. If it is unavailable, do NOT describe the portfolio as having potential leakage; instead state that revenue leakage cannot be assessed until Contracted CPM is mapped, and base the review on the available analyses (e.g. delivery and margin risk).
- Clearly distinguish "no leakage found" (a computed $0) from "leakage cannot be computed" (analysis unavailable). Never conflate the two.
- For Low-risk campaigns, say no immediate action is required based on the available analyses; if invoice-gap analysis is unavailable, note that billing-gap status remains unknown until CPM is mapped. Do not urge finance to verify a Low-risk campaign.
- Keep recommended actions to the top 1-3 highest-leverage items — not a long list.
- This is MOCK/anonymized prototype data. Frame everything as "for review", "to reconcile", "to verify" — never as confirmed fraud, confirmed loss, or a definitive financial claim. Use finance-safe verbs (review, reconcile, verify, investigate) and avoid accusatory or absolute language.
- Be concise and specific, referencing campaigns by advertiser/id and the exact figures shown.
- Return ONLY the structured fields requested; no preamble.`;

function buildUserPrompt(payload: AiBriefPayload): string {
  return [
    "Below are the deterministic, pre-computed results (mock/anonymized). Currency is already in dollars and margins/delivery rates are already percentages. Narrate them into a finance-review memo. Do not compute anything new, do not output raw decimals, and do not expose internal field names.",
    "",
    renderPayloadForPrompt(payload),
    "",
    "Write the memo fields:",
    "- executive_summary: 2-4 sentences in finance-safe language. Lead with what finance should review using the AVAILABLE analyses and the headline figures present. If invoice-gap analysis is unavailable, frame the review around the available risk types (e.g. delivery and margin) and say that revenue leakage cannot be assessed until Contracted CPM is mapped — do NOT call it potential leakage.",
    "- data_confidence: which analyses are available / partial / unavailable, and why. Be explicit that N/A means not computable (not zero), and clearly distinguish 'no leakage found' ($0, computed) from 'leakage cannot be computed' (analysis unavailable).",
    "- highest_risk_campaign: name the top-ranked flagged campaign and explain its flags using only the figures shown; if some analyses were unavailable for it, say its risk view is partial in plain words.",
    "- biggest_risk_driver: the most common/material risk theme across the flagged campaigns.",
    "- verify_first: what finance should reconcile or verify first, tied to specific campaigns and dollar figures where available. Do not push urgent verification of Low-risk campaigns.",
    "- possible_false_positives: where a flag might be benign or need context before action.",
    "- recommended_actions: ONLY the top 1-3 highest-leverage review actions, each tied to a campaign and (where available) a dollar amount. For Low-risk campaigns, state that no immediate action is required on the available analyses (noting billing-gap status is unknown if CPM is unmapped).",
    "- cannot_conclude: what this analysis explicitly cannot determine given the available data (e.g. revenue leakage when CPM is missing).",
    "- follow_up_questions: 2-4 questions a finance/ops team should ask to close the gaps.",
  ].join("\n");
}

function jsonError(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status });
}

/**
 * Call OpenAI to produce the memo JSON string. Prefers the Responses API
 * (with a json_schema text format) and falls back to Chat Completions on
 * older SDKs. Returns the raw model text, or null on a refusal.
 */
async function generateMemoText(
  client: OpenAI,
  model: string,
  userPrompt: string,
): Promise<string | null> {
  // Structured output: constrain the model to the exact memo shape.
  const schema = AI_MEMO_JSON_SCHEMA as unknown as Record<string, unknown>;

  if (typeof client.responses?.create === "function") {
    const response = await client.responses.create({
      model,
      instructions: SYSTEM_PROMPT,
      input: userPrompt,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      text: {
        format: {
          type: "json_schema",
          name: "finance_memo",
          strict: true,
          schema,
        },
      },
    });
    // A safety refusal surfaces as a refusal output part; output_text is empty.
    const refused = response.output.some(
      (item) =>
        item.type === "message" &&
        item.content.some((part) => part.type === "refusal"),
    );
    if (refused) return null;
    return response.output_text ?? "";
  }

  // Fallback for SDKs without the Responses API.
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "finance_memo", strict: true, schema },
    },
  });
  const choice = completion.choices[0];
  if (choice?.message?.refusal) return null;
  return choice?.message?.content ?? "";
}

export async function POST(request: Request): Promise<Response> {
  // 1. Parse + validate the sanitized payload shape.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body was not valid JSON.");
  }

  const parsed = aiBriefPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "invalid_payload",
      "The analysis payload did not match the expected sanitized shape.",
    );
  }

  // 2. Require a server-side API key. Without it, the client falls back.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonError(
      503,
      "missing_api_key",
      "AI memo unavailable — no OPENAI_API_KEY is configured on the server. The deterministic brief remains the source of truth.",
    );
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  // 3. Call the model to narrate (never to compute).
  try {
    const client = new OpenAI({ apiKey });
    const text = await generateMemoText(client, model, buildUserPrompt(parsed.data));

    if (text === null) {
      return jsonError(
        502,
        "provider_refusal",
        "The model declined to generate a memo for this input. The deterministic brief remains available.",
      );
    }

    let memoJson: unknown;
    try {
      memoJson = JSON.parse(text.trim());
    } catch {
      return jsonError(
        502,
        "provider_bad_output",
        "The model returned a response that could not be parsed as a memo.",
      );
    }

    const memo = aiMemoSchema.safeParse(memoJson);
    if (!memo.success) {
      return jsonError(
        502,
        "provider_bad_output",
        "The model response did not match the expected memo structure.",
      );
    }

    return Response.json({ memo: memo.data });
  } catch (err) {
    const message =
      err instanceof OpenAI.APIError
        ? `Model provider error (${err.status ?? "unknown"}). The deterministic brief remains available.`
        : "Unexpected error generating the AI memo. The deterministic brief remains available.";
    return jsonError(502, "provider_error", message);
  }
}
