import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

describe("LoginPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/auth/me") {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
  });

  it("renders login form with all required inputs and brand elements", () => {
    const { container } = render(<LoginPage />);

    expect(screen.getByText("Sign in to ContinuityX")).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Remember me")).toBeInTheDocument();
    expect(container.querySelector("button[type='submit']")).toBeInTheDocument();
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Create account" }).length).toBeGreaterThanOrEqual(1);

    // Narrative and proof chain on left side
    expect(screen.getByText(/Your project knowledge,/i)).toBeInTheDocument();
    expect(screen.getByText("Traceable Evidence Chain")).toBeInTheDocument();
  });

  it("toggles password visibility when show/hide button is clicked", () => {
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = screen.getByRole("button", { name: "Show password" });
    fireEvent.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("populates form fields when a demo user button is clicked", () => {
    render(<LoginPage />);

    const arjunButton = screen.getByRole("button", { name: /Arjun Mehta/i });
    fireEvent.click(arjunButton);

    const emailInput = screen.getByLabelText("Work email") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;

    expect(emailInput.value).toBe("lead@continuityx.demo");
    expect(passwordInput.value).toBe("DemoPassword123!");
  });

  it("submits valid credentials and redirects to dashboard", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url === "/api/auth/me") {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      if (url === "/api/auth/login" && opts?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ user: { id: "1", email: "lead@continuityx.demo" } }),
        };
      }
      return { ok: false, status: 404 };
    });

    const { container } = render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "lead@continuityx.demo" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "DemoPassword123!" },
    });

    const submitBtn = container.querySelector("button[type='submit']") as HTMLElement;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("displays error banner when authentication fails", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url === "/api/auth/me") {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      if (url === "/api/auth/login" && opts?.method === "POST") {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { message: "Invalid email or password." } }),
        };
      }
      return { ok: false, status: 404 };
    });

    const { container } = render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "wrong@continuityx.demo" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "WrongPass123" },
    });

    const submitBtn = container.querySelector("button[type='submit']") as HTMLElement;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password.");
    });
  });
});
