-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'yearly');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "description" TEXT,
ADD COLUMN     "interval" "BillingInterval" NOT NULL DEFAULT 'monthly',
ADD COLUMN     "max_users" INTEGER,
ADD COLUMN     "max_venues" INTEGER,
ADD COLUMN     "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "trial_days" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "current_period_end" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "current_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "trial_ends_at" TIMESTAMP(3);
