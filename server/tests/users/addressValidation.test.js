import { describe, it, expect, vi } from "vitest";
import { addressSchema, updateAddressSchema } from "../../validation/addressSchemas.js";
import { createOrderSchema } from "../../validation/orderSchemas.js";
import { validate } from "../../middleware/validate.js";

const address = { fullName: "Test Customer", address: "18 Example Street", city: "city",
  state: "state", postalCode: "12345", country: "country", phoneNumber: "12345678910" };

describe("saved address and checkout validation", () => {
  it.each([undefined, "", "   "])("rejects a missing/blank state before reaching the save handler: %s", (state) => {
    const request = { body: { ...address, state } };
    const next = vi.fn();
    validate(addressSchema)(request, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(next.mock.calls[0][0].message).toContain("state");
  });
  it("accepts the same complete address for saving and direct checkout", () => {
    const saved = addressSchema.parse({ ...address, state: " state " });
    expect(saved.state).toBe("state");
    expect(createOrderSchema.parse({ shippingAddress: saved, paymentMethod: "cod", idempotencyKey: "address-checkout" }).shippingAddress).toEqual(saved);
  });
  it("permits partial repairs but never allows clearing the state", () => {
    expect(updateAddressSchema.parse({ state: "state" })).toEqual({ state: "state" });
    expect(updateAddressSchema.parse({ label: "Home" })).toEqual({ label: "Home" });
    expect(updateAddressSchema.safeParse({ state: "  " }).success).toBe(false);
  });
  it("retains the saved-address ID contract for checkout", () => {
    expect(createOrderSchema.safeParse({ shippingAddressId: "10000000-0000-4000-8000-000000000001", paymentMethod: "cod", idempotencyKey: "address-checkout" }).success).toBe(true);
  });
  it("requires a retry key even with a valid saved address", () => {
    expect(createOrderSchema.safeParse({shippingAddressId:"10000000-0000-4000-8000-000000000001",paymentMethod:"cod"}).success).toBe(false);
  });
});
