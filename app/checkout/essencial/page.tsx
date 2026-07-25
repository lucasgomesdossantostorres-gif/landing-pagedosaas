import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CheckoutForm } from "@/components/billing/checkout-form";

export default function CheckoutEssencialPage() {
  return (
    <div className="relative">
      <CheckoutForm plan="essential" />
    </div>
  );
}