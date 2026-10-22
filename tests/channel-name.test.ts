import { describe, expect, it } from "vitest";

import { getChannelDisplayName, isDefaultChannelName } from "@/lib/channel-name";

describe("channel naming", () => {
  it("protects both current and legacy default room names", () => {
    expect(isDefaultChannelName("general")).toBe(true);
    expect(isDefaultChannelName("  SAMANYA SABHA ")).toBe(true);
    expect(isDefaultChannelName("design-room")).toBe(false);
  });

  it("shows legacy default room names in English", () => {
    expect(getChannelDisplayName("samanya sabha")).toBe("general");
    expect(getChannelDisplayName("Design Room")).toBe("Design Room");
  });
});
