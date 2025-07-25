// src/lib/util/crop.ts

function isWhite(r: number, g: number, b: number, sillValue: number): boolean {
	const sill = (255 * sillValue) / 100;
	return r > sill && g > sill && b > sill;
}

function getPixel(imgData: ImageData, x: number, y: number): [number, number, number] {
	const i = (y * imgData.width + x) * 4;
	const d = imgData.data;
	return [d[i], d[i + 1], d[i + 2]]; // [R, G, B]
}

function getWhiteTop(imgData: ImageData, sillValue: number): number {
	for (let y = 0; y < imgData.height; y++) {
		for (let x = 0; x < imgData.width; x++) {
			const [r, g, b] = getPixel(imgData, x, y);
			if (!isWhite(r, g, b, sillValue)) {
				return y;
			}
		}
	}
	return imgData.height;
}

function getWhiteBottom(imgData: ImageData, sillValue: number): number {
	for (let y = imgData.height - 1; y >= 0; y--) {
		for (let x = 0; x < imgData.width; x++) {
			const [r, g, b] = getPixel(imgData, x, y);
			if (!isWhite(r, g, b, sillValue)) {
				return imgData.height - 1 - y;
			}
		}
	}
	return imgData.height;
}

function getWhiteLeft(imgData: ImageData, sillValue: number): number {
	for (let x = 0; x < imgData.width; x++) {
		for (let y = 0; y < imgData.height; y++) {
			const [r, g, b] = getPixel(imgData, x, y);
			if (!isWhite(r, g, b, sillValue)) {
				return x;
			}
		}
	}
	return imgData.width;
}

function getWhiteRight(imgData: ImageData, sillValue: number): number {
	for (let x = imgData.width - 1; x >= 0; x--) {
		for (let y = 0; y < imgData.height; y++) {
			const [r, g, b] = getPixel(imgData, x, y);
			if (!isWhite(r, g, b, sillValue)) {
				return imgData.width - 1 - x;
			}
		}
	}
	return imgData.width;
}

export function cropImageBorder(
	blob: Blob,
	sillValue = 98
): Promise<{ blob: Blob; x: number; y: number; newWidth: number; newHeight: number }> {
	return new Promise((resolve, reject) => {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return reject(new Error('Could not get canvas context'));
		}

		const img = new Image();
		const objectUrl = URL.createObjectURL(blob);

		img.onload = () => {
			canvas.width = img.width;
			canvas.height = img.height;
			ctx.drawImage(img, 0, 0);

			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

			const borderLeft = getWhiteLeft(imageData, sillValue);
			const borderTop = getWhiteTop(imageData, sillValue);
			const borderRight = getWhiteRight(imageData, sillValue);
			const borderBottom = getWhiteBottom(imageData, sillValue);

			const newWidth = img.width - (borderLeft + borderRight);
			const newHeight = img.height - (borderTop + borderBottom);

			if (newWidth <= 0 || newHeight <= 0 || (newWidth === img.width && newHeight === img.height)) {
				resolve({ blob, x: 0, y: 0, newWidth: img.width, newHeight: img.height });
				URL.revokeObjectURL(objectUrl);
				return;
			}

			canvas.width = newWidth;
			canvas.height = newHeight;
			ctx.drawImage(img, -borderLeft, -borderTop);

			canvas.toBlob((outputBlob) => {
				if (outputBlob) {
					resolve({ blob: outputBlob, x: borderLeft, y: borderTop, newWidth, newHeight });
				} else {
					resolve({ blob, x: 0, y: 0, newWidth: img.width, newHeight: img.height });
				}
				URL.revokeObjectURL(objectUrl);
			}, blob.type);
		};

		img.onerror = () => {
			reject(new Error('Image failed to load'));
			URL.revokeObjectURL(objectUrl);
		};

		img.src = objectUrl;
	});
}