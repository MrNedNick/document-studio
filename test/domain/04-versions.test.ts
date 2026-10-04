import { describe, expect, it } from "vitest";
import { AUTO_EVERY, DAY, HOUR, makeRevision, MAX_REVISIONS, pruneRevisions, restore, shouldSnapshot, wordChange } from "../../src/domain/04-versions";
import { doc, monthOfWriting, NOW, rev } from "../fixtures/04-versions/history";

describe("automatic versions", () => {
  it("one every five minutes while the text changes, none while it doesn't", () => {
    const current = doc("hello there");
    expect(shouldSnapshot([], current, NOW)).toBe(true);
    const last = makeRevision(current, "auto", "a", NOW - AUTO_EVERY + 1000);
    expect(last.ok && shouldSnapshot([last.value], doc("hello there, friend"), NOW)).toBe(false); // too soon
    expect(last.ok && shouldSnapshot([last.value], doc("hello there, friend"), NOW + 1000)).toBe(true);
    expect(last.ok && shouldSnapshot([last.value], current, NOW + HOUR)).toBe(false); // nothing changed
  });

  it("a version keeps its own copy: editing the document afterwards doesn't change it", () => {
    const current = doc("before");
    const saved = makeRevision(current, "manual", "m", NOW, "  Sent to legal  ");
    (current.body.content[0]!.content![0] as { text: string }).text = "after";
    expect(saved.ok && saved.value).toMatchObject({ name: "Sent to legal", words: 1 });
    expect(saved.ok && JSON.stringify(saved.value.body)).toContain("before");
    expect(makeRevision(current, "manual", "m", NOW, "x".repeat(81))).toMatchObject({ ok: false, error: { reason: "name-too-long" } });
  });
});

describe("pruning", () => {
  it("keeps the last hour whole, one per hour for a day, one per day for a month — and hand-saved ones forever", () => {
    const all = monthOfWriting();
    const { keep, drop } = pruneRevisions(all, NOW);
    expect(keep.length + drop.length).toBe(all.length);
    expect(keep.filter((r) => NOW - r.createdAt <= HOUR && r.reason === "auto")).toHaveLength(7); // 0,10,…,60 min
    expect(keep.filter((r) => r.reason === "auto" && NOW - r.createdAt > 30 * DAY)).toHaveLength(0);
    expect(keep.some((r) => r.reason === "manual")).toBe(true);
    expect(keep.some((r) => r.reason === "before-restore")).toBe(true);
    expect(keep.length).toBeLessThanOrEqual(MAX_REVISIONS);
    // Roughly: 7 + 23 hourly + 29 daily + 2 kept by hand.
    expect(keep.length).toBeGreaterThan(55);
    expect(keep.length).toBeLessThan(70);
  });
});

describe("restoring", () => {
  it("brings the old text back and keeps the current one as a version first", () => {
    const old = rev(DAY, "auto", "the first draft");
    const current = doc("a later draft");
    const result = restore(current, [old], old.id, "safety", NOW);
    expect(result.ok && result.value.document.body).toEqual(old.body);
    expect(result.ok && result.value.safety).toMatchObject({ id: "safety", reason: "before-restore", body: current.body });
  });

  it("names what is wrong: an unknown version, or one that no longer reads", () => {
    const current = doc("x");
    expect(restore(current, [], "nope", "s", NOW)).toEqual({ ok: false, error: { kind: "versions", reason: "unknown-revision", id: "nope" } });
    const broken = { ...rev(HOUR), body: { type: "doc" as const, content: [{ type: "marquee" }] } };
    expect(restore(current, [broken], broken.id, "s", NOW)).toMatchObject({ ok: false, error: { reason: "revision-damaged" } });
  });
});

it("describes how much a version changed", () => {
  expect(wordChange({ words: 130 }, { words: 10 })).toBe("+120 words");
  expect(wordChange({ words: 9 }, { words: 10 })).toBe("−1 word");
  expect(wordChange({ words: 9 }, { words: 9 })).toBe("same length");
  expect(wordChange({ words: 1 })).toBe("1 word");
});
