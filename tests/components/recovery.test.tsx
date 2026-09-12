import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrackerProvider } from "../../src/client/TrackerProvider";
afterEach(cleanup);
test("malformed persisted timestamps offer an original export and sign out", async () => {
  const client = new QueryClient();
  client.setQueryData(["tracker", "test-user"], {
    rows: [
      {
        id: crypto.randomUUID(),
        kind: "fast",
        revision: 1,
        date: null,
        category: null,
        data: {
          startTimestampMs: Number.MAX_SAFE_INTEGER,
          endTimestampMs: null,
          timezone: "UTC",
        },
      },
    ],
  });
  const logout = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={client}>
      <TrackerProvider
        userId="test-user"
        onExpired={() => {}}
        onLogout={logout}
      >
        <p>Private tracker</p>
      </TrackerProvider>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "have not been changed",
  );
  expect(screen.queryByText("Private tracker")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Download original export" })
      .getAttribute("href"),
  ).toBe("/api/v1/export");
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(logout).toHaveBeenCalledOnce();
  client.clear();
});
