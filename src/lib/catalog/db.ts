import type { Volume } from '$lib/types';
import Dexie, { type Table } from 'dexie';

export interface Catalog {
  id: string;
  manga: Volume[];
}

export interface ThumbnailCache {
  id: string; // manga name or unique identifier
  thumbnail: Blob;
}

export class CatalogDexie extends Dexie {
  catalog!: Table<Catalog>;
  thumbnails!: Table<ThumbnailCache>;

  constructor() {
    super('mokuro');
    this.version(1).stores({
      catalog: 'id, manga'
    });
    this.version(2).stores({
      catalog: 'id, manga',
      thumbnails: 'id'
    });
  }
}

export const db = new CatalogDexie();