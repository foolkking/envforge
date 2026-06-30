import type { DecisionScores } from "./score.js";
import { CONSERVATIVE_DECISION_PROFILE, profileAllowsAutomation, type DecisionProfile } from "./profiles.js";

export type DecisionOutcome =
  | "auto-staged"
  | "required-decision"
  | "suggested-decision"
  | "record-only"
  | "hidden-noise"
  | "blocker";

export interface DecisionFacts {
  touchesDatabase?: boolean;
  dataStrategyConfirmed?: boolean;
  touchesSecret?: boolean;
  secretPolicyConfirmed?: boolean;
  explicitlyIgnored?: boolean;
  hasBlockers?: boolean;
  preferredOutcome?: DecisionOutcome;
}

export function classifyDecision(
  scores: DecisionScores,
  facts: DecisionFacts = {},
  profile: DecisionProfile = CONSERVATIVE_DECISION_PROFILE
): DecisionOutcome {
  if (facts.touchesDatabase && !facts.dataStrategyConfirmed) return "required-decision";
  if (facts.touchesSecret && !facts.secretPolicyConfirmed) return "required-decision";
  if (facts.hasBlockers) return "blocker";
  if (scores.collectorCompleteness < profile.minimumCollectorCompleteness
    && scores.riskScore > profile.incompleteEvidenceRiskThreshold) return "blocker";

  // Remembered preferences may reduce review noise, but can never bypass the
  // safety checks above or relax the active profile's automation thresholds.
  if (facts.preferredOutcome === "required-decision") return "required-decision";
  if (facts.preferredOutcome === "record-only" && scores.riskScore < 0.4 && scores.businessCriticality < 0.5) return "record-only";
  if (facts.preferredOutcome === "hidden-noise" && scores.intentConfidence < 0.3 && scores.businessCriticality < 0.3) return "hidden-noise";

  if (facts.explicitlyIgnored) return "hidden-noise";
  if (scores.intentConfidence > 0.8 && profileAllowsAutomation(profile, scores)) return "auto-staged";
  if (scores.intentConfidence < 0.3 && scores.businessCriticality < 0.3) return "record-only";
  if (scores.reviewCost > 0.7 || scores.riskScore > 0.65) return "required-decision";
  if (facts.preferredOutcome === "suggested-decision") return "suggested-decision";
  return "suggested-decision";
}
