import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "../../src/client/Account";
const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/auth-client", () => ({
  authClient: { signIn: { email: signIn } },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
test("login retains inputs and explains a server rejection", async () => {
  signIn.mockResolvedValue({ error: { message: "Invalid email or password" } });
  const user = userEvent.setup();
  const onSuccess = vi.fn();
  render(<Login onSuccess={onSuccess} />);
  await user.type(screen.getByLabelText("Email"), "person@example.test");
  await user.type(screen.getByLabelText("Password"), "incorrect-password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Invalid email or password",
  );
  expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
    "person@example.test",
  );
  expect(onSuccess).not.toHaveBeenCalled();
});
test("login handles a disconnected network and allows retry", async () => {
  signIn
    .mockRejectedValueOnce(new Error("Network failure"))
    .mockResolvedValueOnce({ data: {} });
  const user = userEvent.setup();
  const onSuccess = vi.fn();
  render(<Login onSuccess={onSuccess} />);
  await user.type(screen.getByLabelText("Email"), "person@example.test");
  await user.type(screen.getByLabelText("Password"), "correct-password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Unable to connect",
  );
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(onSuccess).toHaveBeenCalledOnce();
});
