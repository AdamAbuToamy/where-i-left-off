import { it, expect } from "vitest";
import {
  isUniversityReminderProject,
  universityReminderProjectIds,
  universityReminderProjectIdsFromRecords,
} from "../shared/universityCardVisibility.mjs";
it("excludes only exact linked native backing records, preserving same-title personal cards", () => {
  const ids = universityReminderProjectIds([
    { reminderProjectId: "a".repeat(20) },
    {},
  ]);
  const helper = {
    id: "a".repeat(20),
    name: "Assignment 2",
    kind: "deadline",
    resourceType: "course",
  };
  expect(isUniversityReminderProject(helper, ids)).toBe(true);
  expect(
    isUniversityReminderProject({ ...helper, id: "b".repeat(20) }, ids),
  ).toBe(false);
  expect(isUniversityReminderProject({ ...helper, kind: "resume" }, ids)).toBe(
    false,
  );
  expect(
    isUniversityReminderProject({ ...helper, resourceType: "project" }, ids),
  ).toBe(false);
  expect(isUniversityReminderProject(helper, new Set())).toBe(false);
});
it("ignores malformed or absent links", () => {
  expect(
    universityReminderProjectIds([
      { reminderProjectId: "other-account/path" },
      {},
    ]).size,
  ).toBe(0);
});

it('only trusts live task records with matching payload identity, not deleted or malformed links',()=>{
 const record={kind:'tasks',id:'task',deleted:false,payload:JSON.stringify({id:'task',reminderProjectId:'a'.repeat(20)})};expect(universityReminderProjectIdsFromRecords([record]).size).toBe(1);for(const other of [{...record,deleted:true},{...record,kind:'courses'},{...record,id:'other'},{...record,payload:'{bad'}])expect(universityReminderProjectIdsFromRecords([other]).size).toBe(0);
});
