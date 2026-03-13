import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordPage } from "./ResetPasswordPage";
import { resetPassword } from "../../api/auth";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../api/auth", () => ({
  resetPassword: vi.fn(),
}));

const mockedResetPassword = vi.mocked(resetPassword);

function renderResetPasswordPage(path = "/reset-password") {
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
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses token from query param and resets password", async () => {
    const user = userEvent.setup();
    mockedResetPassword.mockResolvedValue({ message: "Password reset successful" });
    renderResetPasswordPage("/reset-password?token=query-token");

    expect(screen.getByLabelText("Reset Token")).toHaveValue("query-token");
    await user.type(screen.getByLabelText("New Password"), "new-password-123");
    await user.type(screen.getByLabelText("Confirm Password"), "new-password-123");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(mockedResetPassword).toHaveBeenCalledWith("query-token", "new-password-123");
    });
    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("validates minimum password length", async () => {
    const user = userEvent.setup();
    renderResetPasswordPage("/reset-password?token=query-token");

    await user.type(screen.getByLabelText("New Password"), "short");
    await user.type(screen.getByLabelText("Confirm Password"), "short");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(mockedResetPassword).not.toHaveBeenCalled();
    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("validates password and confirm match", async () => {
    const user = userEvent.setup();
    renderResetPasswordPage("/reset-password?token=query-token");

    await user.type(screen.getByLabelText("New Password"), "new-password-123");
    await user.type(screen.getByLabelText("Confirm Password"), "another-password-123");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(mockedResetPassword).not.toHaveBeenCalled();
    expect(await screen.findByText("Password and confirm password must match")).toBeInTheDocument();
  });
});
