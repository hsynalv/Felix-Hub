import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  scheduleTelegramWorkingAck,
  TELEGRAM_WORKING_ACK_DELAY_MS,
} from "../../src/plugins/notifications/telegram.webhook.js";

describe("scheduleTelegramWorkingAck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onAck after delay", () => {
    const onAck = vi.fn();
    scheduleTelegramWorkingAck({ onAck, delayMs: TELEGRAM_WORKING_ACK_DELAY_MS });
    expect(onAck).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TELEGRAM_WORKING_ACK_DELAY_MS);
    expect(onAck).toHaveBeenCalledTimes(1);
  });

  it("does not fire after cancel", () => {
    const onAck = vi.fn();
    const handle = scheduleTelegramWorkingAck({ onAck, delayMs: 1000 });
    handle.cancel();
    vi.advanceTimersByTime(2000);
    expect(onAck).not.toHaveBeenCalled();
  });

  it("skips timer when delay is zero", () => {
    const onAck = vi.fn();
    scheduleTelegramWorkingAck({ onAck, delayMs: 0 });
    vi.advanceTimersByTime(5000);
    expect(onAck).not.toHaveBeenCalled();
  });
});
