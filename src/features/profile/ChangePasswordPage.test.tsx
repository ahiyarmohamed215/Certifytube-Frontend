import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChangePasswordPage } from "./ChangePasswordPage";
import { changePassword } from "../../api/auth";
import { useAuthStore } from "../../store/useAuthStore";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../api/auth", () => ({
  changePassword: vi.fn(),
}));

const mockedChangePassword = vi.mocked(changePassword);

function renderChangePasswordPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/profile/change-password"]}>
        <Routes>
          <Route path="/profile/change-password" element={<ChangePasswordPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/profile" element={<div>Profile Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ChangePasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({
      token: "token-1",
      user: { userId: 7, email: "learner@example.com", role: "USER", name: "Learner" },
      isLoggedIn: true,
    });
  });

  it("changes password when form is valid", async () => {
    mockedChangePassword.mockResolvedValue({ message: "Password updated successfully" });
    renderChangePasswordPage();

    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "old-pass1" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "new-pass1" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "new-pass1" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(mockedChangePassword).toHaveBeenCalledWith("old-pass1", "new-pass1");
    });
    expect(await screen.findByText("Password updated successfully")).toBeInTheDocument();
  });

  it("shows validation error when confirm password does not match", async () => {
    renderChangePasswordPage();

    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "old-pass1" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "new-pass1" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "diff-pass1" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    expect(mockedChangePassword).not.toHaveBeenCalled();
    expect(await screen.findByText("New password and confirm password must match")).toBeInTheDocument();
  });

  it("redirects to login when change password returns 401", async () => {
    mockedChangePassword.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));
    localStorage.setItem("ct_token", "token-1");
    localStorage.setItem("ct_user", JSON.stringify({ userId: 7, email: "learner@example.com", role: "USER" }));

    renderChangePasswordPage();

    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "old-pass1" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "new-pass1" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "new-pass1" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
    expect(localStorage.getItem("ct_token")).toBeNull();
  });
});
