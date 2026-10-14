"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { TableRow } from "@/components/ui/table";

// A table row that scrolls itself into view when shown,
// e.g. a freshly added contact somewhere deep in a long list
export function ScrollIntoViewRow(props: ComponentProps<typeof TableRow>) {
  const ref = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "center" });
  }, []);

  return <TableRow ref={ref} {...props} />;
}
