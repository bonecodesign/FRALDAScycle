import assert from "node:assert/strict";
import test from "node:test";
import { saleSplit, deliverySplit, exchangeFee, parsePrice, listingPrice } from "../packages/contracts/commercial-rules.js";

test("approved financial examples keep freight separate and exchange per participant", () => {
  assert.deepEqual(saleSplit(10000), { productCents: 10000, platformCents: 800, sellerCents: 9200 });
  assert.deepEqual(deliverySplit(2000), { freightCents: 2000, platformCents: 100, courierCents: 1900 });
  assert.equal(exchangeFee(10000), 250);
  assert.equal(exchangeFee(8000), 200);
  for (const amount of [0, 1, 6, 99, 10001, Number.MAX_SAFE_INTEGER]) {
    const sale = saleSplit(amount);
    assert.equal(sale.platformCents + sale.sellerCents, amount);
  }
  for (const invalid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => saleSplit(invalid), RangeError);
  }
});

test("publication preserves entered Brazilian prices and rejects absent or ambiguous prices", () => {
  for (const [input, expected] of [["R$ 45,00",4500],["1.234,56",123456],["12,5",1250],["100",10000]]) {
    assert.equal(parsePrice(input), expected);
    assert.equal(listingPrice({kind:"sale",priceCents:parsePrice(input)}), expected);
  }
  for (const input of ["", "0", "-1", "abc", "12.50", "1,234", "Infinity"]) assert.equal(parsePrice(input), null);
  assert.throws(() => listingPrice({kind:"sale"}), RangeError);
  assert.equal(listingPrice({kind:"donation",priceCents:4500}), null);
  assert.equal(listingPrice({kind:"exchange",priceCents:4500}), null);
});
