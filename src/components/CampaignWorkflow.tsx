"use client";

import { useMemo, useState } from "react";
import { autoMap, type ColumnMapping, type StandardField } from "@/lib/column-mapping";
import { sampleDataset, type ParsedData } from "@/lib/import-parser";
import { validateRows } from "@/lib/data-validation";
import { assessSufficiency } from "@/lib/sufficiency";
import {
  analyzeSafeCampaigns,
  buildBrief,
  computeSafeKpis,
} from "@/lib/safe-risk-engine";
import { buildAiBriefPayload } from "@/lib/ai-brief-payload";
import TopHeader from "./TopHeader";
import WorkflowStepper, { type WorkflowStep } from "./WorkflowStepper";
import InputStep from "./InputStep";
import ColumnMappingStep from "./ColumnMappingStep";
import ValidationStep from "./ValidationStep";
import AnalysisStep from "./AnalysisStep";
import BriefStep from "./BriefStep";

const STEPS: WorkflowStep[] = [
  { id: 1, label: "Input Data" },
  { id: 2, label: "Map Columns" },
  { id: 3, label: "Validate" },
  { id: 4, label: "Analyze" },
  { id: 5, label: "Brief" },
];

export default function CampaignWorkflow() {
  const [step, setStep] = useState(1);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);

  function handleData(data: ParsedData) {
    setParsed(data);
    setMapping(autoMap(data.headers));
    setStep(2);
  }

  function handleMappingChange(field: StandardField, header: string | null) {
    setMapping((prev) => (prev ? { ...prev, [field]: header } : prev));
  }

  function handleReset() {
    setParsed(null);
    setMapping(null);
    setStep(1);
  }

  function handleLoadSample() {
    handleData(sampleDataset());
  }

  // Derived analysis — recomputed deterministically whenever input/mapping change.
  const validation = useMemo(
    () => (parsed && mapping ? validateRows(parsed, mapping) : null),
    [parsed, mapping],
  );
  const sufficiency = useMemo(
    () => (mapping && validation ? assessSufficiency(mapping, validation.rows) : null),
    [mapping, validation],
  );
  const analysis = useMemo(
    () => (validation ? analyzeSafeCampaigns(validation.rows) : null),
    [validation],
  );
  const kpis = useMemo(() => (analysis ? computeSafeKpis(analysis) : null), [analysis]);
  const brief = useMemo(
    () => (analysis && kpis && sufficiency ? buildBrief(analysis, kpis, sufficiency) : null),
    [analysis, kpis, sufficiency],
  );
  // Sanitized payload for the optional AI memo — computed results only.
  const aiPayload = useMemo(
    () =>
      analysis && kpis && sufficiency && validation
        ? buildAiBriefPayload(analysis, kpis, sufficiency, validation)
        : null,
    [analysis, kpis, sufficiency, validation],
  );

  // Presentational confidence signal derived from validation (valid / total rows).
  const dataConfidence = useMemo(
    () =>
      validation && validation.totalRows > 0
        ? Math.round((validation.validRows / validation.totalRows) * 100)
        : null,
    [validation],
  );

  const dataLoaded = parsed !== null && mapping !== null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-cream">
      <TopHeader onLoadSample={handleLoadSample} onStartOver={handleReset} />

      <div className="flex min-h-0 flex-1">
        <WorkflowStepper
          steps={STEPS}
          current={step}
          dataLoaded={dataLoaded}
          onSelect={setStep}
        />

        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
          <div className="mx-auto w-full max-w-6xl">
            {step === 1 && <InputStep onLoad={handleData} />}

            {step === 2 && parsed && mapping && (
              <ColumnMappingStep
                parsed={parsed}
                mapping={mapping}
                onChange={handleMappingChange}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}

            {step === 3 && validation && sufficiency && (
              <ValidationStep
                validation={validation}
                sufficiency={sufficiency}
                dataConfidence={dataConfidence}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
              />
            )}

            {step === 4 && analysis && kpis && sufficiency && (
              <AnalysisStep
                campaigns={analysis}
                kpis={kpis}
                sufficiency={sufficiency}
                dataConfidence={dataConfidence}
                onBack={() => setStep(3)}
                onNext={() => setStep(5)}
              />
            )}

            {step === 5 && brief && sufficiency && (
              <BriefStep
                brief={brief}
                aiPayload={aiPayload}
                sufficiency={sufficiency}
                dataConfidence={dataConfidence}
                onBack={() => setStep(4)}
                onReset={handleReset}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
