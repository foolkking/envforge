export interface DecisionScores {
  intentConfidence: number;
  evidenceStrength: number;
  migrationReadiness: number;
  riskScore: number;
  automationConfidence: number;
  businessCriticality: number;
  reviewCost: number;
  userPreferenceConfidence: number;
  collectorCompleteness: number;
}

export function clampDecisionScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

export function riskScoreForLevel(level: "safe" | "review" | "privileged" | "dangerous"): number {
  return level === "safe" ? 0.15 : level === "review" ? 0.45 : level === "privileged" ? 0.75 : 0.95;
}
