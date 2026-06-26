import { describe, it, expect } from "vitest";
import { redactIntentSampleText } from "../../src/core/chat/intent-sample-redaction.js";

describe("intent-sample-redaction", () => {
  it("redacts email and api keys", () => {
    const { text, redactions } = redactIntentSampleText(
      "contact me at user@example.com with sk-abcdefghijklmnopqrstuvwxyz123456"
    );
    expect(text).not.toContain("user@example.com");
    expect(text).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(redactions).toContain("email");
    expect(redactions).toContain("api_key");
  });

  it("redacts phone and payment amounts", () => {
    const { text, redactions } = redactIntentSampleText("ara +90 532 123 45 67, tutar ₺12.500 tl");
    expect(text).toContain("[REDACTED_PHONE]");
    expect(text).toContain("[REDACTED_AMOUNT]");
    expect(redactions).toEqual(expect.arrayContaining(["phone", "amount_tr"]));
  });
});
