import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VerifyEmailPage } from "./VerifyEmailPage";
import { resendVerification, verifyEmail } from "../../api/auth";

vi.mock("../../api/auth", () => ({
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

const mockedVerifyEmail = vi.mocked(verifyEmail);
const mockedResendVerification = vi.mocked(resendVerification);

function renderVerifyEmailPage(path = "/verify-email?token=token-1", strictMode = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const element = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(strictMode ? <React.StrictMode>{element}</React.StrictMode> : element);
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies token once in strict mode and shows success", async () => {
    mockedVerifyEmail.mockResolvedValue({ message: "Email verified successfully" });
    renderVerifyEmailPage("/verify-email?token=abc-token", true);

    await waitFor(() => {
      expect(mockedVerifyEmail).toHaveBeenCalledTimes(1);
      expect(mockedVerifyEmail).toHaveBeenCalledWith("abc-token");
    });
    expect(await screen.findByText("Email Verified")).toBeInTheDocument();
    expect(screen.getByText("Email verified successfully")).toBeInTheDocument();
  });

  it("shows already verified state for TOKEN_ALREADY_USED", async () => {
    mockedVerifyEmail.mockRejectedValue({
      status: 400,
      data: { code: "TOKEN_ALREADY_USED", message: "Token already used" },
    });
    renderVerifyEmailPage("/verify-email?token=abc-token");

    expect(await screen.findByText("Email already verified")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to login/i })).toBeInTheDocument();
  });

  it("shows resend form for TOKEN_INVALID_OR_EXPIRED", async () => {
    mockedVerifyEmail.mockRejectedValue({
      status: 400,
      data: { code: "TOKEN_INVALID_OR_EXPIRED", message: "Token invalid" },
    });
    renderVerifyEmailPage("/verify-email?token=abc-token");

    expect(await screen.findByText("Link invalid or expired")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend verification/i })).toBeInTheDocument();
  });

  it("submits resend verification form and shows backend message", async () => {
    const user = userEvent.setup();
    mockedVerifyEmail.mockRejectedValue({
      status: 400,
      data: { code: "TOKEN_INVALID_OR_EXPIRED", message: "Token invalid" },
    });
    mockedResendVerification.mockResolvedValue({
      message: "If your account exists, we have sent a fresh verification link.",
    });
    renderVerifyEmailPage("/verify-email?token=abc-token");

    await screen.findByText("Link invalid or expired");
    await user.type(screen.getByLabelText("Email"), "learner@example.com");
    await user.click(screen.getByRole("button", { name: /resend verification/i }));

    await waitFor(() => {
      expect(mockedResendVerification).toHaveBeenCalledWith("learner@example.com");
    });
    expect(await screen.findByText("If your account exists, we have sent a fresh verification link.")).toBeInTheDocument();
  });

  it("shows invalid link message when token missing in query", async () => {
    renderVerifyEmailPage("/verify-email");
    expect(await screen.findByText("Invalid verification link")).toBeInTheDocument();
    expect(mockedVerifyEmail).not.toHaveBeenCalled();
  });

  it("shows invalid link message for TOKEN_MISSING error code", async () => {
    mockedVerifyEmail.mockRejectedValue({
      status: 400,
      data: { code: "TOKEN_MISSING", message: "Token missing" },
    });
    renderVerifyEmailPage("/verify-email?token=abc-token");

    expect(await screen.findByText("Invalid verification link")).toBeInTheDocument();
  });
});
