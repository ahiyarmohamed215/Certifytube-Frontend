import { describe, expect, it } from "vitest";

import { normalizeOptions, resolveQuizAnswer } from "./adminLearnerUtils";

describe("adminLearnerUtils", () => {
  it("normalizes option arrays with mixed shapes", () => {
    const options = normalizeOptions([
      "A",
      { id: "b", label: "B" },
      { value: "C" },
    ]);

    expect(options).toEqual([
      { key: "0-A", label: "A" },
      { key: "b", label: "B" },
      { key: "2-C", label: "C" },
    ]);
  });

  it("resolves learner answers from object payloads by question uid", () => {
    const answer = resolveQuizAnswer(
      { q1: "Option B" },
      { questionUid: "q1", id: 12, positionIndex: 1 },
    );

    expect(answer).toBe("Option B");
  });
});
