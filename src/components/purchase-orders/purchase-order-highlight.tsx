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

    let attempts = 0;
    let timeoutId: number | null = null;

    const scrollToOrder = () => {
      const element = Array.from(document.querySelectorAll<HTMLElement>(`[data-po-anchor="${orderId}"]`))
        .find((candidate) => candidate.offsetParent !== null || candidate.getClientRects().length > 0);

      if (!element) {
        attempts += 1;

        if (attempts < 12) {
          timeoutId = window.setTimeout(scrollToOrder, 120);
        }

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

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [orderId]);

  return null;
}
