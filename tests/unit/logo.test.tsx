import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo, LogoSymbol } from "@/components/ui/logo";

describe("Logo Component", () => {
  it("renders full logo with symbol and wordmark", () => {
    const { container } = render(<Logo />);
    expect(screen.getByText("Continuity")).toBeInTheDocument();
    expect(screen.getByText("X")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders symbol-only variant", () => {
    const { container } = render(<Logo variant="symbol" />);
    expect(screen.queryByText("Continuity")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders wordmark-only variant", () => {
    const { container } = render(<Logo variant="wordmark" />);
    expect(screen.getByText("Continuity")).toBeInTheDocument();
    expect(screen.getByText("X")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders wrapped in a link when href is provided", () => {
    render(<Logo href="/dashboard" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard");
    expect(screen.getByText("Continuity")).toBeInTheDocument();
  });

  it("renders LogoSymbol with custom size", () => {
    const { container } = render(<LogoSymbol size={48} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "48");
  });
});
