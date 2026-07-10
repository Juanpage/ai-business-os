/*
  Warnings:

  - Added the required column `full_name` to the `customers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "document_id" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "full_name" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT;
