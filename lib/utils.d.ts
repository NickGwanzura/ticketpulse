import { type ClassValue } from "clsx";
export declare function cn(...inputs: ClassValue[]): string;
export declare function formatCurrency(amount: number, currency?: string): string;
export declare function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string;
export declare function formatDateShort(date: Date | string): string;
export declare function slugify(text: string): string;
export declare function availabilityLabel(booked: number, total: number): {
    label: string;
    color: string;
};
export declare function vehicleLabel(type: string): string;
export declare function vendorCategoryLabel(cat: string): string;
export declare const inputBaseClass = "w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition";
