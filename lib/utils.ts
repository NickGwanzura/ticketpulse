import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = "USD") {
  const localeMap: Record<string, string> = {
    USD: "en-US",
    ZWL: "en-ZW",
    ZAR: "en-ZA",
    GBP: "en-GB",
  }
  return new Intl.NumberFormat(localeMap[currency] ?? "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-ZW", {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(new Date(date))
}

export function formatDateShort(date: Date | string) {
  return new Intl.DateTimeFormat("en-ZW", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function availabilityLabel(booked: number, total: number) {
  const remaining = total - booked
  if (remaining === 0) return { label: "Sold out", color: "text-red-400" }
  if (remaining <= 10) return { label: `${remaining} left`, color: "text-amber-400" }
  return { label: "Available", color: "text-teal-400" }
}

export function vehicleLabel(type: string) {
  const labels: Record<string, string> = {
    kombi: "Kombi",
    bus: "Bus",
    sedan: "Sedan",
    suv: "SUV",
  }
  return labels[type] ?? type
}

export function vendorCategoryLabel(cat: string) {
  const labels: Record<string, string> = {
    catering: "Catering",
    bar: "Bar Service",
    food_truck: "Food Truck",
    photography: "Photography",
    sound: "Sound and AV",
    security: "Security",
    decor: "Decor",
    other: "Other",
  }
  return labels[cat] ?? cat
}
