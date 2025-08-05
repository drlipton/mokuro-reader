import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';
import { settings, updateSetting, } from './settings';
import { zoomDefault } from '$lib/panzoom';
import { page } from '$app/stores';
import { manga, volume } from '$lib/catalog';
import { uploadFile } from '$lib/util';
import { debounce } from '$lib/util';

export type VolumeSettings = {
  rightToLeft: boolean;
  singlePageView: boolean;
  hasCover: boolean;
}

export type VolumeSettingsKey = keyof VolumeSettings;

type Progress = Record<string, number> | undefined;

type VolumeData = {
  progress: number;
  chars: number;
  completed: boolean;
  timeReadInMinutes: number,
  settings: VolumeSettings;
  totalPages?: number;
  lastRead?: number;
}

type TotalStats = {
  completed: number;
  pagesRead: number;
  charsRead: number;
  minutesRead: number;
}

type Volumes = Record<string, VolumeData>;


const stored = browser ? window.localStorage.getItem('volumes') : undefined;
const initial: Volumes = stored && browser ? JSON.parse(stored) : {};

export const volumes = writable<Volumes>(initial);

const performUpload = debounce(() => {
    if (typeof gapi === 'undefined' || !gapi?.client?.getToken()) {
        return;
    }
    console.log('Sync: Automatic upload triggered...');
    const { access_token } = gapi.auth.getToken();
    uploadFile({
        accessToken: access_token,
        localStorageId: 'volumes',
        fileId: localStorage.getItem('volumeDataId') || '',
        metadata: {
            name: 'volume-data.json',
            mimeType: 'application/json',
            parents: [localStorage.getItem('readerFolderId') || '']
        },
        type: 'application/json'
    }).then(res => {
        if (res.id) {
            console.log('Sync: Automatic upload successful.', res);
            localStorage.setItem('volumeDataId', res.id);
            localStorage.setItem('lastSyncTime', Date.now().toString());
        }
    }).catch(error => {
        console.error('Sync: Automatic upload failed.', error);
    });
}, 3000);


volumes.subscribe((volumes) => {
  if (browser) {
    window.localStorage.setItem('volumes', volumes ? JSON.stringify(volumes) : '');
    performUpload();
  }
});

export function initializeVolume(volumeId: string) {
  const volumesStore = get(volumes);

  if (volumesStore[volumeId]) {
    return;
  }

  const volumeDefaults = get(settings).volumeDefaults;
  const { hasCover, rightToLeft, singlePageView } = volumeDefaults;

  volumes.update((prev) => {
    if (prev[volumeId]) return prev;

    return {
      ...prev,
      [volumeId]: {
        chars: 0,
        completed: false,
        progress: 1,
        timeReadInMinutes: 0,
        settings: {
          hasCover,
          rightToLeft,
          singlePageView
        },
        lastRead: Date.now()
      }
    };
  });
}

export function deleteVolume(volume: string) {
  volumes.update((prev) => {
    delete prev[volume]
    return prev
  })
}

export function clearVolumes() {
  volumes.set({});
}

export function updateProgress(volume: string, progress: number, chars?: number, completed = false) {
  volumes.update((prev) => {
    // FIX: Add a guard to prevent crash if volume is not yet initialized
    if (!prev[volume]) {
        console.warn(`Attempted to update progress for uninitialized volume: ${volume}`);
        return prev;
    }
    return {
      ...prev,
      [volume]: {
        ...prev[volume],
        progress,
        chars: chars || prev[volume].chars,
        completed,
        lastRead: Date.now()
      }
    };
  });
}

export function startCount(volume: string) {
  return setInterval(() => {
    volumes.update((prev) => {
       if (!prev[volume]) return prev;
      return {
        ...prev,
        [volume]: {
          ...prev[volume],
          timeReadInMinutes: prev[volume].timeReadInMinutes + 1
        }
      };
    });
  }, 60 * 1000)
}

export const progress = derived(volumes, ($volumes) => {
  const progress: Progress = {}

  if ($volumes) {
    Object.keys($volumes).forEach((key) => {
      progress[key] = $volumes[key].progress
    });
  }

  return progress
})

export const volumeSettings = derived(volumes, ($volumes) => {
  const settings: Record<string, VolumeSettings> = {}

  if ($volumes) {
    Object.keys($volumes).forEach((key) => {
      settings[key] = $volumes[key].settings
    });
  }

  return settings
})

export function updateVolumeSetting(volume: string, key: VolumeSettingsKey, value: any) {
  volumes.update((prev) => {
    if (!prev[volume]) return prev;
    return {
      ...prev,
      [volume]: {
        ...prev[volume],
        settings: {
          ...prev[volume].settings,
          [key]: value
        }
      }
    };
  });
  zoomDefault();
}

export const totalStats = derived([volumes, page], ([$volumes, $page]) => {
  if ($page && $volumes) {
    return Object.values($volumes).reduce<TotalStats>((stats, { chars, completed, timeReadInMinutes, progress }) => {
      if (completed) {
        stats.completed++;
      }

      stats.pagesRead += progress;
      stats.minutesRead += timeReadInMinutes;
      stats.charsRead += chars

      return stats;
    }, {
      charsRead: 0,
      completed: 0,
      pagesRead: 0,
      minutesRead: 0
    })
  }
  return undefined;
})

export const mangaStats = derived([manga, volumes], ([$manga, $volumes]) => {
  if ($manga && $volumes) {
    return $manga.reduce(
      (stats, vol) => {
        if (vol.mokuroData) {
            const volumeId = vol.mokuroData.volume_uuid;
            const timeReadInMinutes = $volumes[volumeId]?.timeReadInMinutes || 0;
            const chars = $volumes[volumeId]?.chars || 0;
            const completed = $volumes[volumeId]?.completed || false;

            stats.timeReadInMinutes += timeReadInMinutes;
            stats.chars += chars;
            if (completed) {
                stats.completed++;
            }
        }
        return stats;
      },
      { timeReadInMinutes: 0, chars: 0, completed: 0 }
    );
  }
  return undefined;
});


export const volumeStats = derived([volume, volumes], ([$volume, $volumes]) => {
  if ($volume && $volumes && $volume.mokuroData) {
    const { chars, completed, timeReadInMinutes, progress } = $volumes[$volume.mokuroData.volume_uuid]
    return { chars, completed, timeReadInMinutes, progress }
  }
  return undefined;
});