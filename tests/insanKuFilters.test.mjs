import assert from "node:assert/strict";
import test from "node:test";
import { matchesInsanKuFilters } from "../src/lib/insanKuFilters.js";

const person = { name: "Budi Santoso", outlet_placements: [
  { outlet_uuid: "a", pharmapp_account: "budi@pharmapp", jabatan_list: [{ uuid_jabatan_master: "apoteker", is_active: true }, { uuid_jabatan_master: "inventory", is_active: true }, { uuid_jabatan_master: "old", is_active: false }] },
  { outlet_uuid: "b", pharmapp_account: "budi@outlet-b", jabatan_list: [{ uuid_jabatan_master: "admin", is_active: true }] },
  { outlet_uuid: "inactive", is_active: false, pharmapp_account: "archived-account", jabatan_list: [{ uuid_jabatan_master: "manager", is_active: true }] },
] };

test("search finds partial names and PharmApp accounts regardless of case and surrounding spaces", () => {
  for (const search of ["BUDI", " santos ", " PHARMAPP ", "budi@outlet-b", ""]) assert.equal(matchesInsanKuFilters(person, { search }), true);
  for (const search of ["unknown", "archived-account"]) assert.equal(matchesInsanKuFilters(person, { search }), false);
});

test("position filter matches any active position on an active placement", () => {
  for (const jabatan of ["apoteker", "inventory", "admin", "all"]) assert.equal(matchesInsanKuFilters(person, { jabatan }), true);
  for (const jabatan of ["old", "manager", "missing"]) assert.equal(matchesInsanKuFilters(person, { jabatan }), false);
});

test("outlet, position and account must match the same placement", () => {
  assert.equal(matchesInsanKuFilters(person, { outlet: "a", jabatan: "inventory", search: "pharmapp" }), true);
  assert.equal(matchesInsanKuFilters(person, { outlet: "a", jabatan: "admin" }), false);
  assert.equal(matchesInsanKuFilters(person, { outlet: "a", search: "outlet-b" }), false);
  assert.equal(matchesInsanKuFilters(person, { jabatan: "admin", search: "pharmapp" }), false);
  assert.equal(matchesInsanKuFilters(person, { outlet: "a", jabatan: "inventory", search: "budi" }), true);
});

test("missing fields and legacy single-position data are supported", () => {
  assert.equal(matchesInsanKuFilters({ name: "Budi" }, { search: "budi" }), true);
  assert.equal(matchesInsanKuFilters({ name: "Budi" }, { jabatan: "admin" }), false);
  assert.equal(matchesInsanKuFilters({ outlet_placements: [{ uuid_jabatan_master: "admin", jabatan_is_active: true }] }, { jabatan: "admin" }), true);
  assert.equal(matchesInsanKuFilters({ outlet_placements: [{ uuid_jabatan_master: "admin", jabatan_is_active: false }] }, { jabatan: "admin" }), false);
});
