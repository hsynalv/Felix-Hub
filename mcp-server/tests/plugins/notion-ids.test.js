import { describe, it, expect } from "vitest";
import { normalizeNotionId, normalizeNotionIdIfApplicable } from "../../src/plugins/notion/notion-ids.js";

describe("notion-ids", () => {
  it("strips query string from pasted id", () => {
    expect(normalizeNotionId("f6760b0f0783417db4a89b7edce9e654?v=e2bf505494274c7cb86")).toBe(
      "f6760b0f-0783-417d-b4a8-9b7edce9e654"
    );
  });

  it("extracts id from notion url", () => {
    expect(
      normalizeNotionId(
        "https://www.notion.so/myworkspace/f6760b0f0783417db4a89b7edce9e654?v=e2bf505494274c7cb86"
      )
    ).toBe("f6760b0f-0783-417d-b4a8-9b7edce9e654");
  });

  it("normalizes on save for notion env keys", () => {
    expect(
      normalizeNotionIdIfApplicable(
        "NOTION_PROJECTS_DB_ID",
        "f6760b0f0783417db4a89b7edce9e654?v=abc"
      )
    ).toBe("f6760b0f-0783-417d-b4a8-9b7edce9e654");
  });
});
