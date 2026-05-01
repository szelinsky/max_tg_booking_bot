import { Prisma } from "@prisma/client";

export function formatMoney(price: Prisma.Decimal | null): string {
  if (price === null) {
    return "";
  }

  return ` - ${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(price.toNumber())}`;
}
