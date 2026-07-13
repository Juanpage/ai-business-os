/*
  Warnings:

  - Added the required column `line_total` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `product_name` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unit_price` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amount` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "line_total" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "product_name" JSONB NOT NULL,
ADD COLUMN     "quantity" INTEGER NOT NULL,
ADD COLUMN     "unit_price" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "amount" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;
