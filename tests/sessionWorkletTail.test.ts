import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
it("flushes the final sub-frame before acknowledging microphone stop", () => {
  const messages: unknown[] = [];
  let Capture!: new () => {
    port: { onmessage: (event: { data: { type: string } }) => void };
    process: (input: Float32Array[][], output: Float32Array[][]) => void;
  };
  const source = ts.transpileModule(
    readFileSync("src/session/audio.worklet.ts", "utf8").replace(
      "export {};",
      "",
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.None,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    Float32Array,
    sampleRate: 16000,
    AudioWorkletProcessor: class {
      port = {
        postMessage: (data: unknown) => messages.push(data),
        onmessage: null,
      };
    },
    registerProcessor: (_name: string, ctor: typeof Capture) => {
      Capture = ctor;
    },
  });
  const capture = new Capture();
  capture.process([[new Float32Array(123).fill(0.004)]], []);
  expect(messages).toHaveLength(0);
  capture.port.onmessage({ data: { type: "flush" } });
  expect(messages).toHaveLength(2);
  expect(messages[0]).toEqual(new Float32Array(123).fill(0.004));
  expect(messages[1]).toEqual({ type: "flushed" });
});
