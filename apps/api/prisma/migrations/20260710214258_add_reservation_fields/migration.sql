/*
  Warnings:

  - Added the required column `party_size` to the `reservations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reserved_at` to the `reservations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "party_size" INTEGER NOT NULL,
ADD COLUMN     "reserved_at" TIMESTAMP(3) NOT NULL;
