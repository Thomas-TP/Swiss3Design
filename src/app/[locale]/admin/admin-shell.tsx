"use client";

import { useState } from "react";
import { Menu, X, Store } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AdminNav } from "./admin-nav";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-5 flex items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight">Administration</h1>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Admin
        </span>
      </div>
      <AdminNav onNavigate={onNavigate} />
      <Link
        href="/shop"
        onClick={onNavigate}
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-soft transition-colors hover:bg-line/50 hover:text-ink"
      >
        <Store size={16} />
        Voir la boutique
      </Link>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Barre mobile : ouvre le tiroir de navigation */}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold tracking-tight">Administration</h1>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Admin
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu d'administration"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-soft transition-colors hover:border-ink hover:text-ink"
        >
          <Menu size={16} />
          Menu
        </button>
      </div>

      {/* Tiroir mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={close}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] overflow-y-auto border-r border-line bg-paper p-5 shadow-2xl">
            <button
              type="button"
              onClick={close}
              aria-label="Fermer"
              className="absolute right-3 top-3 rounded-full p-1.5 text-soft transition-colors hover:bg-line/60 hover:text-ink"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={close} />
          </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
        {/* Barre latérale fixe (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-[4.5rem] max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-card border border-line bg-surface p-4">
            <SidebarContent />
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
