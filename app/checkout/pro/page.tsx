import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CheckoutForm } from "@/components/billing/checkout-form";

export default function CheckoutProPage() {
  return (
    <div className="relative">

      <CheckoutForm plan="pro" />
    </div>
  );
}