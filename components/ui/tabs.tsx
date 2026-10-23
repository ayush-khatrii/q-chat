"use client";
import * as React from "react";
import { Tabs as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";
export const Tabs = Primitive.Root;
export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-muted p-1",
        className,
      )}
      {...props}
    />
  );
}
export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Content
      data-slot="tabs-content"
      className={cn(
        "min-h-0 outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=inactive]:hidden",
        className,
      )}
      {...props}
    />
  );
}
