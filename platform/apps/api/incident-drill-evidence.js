import { createHash } from "node:crypto";
import { localIncidentDrill } from "../../packages/contracts/incident-drill.js";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(record) {
  return createHash("sha256").update(canonical(record)).digest("hex");
}

export function createIncidentDrillEvidence(input) {
  const record = localIncidentDrill(input);
  return Object.freeze({
    schema: "fraldacycle.incident-drill-evidence.v1",
    generatedAt: new Date().toISOString(),
    record,
    sha256: digest(record),
    limitations: Object.freeze([
      "Evidência técnica local; não comprova exercício humano observado.",
      "Não autoriza produção, fornecedor, pagamento, mensagem ou dado pessoal real.",
    ]),
  });
}

export function verifyIncidentDrillEvidence(evidence) {
  if (evidence?.schema !== "fraldacycle.incident-drill-evidence.v1") return false;
  try {
    const record = localIncidentDrill(evidence.record);
    return typeof evidence.sha256 === "string" && digest(record) === evidence.sha256;
  } catch {
    return false;
  }
}
