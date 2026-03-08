"use client";

import { ReactNode } from "react";

interface TabHeaderProps {
  title: string;
  description?: string;
  badge?: {
    label: string;
    className?: string;
  };
  actions?: ReactNode;
}

export function TabHeader({ title, description, badge, actions }: TabHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2">
          {badge && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                badge.className ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {badge.label}
            </span>
          )}
          {title}
        </h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
