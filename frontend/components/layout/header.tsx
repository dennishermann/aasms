"use client";

import Link from "next/link";

interface HeaderProps {
  rightContent?: React.ReactNode;
}

export function Header({ rightContent }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6 w-full">
        {/* Left: Logo/Brand */}
        <Link href="/" className="text-xl font-bold hover:opacity-80 transition-opacity">
          SMS Assistant
        </Link>

        {/* Right: Study title + badge or other content */}
        {rightContent && <div className="flex items-center">{rightContent}</div>}
      </div>
    </header>
  );
}
