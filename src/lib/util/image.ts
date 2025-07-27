// src/lib/util/image.ts

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