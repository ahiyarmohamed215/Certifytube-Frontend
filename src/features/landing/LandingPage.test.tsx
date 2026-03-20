import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { LandingPage } from "./LandingPage";
import { useAuthStore } from "../../store/useAuthStore";

function renderLandingPage() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<div>Admin Dashboard</div>} />
        <Route path="/home" element={<div>Learner Home</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/signup" element={<div>Signup Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LandingPage", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null, isLoggedIn: false });
  });

  it("routes authenticated admins to the admin dashboard", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      token: "token-1",
      user: { userId: 99, email: "admin@example.com", role: "ADMIN", name: "Admin" },
      isLoggedIn: true,
    });
    renderLandingPage();

    expect(screen.getByRole("button", { name: /open admin panel/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /go to dashboard/i }));

    expect(await screen.findByText("Admin Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Learner Home")).not.toBeInTheDocument();
  });
});
