const backend = Bun.spawn(["bun", "--watch", "src/server/index.ts"], {
  stdio: ["inherit", "inherit", "inherit"],
});
const frontend = Bun.spawn(
  ["bun", "x", "--bun", "vite", "--host", "127.0.0.1"],
  { stdio: ["inherit", "inherit", "inherit"] },
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    backend.kill();
    frontend.kill();
  });
await Promise.race([backend.exited, frontend.exited]);
backend.kill();
frontend.kill();
export {};
