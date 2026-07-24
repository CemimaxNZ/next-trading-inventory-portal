"use client";

import { useEffect } from "react";

type PurchaseOrderHighlightProps = {
  orderId?: string;
};

export function PurchaseOrderHighlight({ orderId }: PurchaseOrderHighlightProps) {
  useEffect(() => {
    if (!orderId) {
      return;
    }

    const scrollToOrder = () => {
      const element = document.getElementById(`po-${orderId}`);

      if (!element) {
        return;
      }

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    };

    window.requestAnimationFrame(() => {
      window.setTimeout(scrollToOrder, 120);
    });
  }, [orderId]);

  return null;
}
