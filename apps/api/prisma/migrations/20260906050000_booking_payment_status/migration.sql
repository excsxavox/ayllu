-- CreateEnum
CREATE TYPE "BookingPaymentStatus" AS ENUM ('PENDING', 'DEPOSIT', 'PAID');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "paymentStatus" "BookingPaymentStatus" NOT NULL DEFAULT 'PENDING';
