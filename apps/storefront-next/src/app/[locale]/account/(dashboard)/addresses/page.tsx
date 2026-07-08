"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { medusa } from "@/lib/medusa";
import { AddressBook, type Address } from "./address-book";

export default function AddressesTab() {
  const t = useTranslations("account");
  const [addresses, setAddresses] = useState<Address[] | null>(null);

  async function load() {
    try {
      const { addresses: rows } = await medusa.store.customer.listAddress();
      setAddresses(rows as unknown as Address[]);
    } catch {
      setAddresses([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    medusa.store.customer
      .listAddress()
      .then(({ addresses: rows }) => {
        if (!cancelled) setAddresses(rows as unknown as Address[]);
      })
      .catch(() => {
        if (!cancelled) setAddresses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold">{t("addresses.title")}</h1>
      <p className="mt-1 mb-6 text-sm text-soft">{t("addresses.subtitle")}</p>
      {addresses !== null && <AddressBook addresses={addresses} onReload={load} />}
    </div>
  );
}
