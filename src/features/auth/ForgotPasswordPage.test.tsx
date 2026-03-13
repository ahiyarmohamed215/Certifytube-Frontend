import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { forgotPassword } from "../../api/auth";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../api/auth", () => ({
  forgotPassword: vi.fn(),
}));

const mockedForgotPassword = vi.mocked(forgotPassword);

function renderForgotPasswordPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits forgot password request and shows success message", async () => {
    const user = userEvent.setup();
    mockedForgotPassword.mockResolvedValue({
      message: "If the email exists, reset instructions were sent.",
    });
    renderForgotPasswordPage();

    await user.type(screen.getByLabelText("Email"), "learner@example.com");
    await user.click(screen.getByRole("button", { name: /send reset instructions/i }));

    await waitFor(() => {
      expect(mockedForgotPassword).toHaveBeenCalledWith("learner@example.com");
    });
    expect(await screen.findByText("If the email exists, reset instructions were sent.")).toBeInTheDocument();
  });

  it("shows generic success message and 429 warning when rate limited", async () => {
    const user = userEvent.setup();
    mockedForgotPassword.mockRejectedValue({
      status: 429,
      data: { message: "Too many requests" },
      message: "Too many requests",
    });
    renderForgotPasswordPage();

    await user.type(screen.getByLabelText("Email"), "learner@example.com");
    await user.click(screen.getByRole("button", { name: /send reset instructions/i }));

    expect(await screen.findByText("Too many requests, try later")).toBeInTheDocument();
    expect(await screen.findByText("If this email exists, password reset instructions have been sent.")).toBeInTheDocument();
  });
});
