import { describe, expect, it } from "vitest";

import goodsCategoryValidator from "../../../src/modules/goodsCategory/goodsCategory.validator.js";

const goodsCategoryId = "507f1f77bcf86cd799439011";

describe("goodsCategoryValidator.createGoodsCategorySchema", () => {
  it("trims a valid name and description and supplies an empty description by default", () => {
    const result = goodsCategoryValidator.createGoodsCategorySchema.validate({
      goodsCategoryName: "  Electronics ",
      description: "  Consumer devices ",
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      goodsCategoryName: "Electronics",
      description: "Consumer devices",
    });
    expect(
      goodsCategoryValidator.createGoodsCategorySchema.validate({
        goodsCategoryName: "Books",
      }).value.description,
    ).toBe("");
  });

  it.each([
    ["missing name", {}],
    ["blank name", { goodsCategoryName: "   " }],
    ["name shorter than minimum", { goodsCategoryName: "A" }],
    ["name longer than maximum", { goodsCategoryName: "A".repeat(101) }],
    [
      "description longer than maximum",
      {
        goodsCategoryName: "Books",
        description: "A".repeat(501),
      },
    ],
  ])("rejects %s", (_case, input) => {
    expect(
      goodsCategoryValidator.createGoodsCategorySchema.validate(input).error,
    ).toBeDefined();
  });
});

describe("goodsCategoryValidator.updateGoodsCategorySchema", () => {
  it("requires at least one field and validates partial updates", () => {
    expect(
      goodsCategoryValidator.updateGoodsCategorySchema.validate({}).error
        ?.details[0].type,
    ).toBe("object.min");
    expect(
      goodsCategoryValidator.updateGoodsCategorySchema.validate({
        goodsCategoryName: "  Updated name ",
      }).value.goodsCategoryName,
    ).toBe("Updated name");
    expect(
      goodsCategoryValidator.updateGoodsCategorySchema.validate({
        goodsCategoryName: "A",
      }).error,
    ).toBeDefined();
    expect(
      goodsCategoryValidator.updateGoodsCategorySchema.validate({
        description: "A".repeat(501),
      }).error,
    ).toBeDefined();
  });
});

describe("goodsCategoryValidator ID and query schemas", () => {
  it("accepts valid category IDs and rejects malformed ones", () => {
    expect(
      goodsCategoryValidator.paramGoodsCategoryIdSchema.validate({
        goodsCategoryId,
      }).error,
    ).toBeUndefined();
    expect(
      goodsCategoryValidator.paramGoodsCategoryIdSchema.validate({
        goodsCategoryId: "category-1",
      }).error,
    ).toBeDefined();
  });

  it("applies query defaults and validates pagination, status, and sorting", () => {
    expect(
      goodsCategoryValidator.queryGoodsCategorySchema.validate({}).value,
    ).toMatchObject({
      status: "active",
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    const { error, value } =
      goodsCategoryValidator.queryGoodsCategorySchema.validate({
        page: 2,
        limit: 25,
        search: "  books ",
        status: "deleted",
        sortBy: "goodsCategoryName",
        sortOrder: "asc",
      });
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      page: 2,
      limit: 25,
      search: "books",
      status: "deleted",
      sortBy: "goodsCategoryName",
      sortOrder: "asc",
    });

    for (const query of [
      { page: 0 },
      { limit: 101 },
      { status: "archived" },
      { sortBy: "deletedAt" },
      { sortOrder: "ascending" },
    ]) {
      expect(
        goodsCategoryValidator.queryGoodsCategorySchema.validate(query).error,
      ).toBeDefined();
    }
  });
});
