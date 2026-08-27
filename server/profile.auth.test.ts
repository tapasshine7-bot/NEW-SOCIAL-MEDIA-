import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as { React?: typeof React }).React = React;

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false, loading: false }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { account: { me: { useQuery: () => ({ isLoading: false, isError: false, data: undefined }) } } } }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => React.createElement("button", props, children) }));
vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => React.createElement("a", { href, ...props }, children) }));

import Profile from "../client/src/pages/Profile";

describe("Profile authentication fallback", () => {
  it("sends signed-out profile visitors to the normal login route", () => {
    const html = renderToStaticMarkup(React.createElement(Profile));
    expect(html).toContain('href="/login"');
    expect(html).toContain("Sign in to shape your profile.");
  });
});
