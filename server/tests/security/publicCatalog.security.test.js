import {listenForFetch} from "../helpers/listenForFetch.js";
import http from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: {}, calls: [], requests: [] }));
vi.mock("../../middleware/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../../config/db.js", () => {
  // SDK-boundary fixture, not an RLS simulation. Real PostgreSQL role tests live
  // in tests/rls/storefront.sql. Here the actual routers/controllers must choose
  // the safe views, project safe columns, and produce the frontend envelopes.
  const client = { from: (table) => {
    if (!table.startsWith("storefront_")) throw new Error(`Public controller accessed base/private table: ${table}`);
    const call = { table, fields: null, filters: [] };
    state.calls.push(call);
    let rows = [...(state.rows[table] || [])];
    let start = 0; let end = Infinity; let single = false; let optional = false;
    const query = {
      select(fields) {
        if (!fields || fields.includes("*")) throw new Error("Wildcard public projection");
        call.fields = fields.split(",").map((field) => field.trim());
        return this;
      },
      eq(field, value) { call.filters.push([field, value]); rows = rows.filter((row) => row[field] === value); return this; },
      in(field, values) { call.filters.push([field, values]); rows = rows.filter((row) => values.includes(row[field])); return this; },
      neq(field, value) { rows = rows.filter((row) => row[field] !== value); return this; },
      gt(field, value) { rows = rows.filter((row) => row[field] > value); return this; },
      gte(field, value) { rows = rows.filter((row) => (field === "ratings->average" ? row.ratings?.average : row[field]) >= value); return this; },
      lte(field, value) { rows = rows.filter((row) => (field === "ratings->average" ? row.ratings?.average : row[field]) <= value); return this; },
      contains(field, values) { rows = rows.filter((row) => values.every((value) => row[field]?.includes(value))); return this; },
      or(expression) {
        call.expression = expression;
        rows = rows.filter((row) => expression.split(",").some((part) => {
          const [field, , term] = part.split(".");
          return String(row[field] || "").toLowerCase().includes(term.replaceAll("%", "").replaceAll('"', '').toLowerCase());
        }));
        return this;
      },
      order(field) { call.order ??= field; call.orders = [...(call.orders || []),field]; return this; },
      range(from, to) { start = from; end = to + 1; return this; },
      limit(limit) { end = limit; return this; },
      single() { single = true; return this; },
      maybeSingle() { single = true; optional = true; return this; },
      then(resolve, reject) {
        const data = rows.slice(start, end).map((row) => Object.fromEntries(call.fields.map((field) => [field, row[field]])));
        return Promise.resolve({ data: single ? data[0] || null : data,
          count: rows.length, error: single && !data.length && !optional ? { code: "PGRST116" } : null }).then(resolve, reject);
      },
    };
    return query;
  } };
  return {
    getSupabaseClient: (req) => { state.requests.push(req); return client; },
    getServiceClient: () => new Proxy({}, { get: () => { throw new Error("Service role used for public catalog"); } }),
  };
});

import products from "../../routes/productRoutes.js";
import reviews from "../../routes/reviewRoutes.js";

const id = "20000000-0000-4000-8000-000000000001";
let server;
let base;
beforeAll(async () => {
  const app = express();
  app.use("/products", products);
  app.use("/reviews", reviews);
  app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ message: err.message }));
  server = http.createServer(app);
  await listenForFetch(server);
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  state.calls.length = 0; state.requests.length = 0;
  state.rows = {
    storefront_brands: [{brand:"Public Brand"}],
    storefront_categories: [{category:"GPU"}],
    storefront_products: [{ id, name: "Public GPU", category: "GPU", brand: "Public Brand",
      original_price: 100, final_price: 90, stock: 5, availability: "In Stock", images: [], description: "Public hardware",
      ratings: { average: 4.8, totalReviews: 10 }, is_active: true, is_featured: true,
      sales_count: 999, supplier_info: "PRIVATE", internal_cost: 1, hidden_stock_metadata: { warehouse: 99 } }],
    storefront_reviews: [{ id: "30000000-0000-4000-8000-000000000001", product_id: id,
      rating: 5, title: "Approved review", comment: "Public review text", user_id: "PRIVATE",
      report_reason: "PRIVATE", user: { email: "PRIVATE" }, is_active: true }],
    storefront_games: [{ id: "game-id", product_id: id, developer: "Studio", publisher: "Publisher", internal_cost: 1 }],
    storefront_prebuilt_pcs: [{ id: "pc-id", product_id: id, name: "Public PC", supplier_info: "PRIVATE" }],
  };
});
afterAll(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });

describe("anonymous catalog controllers", () => {
  it.each(["/products", "/products/search?q=Public", `/products/${id}`, `/products/${id}/reviews`,
    "/products/top", "/products/categories", "/products/brands", "/products/featured", "/products/category/GPU"])
    ("returns public fixture data at %s", async (path) => {
      const res = await fetch(base + path);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      if (Array.isArray(body.data)) expect(body.data.length).toBeGreaterThan(0);
      else expect(body.data.id).toBe(id);
      expect(state.requests.length).toBeGreaterThan(0);
      expect(state.requests.every((req) => !req.headers.authorization)).toBe(true);
      expect(JSON.stringify(body)).not.toMatch(/PRIVATE|supplier_info|internal_cost|hidden_stock_metadata|salesCount|report_reason/);
    });
  it("filters ratings before counting and paging", async () => {
    state.rows.storefront_products.unshift({...state.rows.storefront_products[0], id: 'low-rating', ratings:{average:1,totalReviews:2}});
    const body = await (await fetch(base + '/products?minRating=4&page=1&limit=1')).json();
    expect(body.total).toBe(1); expect(body.data[0].id).toBe(id);
  });
  it("filters multiple brands with OR before counting and pagination while keeping legacy brand links", async () => {
    const original = state.rows.storefront_products[0];
    state.rows.storefront_products = [original, {...original,id:"other",brand:"Other"}, {...original,id:"third",brand:"Excluded"}, {...original,id:"hidden",is_active:false}];
    const body = await (await fetch(base + '/products?' + new URLSearchParams({brands:JSON.stringify(["Public Brand","Other"]),limit:"1"}))).json();
    expect(body.total).toBe(2); expect(body.results).toBe(1);
    expect(state.calls[0].filters).toContainEqual(["brand", ["Public Brand","Other"]]);
    const legacy = await (await fetch(base + '/products?brand=Other')).json();
    expect(legacy.total).toBe(1); expect(legacy.data[0].id).toBe("other");
  });
  it("normalizes alias specs before counting/pagination and intersects independent facets", async () => {
    const original = state.rows.storefront_products[0];
    state.rows.storefront_products = [
      {...original,id:"12-dual",specifications:{VRAM:"12GB",Cooling:"Dual fan"}},
      {...original,id:"16-dual",specifications:[{key:"Video Memory",value:"16 GB"},{key:"Cooling System",value:"Dual fan"}]},
      {...original,id:"12-triple",specifications:{Memory:"12 GB",Cooling:"Triple fan"}},
      {...original,id:"private",is_active:false,specifications:{Memory:"12 GB",Cooling:"Dual fan"}},
    ];
    const params = new URLSearchParams({category:"GPU",specs:JSON.stringify({memory:["12 GB","16gb"],cooling:["dual fan"]}),page:"2",limit:"1"});
    const body = await (await fetch(base + '/products?' + params)).json();
    expect(body.total).toBe(2); expect(body.data.map(product=>product.id)).toEqual(["16-dual"]);
    expect(state.calls).toHaveLength(2);
    expect(state.calls[0].fields).toEqual(["id","category","brand","specifications"]);
    expect(state.calls[1].filters).toContainEqual(["id",["16-dual"]]);
  });
  it("serves exact safe facets in context before brand/spec selections, excluding hidden metadata", async () => {
    const original = state.rows.storefront_products[0];
    state.rows.storefront_products = [
      {...original,specifications:{Memory:"12 GB"}},
      {...original,id:"other",brand:"Other",specifications:{VRAM:"12GB"}},
      {...original,id:"expensive",final_price:300,specifications:{Memory:"16 GB"}},
      {...original,id:"inactive",is_active:false,brand:"PRIVATE",specifications:{Memory:"PRIVATE"}},
    ];
    const params = new URLSearchParams({category:"GPU",maxPrice:"100",brand:"Other",specs:JSON.stringify({memory:["16 gb"]})});
    const body = await (await fetch(base + '/products/facets?' + params)).json();
    expect(body.data).toMatchObject({available:true,candidateLimit:1000,scopeTotal:2});
    expect(body.data.brands).toEqual([{value:"Other",count:1},{value:"Public Brand",count:1}]);
    expect(body.data.specs[0].options).toMatchObject([{value:"12 gb",count:2}]);
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE|supplier_info|internal_cost|sales_count|images/);
    expect(state.calls[0].filters).toContainEqual(["is_active",true]);
  });
  it("never provides partial facet counts or silently ignores specs above the bound", async () => {
    state.rows.storefront_products = Array.from({length:1001},(_,index)=>({...state.rows.storefront_products[0],id:`row-${index}`,specifications:{Memory:"12 GB"}}));
    const body = await (await fetch(base + '/products/facets?category=GPU')).json();
    expect(body.data).toMatchObject({available:false,scopeTotal:1001,brands:[],specs:[]});
    const res = await fetch(base + '/products?' + new URLSearchParams({category:"GPU",specs:JSON.stringify({memory:["12 gb"]})}));
    expect(res.status).toBe(422);
    expect((await res.json()).message).toMatch(/Narrow your category/);
  });
  it.each([{brands:'["Brand",42]'}, {brands:'{"invalid":1}'}, {specs:'{"socket":["AM5"]}',category:"GPU"}, {specs:'{"memory":"12 GB"}',category:"GPU"}, {minPrice:"Infinity"}, {minPrice:"100",maxPrice:"99"}])("rejects invalid catalog filters %j", async params => {
    expect((await fetch(base + '/products?' + new URLSearchParams(params))).status).toBe(400);
    expect(state.calls).toHaveLength(0);
  });
  it("quotes reserved search grammar rather than interpolating extra filter operators", async () => {
    await fetch(base + '/products?' + new URLSearchParams({q:'GPU),is_active.eq.false,"'}));
    expect(state.calls[0].expression).toContain('name.ilike."%GPU),is\\_active.eq.false,\\"%"');
    expect(state.calls[0].filters).toContainEqual(["is_active",true]);
  });
  it("filters active discounts before counting and paging", async () => {
    const original = state.rows.storefront_products[0];
    state.rows.storefront_products = [
      {...original, id:'regular', discount_percentage:0},
      {...original, id:'sale', discount_percentage:15},
      {...original, id:'hidden-sale', discount_percentage:90, is_active:false},
    ];
    const body = await (await fetch(base + '/products?discounted=true&sort=-discount_percentage&limit=1')).json();
    expect(body.total).toBe(1);
    expect(body.data[0].id).toBe('sale');
    expect(state.calls[0].order).toBe('discount_percentage');
    expect(state.calls[0].orders).toEqual(['discount_percentage','id']);
  });
  it.each(['/products/featured', '/products/top', '/products/search?q=Public'])('returns usable prices and stock at %s', async path => {
    const body = await (await fetch(base+path)).json();
    expect(body.data[0]).toMatchObject({originalPrice:100,finalPrice:90,stock:5,availability:'In Stock'});
  });
  it("keeps hidden products unavailable at detail and excludes them from categories", async () => {
    const res = await fetch(`${base}/products/20000000-0000-4000-8000-000000000002`);
    expect(res.status).toBe(404);
    const categories = await (await fetch(`${base}/products/categories`)).json();
    expect(categories.data).toEqual(["GPU"]);
  });
  it("does not allow query parameters to request inactive rows or sort internal columns", async () => {
    expect((await fetch(`${base}/products?isActive=false&sort=internal_cost`)).status).toBe(200);
    expect(state.calls[0].filters).toContainEqual(["is_active", true]);
    expect(state.calls[0].order).toBe("created_at");
  });
  it("returns anonymous review authors without querying private users", async () => {
    const body = await (await fetch(`${base}/products/${id}`)).json();
    expect(body.data.reviews[0].user).toBeNull();
    expect(state.calls.map((call) => call.table)).toEqual([
      "storefront_products", "storefront_reviews", "storefront_games", "storefront_prebuilt_pcs",
    ]);
    const alias = await fetch(`${base}/reviews/products/${id}/reviews`);
    expect(alias.status).toBe(200);
    expect(alias.headers.get("deprecation")).toBe("true");
  });
});
