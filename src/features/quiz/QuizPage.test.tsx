import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuizPage } from "./QuizPage";
import { getQuiz, submitQuiz } from "../../api/quiz";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useBlocker: () => ({
      state: "unblocked" as const,
      reset: vi.fn(),
    }),
    useBeforeUnload: () => undefined,
  };
});

vi.mock("../../api/quiz", () => ({
  getQuizEligibility: vi.fn(),
  generateQuiz: vi.fn(),
  getQuiz: vi.fn(),
  submitQuiz: vi.fn(),
  getQuizResult: vi.fn(),
}));

const mockedGetQuiz = vi.mocked(getQuiz);
const mockedSubmitQuiz = vi.mocked(submitQuiz);

function renderQuizPage(path = "/quiz/quiz-1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/quiz/:quizId" element={<QuizPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("QuizPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders questions and submits answers keyed by questionId", async () => {
    mockedGetQuiz.mockResolvedValue({
      quizId: "quiz-1",
      sessionId: "session-1",
      videoId: "video-1",
      videoTitle: "Algebra Basics",
      difficulty: "medium",
      totalQuestions: 2,
      questions: [
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
    });
    mockedSubmitQuiz.mockResolvedValue({
      quizId: "quiz-1",
      correctCount: 2,
      totalCount: 2,
      scorePercent: 100,
      passed: true,
      certificateId: "cert-1",
      verificationLink: "http://localhost:8080/verify/token",
    });

    const user = userEvent.setup();
    renderQuizPage();

    expect(await screen.findByText("2 + 2 = ?")).toBeInTheDocument();
    const okButton = screen.queryByRole("button", { name: "OK" });
    if (okButton) {
      await user.click(okButton);
    }
    await user.click(screen.getByRole("radio", { name: "4" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("radio", { name: "true" }));
    await user.click(screen.getByRole("button", { name: /submit quiz/i }));

    await waitFor(() => {
      expect(mockedSubmitQuiz).toHaveBeenCalledWith("quiz-1", {
        answers: {
          q1: "4",
          q2: "true",
        },
      });
    });
  });
});
