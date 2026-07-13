/*
  Warnings:

  - Added the required column `name` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `starts_at` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discount_type` to the `promotions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discount_value` to the `promotions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `promotions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PromotionDiscountType" AS ENUM ('percentage', 'fixed');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "cover_price" DECIMAL(12,2),
ADD COLUMN     "description" JSONB,
ADD COLUMN     "ends_at" TIMESTAMP(3),
ADD COLUMN     "name" JSONB NOT NULL,
ADD COLUMN     "starts_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "description" JSONB,
ADD COLUMN     "discount_type" "PromotionDiscountType" NOT NULL,
ADD COLUMN     "discount_value" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "ends_at" TIMESTAMP(3),
ADD COLUMN     "name" JSONB NOT NULL,
ADD COLUMN     "starts_at" TIMESTAMP(3);
