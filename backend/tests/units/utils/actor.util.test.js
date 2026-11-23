import { describe, expect, it } from "vitest";

import {
  getActorUserId,
  getActorUserIdString,
  getReferenceIdString,
} from "../../../src/utils/actor.util.js";

describe("actor.util", () => {
  it("prefers userId over _id", () => {
    expect(getActorUserId({ userId: "user-1", _id: "user-2" })).toBe("user-1");
  });

  it("does not fall back to _id when userId is missing", () => {
    expect(getActorUserId({ _id: "user-2" })).toBeNull();
  });

  it("returns null when the actor has no id", () => {
    expect(getActorUserId(null)).toBeNull();
    expect(getActorUserId({})).toBeNull();
  });

  it("formats actor ids as strings", () => {
    expect(getActorUserIdString({ userId: "user-1" })).toBe("user-1");
    expect(getActorUserIdString(null)).toBeNull();
  });

  it("formats raw or populated references as strings", () => {
    expect(getReferenceIdString("user-1")).toBe("user-1");
    expect(getReferenceIdString({ _id: "user-2" })).toBe("user-2");
    expect(getReferenceIdString(null)).toBeNull();
  });
});
