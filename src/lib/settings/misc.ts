import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type MiscSettings = {
    galleryLayout: 'grid' | 'list';
    gallerySorting: 'ASC' | 'DESC';
    source: 'local' | 'server';
    serverUrl: string;
    serverUsername?: string;
    serverPassword?: string;
};

export type MiscSettingsKey = keyof MiscSettings;

const defaultSettings: MiscSettings = {
    galleryLayout: 'grid',
    gallerySorting: 'ASC',
    source: 'local',
    serverUrl: '',
    serverUsername: '',
    serverPassword: ''
};

const stored = browser ? window.localStorage.getItem('miscSettings') : undefined;
export const miscSettings = writable<MiscSettings>(
    stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings
);

miscSettings.subscribe((value) => {
    if (browser) {
        window.localStorage.setItem('miscSettings', JSON.stringify(value));
    }
});

export function updateMiscSetting(key: MiscSettingsKey, value: any) {
    miscSettings.update((settings) => {
        return {
            ...settings,
            [key]: value
        };
    });
}