-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "promotion_id" UUID;

-- CreateIndex
CREATE INDEX "orders_promotion_id_idx" ON "orders"("promotion_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
