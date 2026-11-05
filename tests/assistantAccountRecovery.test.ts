import { afterEach, expect, it, vi } from "vitest";
vi.mock("../src/assistant/pollinationsAuth", () => ({
  pollinationsTestMode: () => false,
}));
vi.mock("../src/assistant/accountConnection", () => ({
  accountConnection: vi.fn(),
}));
import { accountConnection } from "../src/assistant/accountConnection";
import { PollinationsAssistant } from "../src/assistant/pollinationsClient";
afterEach(() => vi.resetAllMocks());
for (const [status, error, code] of [
  [429, "assistant-busy", "assistant-busy"],
  [429, "assistant-rate-limit", "ai-rate-limit"],
  [429, "ai-provider-limit", "ai-provider-limit"],
  [504, "assistant-timeout", "assistant-timeout"],
] as const) {
  it(`distinguishes ${error} and accepts a subsequent request without replaying the failed one`, async () => {
    const proxy = vi.mocked(accountConnection);
    proxy
      .mockResolvedValueOnce(Response.json({ error }, { status }))
      .mockResolvedValueOnce(
        Response.json({ choices: [{ message: { content: "Ready" } }] }),
      );
    const assistant = new PollinationsAssistant("alice");
    await expect(
      assistant.conversation({
        message: "Show tomorrow's lessons",
        language: "en",
        history: [],
      }),
    ).rejects.toMatchObject({ code });
    expect(proxy).toHaveBeenCalledTimes(1);
    await expect(
      assistant.conversation({
        message: "Show my cards",
        language: "en",
        history: [],
      }),
    ).resolves.toMatchObject({ text: "Ready" });
    expect(proxy).toHaveBeenCalledTimes(2);
  });
}
