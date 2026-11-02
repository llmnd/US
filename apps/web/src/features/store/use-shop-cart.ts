"use client";

import { useSyncExternalStore, type SetStateAction } from "react";

export type ShopCart = Record<string, number>;
type CartListener = () => void;

const SHOP_CART_KEY = "mamari:store-cart";
const EMPTY_CART: ShopCart = {};
let cartSnapshot: ShopCart = EMPTY_CART;
let hasLoadedStorage = false;
const listeners = new Set<CartListener>();

function parseCart(value: unknown): ShopCart {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        entry[0].length > 0 &&
        typeof entry[1] === "number" &&
        Number.isInteger(entry[1]) &&
        entry[1] > 0 &&
        entry[1] <= 999,
    ),
  );
}

function loadCart() {
  if (hasLoadedStorage || typeof window === "undefined") return;
  hasLoadedStorage = true;
  try {
    const stored = localStorage.getItem(SHOP_CART_KEY);
    cartSnapshot = stored ? parseCart(JSON.parse(stored)) : EMPTY_CART;
  } catch {
    cartSnapshot = EMPTY_CART;
  }
}

function notifyListeners() {
  for (const listener of listeners) listener();
}

function handleStorage(event: StorageEvent) {
  if (event.key !== SHOP_CART_KEY) return;
  try {
    cartSnapshot = event.newValue ? parseCart(JSON.parse(event.newValue)) : EMPTY_CART;
  } catch {
    cartSnapshot = EMPTY_CART;
  }
  notifyListeners();
}

function subscribe(listener: CartListener) {
  loadCart();
  listeners.add(listener);
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot() {
  return cartSnapshot;
}

function getServerSnapshot() {
  return EMPTY_CART;
}

function setShopCart(value: SetStateAction<ShopCart>) {
  loadCart();
  cartSnapshot = typeof value === "function" ? value(cartSnapshot) : value;
  try {
    localStorage.setItem(SHOP_CART_KEY, JSON.stringify(cartSnapshot));
  } catch {
    notifyListeners();
    return;
  }
  notifyListeners();
}

export function useShopCart() {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { cart, setCart: setShopCart };
}
