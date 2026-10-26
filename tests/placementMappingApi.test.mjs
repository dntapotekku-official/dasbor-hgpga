import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseMappingYear } from "../src/lib/placementMapping.js";

const source = readFileSync(new URL("../src/app/api/penempatan-mapping/route.js", import.meta.url), "utf8");
function handler(authorize, getMapping) {
  return new Function("NextResponse", "requireMenuAccess", "buildApiErrorResponse", "getPlacementMapping",
    source.replace(/^import .*;\n/gm, "").replace("export async function", "async function") + "\nreturn GET;",
  )(
    { json: (body, options) => Response.json(body, options) }, authorize,
    (error) => ({ success: false, message: error.message }), getMapping,
  );
}

test("mapping requires the user management permission before loading data", async () => {
  for (const status of [401, 403]) {
    let queried = false;
    const get = handler(async (menu) => {
      assert.equal(menu, "pengaturan-pengguna");
      return Response.json({ success: false }, { status });
    }, async () => { queried = true; });
    assert.equal((await get(new Request("http://localhost/api/penempatan-mapping?year=2026"))).status, status);
    assert.equal(queried, false);
  }
});

test("mapping returns 400 for missing or invalid years and 200 for valid data", async () => {
  const get = handler(async () => null, async (year) => ({ year: parseMappingYear(year), people: [], outlets: [] }));
  for (const query of ["", "?year=wrong", "?year=2026.5", "?year=2201"]) {
    const response = await get(new Request(`http://localhost/api/penempatan-mapping${query}`));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).success, false);
  }
  const response = await get(new Request("http://localhost/api/penempatan-mapping?year=2026"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, data: { year: 2026, people: [], outlets: [] } });
});

test("authentication and database failures produce error responses", async () => {
  for (const failure of ["auth", "database"]) {
    const fail = async () => { throw new Error("Service unavailable"); };
    const get = handler(failure === "auth" ? fail : async () => null, fail);
    const response = await get(new Request("http://localhost/api/penempatan-mapping?year=2026"));
    assert.equal(response.status, 500);
    assert.equal((await response.json()).success, false);
  }
});
