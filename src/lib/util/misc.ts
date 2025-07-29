import { get } from "svelte/store";
import { showSnackbar } from "./snackbar";
import { browser } from "$app/environment";
import { page } from "$app/stores";

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export function isReader() {
  // This now correctly checks the route ID
  return get(page).route.id === '/[manga]/[volume]';
}

export function debounce(func: (...args: any[]) => void, timeout = 300) {
    let timer: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func(...args);
        }, timeout);
    };
}


export function toClipboard() {
    navigator.clipboard.writeText(
        'pip3 install git+https://github.com/kha-white/mokuro.git@web-reader'
    );
    showSnackbar('Copied to clipboard');
}

type ExtaticPayload = {
    title: string;
    volumeName: string;
    currentCharCount: number;
    totalCharCount: number;
    currentPage: number;
    totalPages: number;
    currentLineCount: number;
    totalLineCount: number;
};

type ExtaticEvent = 'mokuro-reader:page.change' | 'mokuro-reader:reader.closed';

export function fireExstaticEvent(event: ExtaticEvent, payload: ExtaticPayload) {
    if (browser) {
        document.dispatchEvent(new CustomEvent(event, { detail: payload }));
    }
}