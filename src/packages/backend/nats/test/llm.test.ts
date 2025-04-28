/*
Test LLM NATS streaming.

DEVELOPMENT:

   pnpm exec jest --watch --forceExit --detectOpenHandles "llm.test.ts"

*/

// this sets client
import "@cocalc/backend/nats";

import { init, close } from "@cocalc/nats/llm/server";
import { llm } from "@cocalc/nats/llm/client";

describe("create an llm server, client, and stub evaluator, and run an evaluation", () => {
  // define trivial evaluate
  const OUTPUT = "Thanks for asing about ";
  async function evaluate({ input, stream }) {
    stream(OUTPUT);
    stream(input);
    stream();
  }

  it("creates the server", async () => {
    await init(evaluate);
  });

  it("calls the llm", async () => {
    const v: (string | null)[] = [];
    const input = "cocalc";
    const all = await llm({
      account_id: "00000000-0000-4000-8000-000000000000",
      system: "in cocalc",
      input,
      stream: (text) => {
        v.push(text);
      },
    });
    expect(all).toBe(OUTPUT + input);
    expect(v[0]).toBe(OUTPUT);
    expect(v[1]).toBe(input);
  });

  it("closes the server", async () => {
    await close();
  });
});

describe("test an evaluate that throws an error half way through", () => {
  // define trivial evaluate
  const OUTPUT = "Thanks for asing about ";
  const ERROR = "I give up";
  async function evaluate({ stream }) {
    stream(OUTPUT);
    throw Error(ERROR);
  }

  it("creates the server", async () => {
    await init(evaluate);
  });

  it("calls the llm", async () => {
    const v: (string | null)[] = [];
    const input = "cocalc";
    await expect(
      async () =>
        await llm({
          account_id: "00000000-0000-4000-8000-000000000000",
          system: "in cocalc",
          input,
          stream: (text) => {
            v.push(text);
          },
        }),
    ).rejects.toThrow(ERROR);
    expect(v[0]).toBe(OUTPUT);
    expect(v.length).toBe(1);
  });

  it("closes the server", async () => {
    await close();
  });
});
