"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * AppDialog
 * ----------------------------------------------------------------------------
 * A thin, reusable wrapper over the shadcn dialog primitives. Pass a `trigger`
 * for uncontrolled usage, or drive it with `open`/`onOpenChange`. Content goes
 * in `children`; action buttons go in `footer`.
 */
export interface AppDialogProps {
  /** Controlled open state. Omit for uncontrolled usage with a `trigger`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the dialog (wrapped in DialogTrigger, `asChild`). */
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Extra classes for the dialog content (e.g. width). */
  contentClassName?: string;
}

export function AppDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  contentClassName,
}: AppDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn("sm:max-w-lg", contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export default AppDialog;
