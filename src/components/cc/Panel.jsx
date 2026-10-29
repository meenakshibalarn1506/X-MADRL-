import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function Panel({
  title,
  subtitle,
  icon: Icon,
  defaultOpen = true,
  action,
  children,
  className = "",
  bodyClassName = "",
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={"panel overflow-hidden " + className}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-3 px-4 py-3">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2.5 text-left">
            {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary" /> : null}
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{title}</span>
              {subtitle ? <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span> : null}
            </span>
            <ChevronDown
              className={"ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")}
            />
          </CollapsibleTrigger>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <CollapsibleContent>
          <div className={"border-t border-border px-4 py-4 " + bodyClassName}>{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}