import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VerifyEmailPage } from "./VerifyEmailPage";
import { verifyEmail } from "../../api/auth";

vi.mock("../../api/auth", () => ({
  verifyEmail: vi.fn(),
}));

const mockedVerifyEmail = vi.mocked(verifyEmail);

function renderVerifyEmailPage(path = "/verify-email?token=token-1") {
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
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies token and shows success state", async () => {
    mockedVerifyEmail.mockResolvedValue({ message: "Email verified successfully" });
    renderVerifyEmailPage("/verify-email?token=abc-token");

    await waitFor(() => {
      expect(mockedVerifyEmail).toHaveBeenCalledWith("abc-token");
    });
    expect(await screen.findByText("Email Verified")).toBeInTheDocument();
    expect(screen.getByText("Email verified successfully")).toBeInTheDocument();
  });

  it("shows missing token state when query token is absent", async () => {
    renderVerifyEmailPage("/verify-email");
    expect(await screen.findByText("Verification token is missing from the link.")).toBeInTheDocument();
    expect(mockedVerifyEmail).not.toHaveBeenCalled();
  });
});
