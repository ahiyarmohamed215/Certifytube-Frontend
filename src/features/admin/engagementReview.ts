type Direction = "positive" | "negative";

type ContributorRecord = Record<string, unknown>;

type FeatureCopy = {
  label: string;
  positive: string;
  negative: string;
};

export type EngagementSignalCard = {
  id: string;
  direction: Direction;
  featureLabel: string;
  rawFeatureKey: string;
  impactLabel: "SHAP Value" | "Contribution";
  impactValue: number | null;
  impactDisplay: string;
  featureValueDisplay: string;
  featureValueRaw: string | number | boolean | null;
  behaviorCategory: string;
  behaviorLabel: string;
  reason: string;
};

const FEATURE_COPY: Record<string, FeatureCopy> = {
  watch_time_ratio: {
    label: "Watch Time Coverage",
    positive: "The learner stayed with the video for a high share of its runtime, which strongly supports real attention.",
    negative: "Low watch coverage suggests the learner left early or skipped too much of the lesson.",
  },
  completion_ratio: {
    label: "Completion Ratio",
    positive: "A strong completion ratio shows the learner followed the video through to the end of the lesson.",
    negative: "A low completion ratio signals that the learner did not finish enough of the content.",
  },
  attention_index: {
    label: "Attention Index",
    positive: "The attention pattern stayed consistent, which is a strong sign of focused viewing.",
    negative: "The attention pattern looked inconsistent, which weakens confidence in sustained engagement.",
  },
  rewatch_ratio: {
    label: "Rewatch Ratio",
    positive: "Rewatching parts of the video suggests deeper processing and deliberate review.",
    negative: "Very little rewatching can reduce evidence of active review when the lesson needed reinforcement.",
  },
  active_watch_ratio: {
    label: "Active Watch Ratio",
    positive: "Most of the session was active viewing rather than idle playback, which supports genuine engagement.",
    negative: "A lower active-watch ratio suggests the learner may have left the video running without sustained attention.",
  },
  pause_time_ratio: {
    label: "Pause Time Ratio",
    positive: "The pause pattern looks like reflective breaks rather than disengagement, which can support learning.",
    negative: "Too much paused time can indicate interrupted viewing rather than steady lesson follow-through.",
  },
  pause_count: {
    label: "Pause Count",
    positive: "The learner paused at a level that looks intentional and reflective rather than disruptive.",
    negative: "Frequent pausing can break continuity and reduce confidence in consistent engagement.",
  },
  num_buffering_events: {
    label: "Buffering Events",
    positive: "Playback stayed technically smooth, helping the learner maintain attention.",
    negative: "Frequent buffering interrupts concentration and weakens the overall engagement signal.",
  },
  skip_time_ratio: {
    label: "Skip Time Ratio",
    positive: "The learner skipped very little content, which supports full lesson coverage.",
    negative: "A high skip ratio suggests the learner jumped over content instead of following the lesson sequence.",
  },
  seek_forward_count: {
    label: "Forward Seeks",
    positive: "Forward seeking remained limited, which supports steady lesson progression.",
    negative: "Frequent forward seeks suggest the learner may have jumped past important parts of the content.",
  },
  seek_backward_count: {
    label: "Backward Seeks",
    positive: "Backward seeks suggest the learner revisited points that needed clarification, which can support understanding.",
    negative: "Very few backward seeks can reduce evidence of active review for challenging material.",
  },
  playback_rate_mean: {
    label: "Playback Speed",
    positive: "Playback speed remained within a normal range, which supports real comprehension rather than rushing.",
    negative: "Playback speed suggests the learner may have rushed the lesson, which weakens confidence in comprehension.",
  },
  playback_rate_std: {
    label: "Playback Speed Variation",
    positive: "Playback speed was stable, which supports a deliberate viewing pattern.",
    negative: "Large playback-speed changes can suggest unstable viewing behavior during the lesson.",
  },
  watch_segments_count: {
    label: "Watch Segments",
    positive: "The session shows a healthy number of meaningful viewing segments, indicating active interaction with the lesson.",
    negative: "The viewing pattern shows fragmented segments, which can reflect broken or inconsistent watching.",
  },
};

function isRecord(value: unknown): value is ContributorRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function behaviorToLabel(behavior: string): string {
  return humanizeKey(behavior || "unknown");
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatImpact(value: number | null): string {
  if (value == null) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function formatFeatureValue(featureKey: string, rawValue: unknown): string {
  if (rawValue == null) return "-";

  if (typeof rawValue === "boolean") {
    return rawValue ? "Yes" : "No";
  }

  const numeric = asFiniteNumber(rawValue);
  if (numeric == null) return String(rawValue);

  if (featureKey.includes("playback_rate")) {
    return `${numeric.toFixed(2)}x`;
  }

  if (featureKey.endsWith("_ratio") || featureKey.endsWith("_percent") || featureKey.endsWith("_index")) {
    if (numeric >= 0 && numeric <= 1) {
      return `${(numeric * 100).toFixed(1)}%`;
    }
    return numeric.toFixed(3);
  }

  if (featureKey.includes("_sec") || featureKey.endsWith("_seconds")) {
    return `${numeric.toFixed(1)} sec`;
  }

  if (featureKey.startsWith("num_") || featureKey.endsWith("_count") || featureKey.includes("events")) {
    return `${Math.round(numeric)}`;
  }

  if (Math.abs(numeric) >= 100) {
    return numeric.toFixed(0);
  }

  if (Math.abs(numeric) >= 10) {
    return numeric.toFixed(1);
  }

  return numeric.toFixed(3);
}

function genericReason(featureKey: string, behavior: string, direction: Direction): string {
  const featureLabel = FEATURE_COPY[featureKey]?.label || humanizeKey(featureKey);
  const behaviorLabel = behaviorToLabel(behavior);
  if (direction === "positive") {
    return `${featureLabel} supported the engagement score through ${behaviorLabel.toLowerCase()} behavior in this session.`;
  }
  return `${featureLabel} reduced the engagement score because the ${behaviorLabel.toLowerCase()} pattern looked weaker in this session.`;
}

function resolveReason(featureKey: string, behavior: string, direction: Direction): string {
  const copy = FEATURE_COPY[featureKey];
  if (!copy) return genericReason(featureKey, behavior, direction);
  return direction === "positive" ? copy.positive : copy.negative;
}

export function normalizeEngagementContributors(
  raw: unknown,
  model: string,
  direction: Direction,
): EngagementSignalCard[] {
  let resolved = raw;
  if (typeof resolved === "string") {
    try {
      resolved = JSON.parse(resolved);
    } catch {
      return [];
    }
  }

  let contributors: unknown[] = [];
  if (Array.isArray(resolved)) {
    contributors = resolved;
  } else if (isRecord(resolved)) {
    const candidateKeys = ["items", "contributors", "topPositive", "topNegative", "data"];
    for (const key of candidateKeys) {
      const candidate = resolved[key];
      if (Array.isArray(candidate)) {
        contributors = candidate;
        break;
      }
    }
  }

  if (!Array.isArray(contributors)) return [];

  const normalizedModel = String(model || "").toLowerCase();

  return contributors
    .filter(isRecord)
    .map((item, index) => {
      const rawFeatureKey = typeof item.feature === "string" && item.feature.trim()
        ? item.feature.trim()
        : `feature_${index + 1}`;
      const behaviorCategory = typeof item.behavior_category === "string" && item.behavior_category.trim()
        ? item.behavior_category.trim()
        : "general";
      const impactLabel = normalizedModel === "ebm" ? "Contribution" : "SHAP Value";
      const impactValue = asFiniteNumber(normalizedModel === "ebm" ? item.contribution : item.shap_value);
      const featureValueRaw = typeof item.feature_value === "string"
        || typeof item.feature_value === "number"
        || typeof item.feature_value === "boolean"
        ? item.feature_value
        : null;

      return {
        id: `${rawFeatureKey}-${direction}-${index}`,
        direction,
        featureLabel: FEATURE_COPY[rawFeatureKey]?.label || humanizeKey(rawFeatureKey),
        rawFeatureKey,
        impactLabel,
        impactValue,
        impactDisplay: formatImpact(impactValue),
        featureValueDisplay: formatFeatureValue(rawFeatureKey, featureValueRaw),
        featureValueRaw,
        behaviorCategory,
        behaviorLabel: behaviorToLabel(behaviorCategory),
        reason: resolveReason(rawFeatureKey, behaviorCategory, direction),
      };
    });
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}
