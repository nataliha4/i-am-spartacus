import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "../../src/client/Login";
const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/auth-client", () => ({
  authClient: { signIn: { social: signIn } },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
test("Google login uses the same-origin callback and exposes policies, not password signup", async () => {
  signIn.mockResolvedValue({ data: {} });
  render(<Login />);
  await userEvent.click(
    screen.getByRole("button", { name: "Continue with Google" }),
  );
  expect(signIn).toHaveBeenCalledWith({
    provider: "google",
    callbackURL: "/",
    errorCallbackURL: "/",
  });
  expect(screen.queryByLabelText("Password")).toBeNull();
  expect(
    screen.getByRole("link", { name: "Privacy" }).getAttribute("href"),
  ).toBe("/privacy");
  expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe(
    "/terms",
  );
});
test("Google login handles a disconnected network and allows retry", async () => {
  signIn
    .mockRejectedValueOnce(new Error("Network failure"))
    .mockResolvedValueOnce({ error: { message: "Sign-in unavailable" } });
  render(<Login />);
  await userEvent.click(
    screen.getByRole("button", { name: "Continue with Google" }),
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Unable to connect",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Continue with Google" }),
  );
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Sign-in unavailable",
  );
});
