// File: drlipton/mokuro-reader/mokuro-reader-5a2582bfe61d754c9b19d42047e3cf1ac3494b32/src/lib/util/image.ts
import { showSnackbar } from './snackbar';

export async function resizeImage(
    imageBlob: Blob,
    maxWidth: number,
    maxHeight: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(imageBlob);
  
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
  
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          return reject(new Error('Could not get canvas context'));
        }
  
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
  
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
  
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
            URL.revokeObjectURL(objectUrl);
          },
          'image/webp',
          0.8 // 80% quality
        );
      };
  
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image failed to load for resizing'));
      };
  
      img.src = objectUrl;
    });
  }

  export function splitImage(blob: Blob): Promise<[Blob, Blob]> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);
  
        img.onload = () => {
            if (img.width < img.height) {
                URL.revokeObjectURL(objectUrl);
                return reject(new Error('Image is not wider than it is high.'));
            }
  
            const canvas1 = document.createElement('canvas');
            const ctx1 = canvas1.getContext('2d');
            const canvas2 = document.createElement('canvas');
            const ctx2 = canvas2.getContext('2d');
  
            if (!ctx1 || !ctx2) {
                URL.revokeObjectURL(objectUrl);
                return reject(new Error('Could not get canvas context'));
            }
  
            const halfWidth = img.width / 2;
  
            // First half (left side)
            canvas1.width = halfWidth;
            canvas1.height = img.height;
            ctx1.drawImage(img, 0, 0, halfWidth, img.height, 0, 0, halfWidth, img.height);
  
            // Second half (right side)
            canvas2.width = halfWidth;
            canvas2.height = img.height;
            ctx2.drawImage(img, halfWidth, 0, halfWidth, img.height, 0, 0, halfWidth, img.height);
  
            let blob1: Blob | null = null;
            let blob2: Blob | null = null;
  
            let hasError = false;
  
            canvas1.toBlob((b) => {
                if (!b) {
                    hasError = true;
                    return;
                }
                blob1 = b;
                if (blob2) {
                    resolve([blob1, blob2]);
                }
            }, blob.type);
  
            canvas2.toBlob((b) => {
                if (!b) {
                    hasError = true;
                    return;
                }
                blob2 = b;
                if (blob1) {
                    resolve([blob1, blob2]);
                }
            }, blob.type);
  
            if (hasError) {
                reject(new Error('Canvas to Blob conversion failed'));
            }
  
            URL.revokeObjectURL(objectUrl);
        };
  
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Image failed to load for splitting'));
        };
  
        img.src = objectUrl;
    });
  }