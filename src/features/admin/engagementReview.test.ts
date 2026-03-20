import { describe, expect, it } from "vitest";

import { normalizeEngagementContributors } from "./engagementReview";

describe("normalizeEngagementContributors", () => {
  it("normalizes xgboost SHAP contributors into readable cards", () => {
    const result = normalizeEngagementContributors([
      {
        feature: "watch_time_ratio",
        shap_value: 0.45,
        feature_value: 0.837,
        behavior_category: "coverage",
      },
    ], "xgboost", "positive");

    expect(result).toHaveLength(1);
    expect(result[0]?.featureLabel).toBe("Watch Time Coverage");
    expect(result[0]?.impactLabel).toBe("SHAP Value");
    expect(result[0]?.impactDisplay).toBe("+0.450");
    expect(result[0]?.featureValueDisplay).toBe("83.7%");
  });

  it("supports EBM contributor payloads", () => {
    const result = normalizeEngagementContributors(JSON.stringify([
      {
        feature: "num_buffering_events",
        contribution: -0.12,
        feature_value: 3,
        behavior_category: "playback_quality",
      },
    ]), "ebm", "negative");

    expect(result).toHaveLength(1);
    expect(result[0]?.impactLabel).toBe("Contribution");
    expect(result[0]?.featureLabel).toBe("Buffering Events");
    expect(result[0]?.reason).toContain("buffering");
  });
});
