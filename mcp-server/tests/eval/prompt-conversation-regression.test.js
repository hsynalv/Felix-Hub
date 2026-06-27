import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(__dirname, "conversations");

describe("prompt conversation regression (LLM gate)", () => {
  it("golden fixtures directory exists", () => {
    expect(existsSync(GOLDEN_DIR)).toBe(true);
  });

  it.skipIf(!process.env.OPENAI_API_KEY)(
    "runs golden JSON fixtures when OPENAI_API_KEY is set",
    async () => {
      const fixtures = readdirSync(GOLDEN_DIR).filter((f) => f.endsWith(".json"));
      expect(fixtures.length).toBeGreaterThan(0);
      // P1: wire LLM-as-judge + tool-choice assertions per fixture
    }
  );
});
