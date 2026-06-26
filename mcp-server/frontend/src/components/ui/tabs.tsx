import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

const EqualWidthTabsContext = React.createContext(false);

export function TabsList({
  className,
  equalWidth,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { equalWidth?: boolean }) {
  return (
    <EqualWidthTabsContext.Provider value={!!equalWidth}>
      <TabsPrimitive.List
        className={cn(
          "inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground",
          equalWidth && "grid w-full auto-cols-fr grid-flow-col gap-0.5",
          className
        )}
        {...props}
      />
    </EqualWidthTabsContext.Provider>
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const equalWidth = React.useContext(EqualWidthTabsContext);
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
        equalWidth && "w-full min-w-0 px-2 text-xs sm:text-sm",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("mt-4 focus-visible:outline-none", className)} {...props} />;
}
