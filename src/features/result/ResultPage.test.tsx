import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResultPage } from "./ResultPage";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../api/certificate", () => ({
  downloadCertificatePdf: vi.fn(),
}));

vi.mock("../../api/quiz", () => ({
  getQuiz: vi.fn(),
  getQuizEligibility: vi.fn().mockResolvedValue({
    sessionId: "session-1",
    eligible: true,
    reason: "",
    requiredEngagementScore: 0.85,
    latestEngagementScore: 0.9,
    engagementPassed: true,
    maxFailedAttempts: 2,
    failedAttemptsUsed: 1,
    remainingAttempts: 1,
    stemEligible: true,
  }),
  getQuizResult: vi.fn(),
}));

const sharedReview = [
  {
    questionId: "q1",
    questionType: "mcq",
    questionText: "2 + 2 = ?",
    options: ["3", "4", "5"],
    selectedAnswer: "3",
    correctAnswer: "4",
    correct: false,
    explanation: "2 and 2 equals 4.",
  },
  {
    questionId: "q2",
    questionType: "true_false",
    questionText: "The sky is blue.",
    options: ["true", "false"],
    selectedAnswer: "true",
    correctAnswer: "true",
    correct: true,
    explanation: "Atmospheric scattering makes the sky appear blue.",
  },
];

describe("ResultPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides question explanations while learner still has remaining attempts", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/result/quiz-1",
            state: {
              result: {
                quizId: "quiz-1",
                correctCount: 1,
                totalCount: 2,
                scorePercent: 50,
                passed: false,
                certificateId: null,
                verificationLink: null,
                review: sharedReview,
              },
              quizQuestions: [
                {
                  questionId: "q1",
                  questionType: "mcq",
                  questionText: "2 + 2 = ?",
                  options: ["3", "4", "5"],
                },
                {
                  questionId: "q2",
                  questionType: "true_false",
                  questionText: "The sky is blue.",
                  options: ["true", "false"],
                },
              ],
              submittedAnswers: {
                q1: "3",
                q2: "true",
              },
              sessionId: "session-1",
              videoId: "video-1",
              videoTitle: "Algebra Basics",
            },
          },
        ]}
      >
        <Routes>
          <Route path="/result/:quizId" element={<ResultPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Question Review")).toBeInTheDocument();
    expect(screen.getByText("Question review is locked until you pass the quiz or use all attempts.")).toBeInTheDocument();
    expect(screen.queryByText("2 and 2 equals 4.")).not.toBeInTheDocument();
    expect(screen.queryByText("Atmospheric scattering makes the sky appear blue.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Your answer:/i)).not.toBeInTheDocument();
  });

  it("shows question explanations after learner passes the quiz", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/result/quiz-1",
            state: {
              result: {
                quizId: "quiz-1",
                correctCount: 2,
                totalCount: 2,
                scorePercent: 100,
                passed: true,
                certificateId: "cert-1",
                verificationLink: "http://localhost:8080/api/certificates/verify/token",
                review: sharedReview,
              },
              quizQuestions: [
                {
                  questionId: "q1",
                  questionType: "mcq",
                  questionText: "2 + 2 = ?",
                  options: ["3", "4", "5"],
                },
                {
                  questionId: "q2",
                  questionType: "true_false",
                  questionText: "The sky is blue.",
                  options: ["true", "false"],
                },
              ],
              submittedAnswers: {
                q1: "3",
                q2: "true",
              },
              sessionId: "session-1",
              videoId: "video-1",
              videoTitle: "Algebra Basics",
            },
          },
        ]}
      >
        <Routes>
          <Route path="/result/:quizId" element={<ResultPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Question Review")).toBeInTheDocument();
    expect(screen.getByText("2 and 2 equals 4.")).toBeInTheDocument();
    expect(screen.getByText("Atmospheric scattering makes the sky appear blue.")).toBeInTheDocument();
    expect(screen.getAllByText(/Your answer:/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("Question review is locked until you pass the quiz or use all attempts.")).not.toBeInTheDocument();
  });
});
