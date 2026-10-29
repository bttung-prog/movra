import mongoose from "mongoose";

const goodsCategoriesSchema = new mongoose.Schema(
  {
    goodsCategoryName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

goodsCategoriesSchema.index(
  { goodsCategoryName: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: { deletedAt: null },
  },
);
goodsCategoriesSchema.index({ deletedAt: 1, createdAt: -1 });

const GoodsCategory = mongoose.model("GoodsCategory", goodsCategoriesSchema);

export default GoodsCategory;
