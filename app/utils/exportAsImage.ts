type ExportOptions = { backgroundColor?: string; pixelRatio?: number };

const isSvgElement = (element: Element): element is SVGElement =>
  element.namespaceURI === 'http://www.w3.org/2000/svg' && !(element instanceof SVGForeignObjectElement);

const sanitizeStyleValue = (property: string, value: string) => {
  if (!value) {
    return value;
  }

  const hasExternalUrl = /url\((?!['"]?data:)/.test(value);

  if (!hasExternalUrl) {
    return value;
  }

  if (property === 'background' || property === 'background-image') {
    return 'none';
  }

  return value.replace(/url\((?!['"]?data:)[^)]*\)/g, 'none');
};

const cloneComputedStyles = (source: Element, target: Element) => {
  if (!source || !target) {
    return;
  }

  if (!isSvgElement(source)) {
    const computed = window.getComputedStyle(source as HTMLElement);
    const cssText = Array.from(computed)
      .filter((property) => property !== 'd')
      .map((property) => {
        const value = sanitizeStyleValue(property, computed.getPropertyValue(property));
        return value ? `${property}: ${value};` : null;
      })
      .filter(Boolean)
      .join(' ');

    if (cssText) {
      target.setAttribute('style', cssText);
    }
  } else if (source.hasAttribute('style')) {
    target.setAttribute('style', source.getAttribute('style') ?? '');
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);

  for (let index = 0; index < sourceChildren.length; index += 1) {
    const sourceChild = sourceChildren[index];
    const targetChild = targetChildren[index];

    if (sourceChild && targetChild) {
      cloneComputedStyles(sourceChild, targetChild);
    }
  }
};

const createPlaceholderDataUrl = (width: number, height: number) => {
  const safeWidth = Number.isFinite(width) && width > 0 ? Math.round(width) : 200;
  const safeHeight = Number.isFinite(height) && height > 0 ? Math.round(height) : 120;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}"><rect width="100%" height="100%" fill="#f3f4f6"/><path d="M12 16a4 4 0 100-8 4 4 0 000 8zm0 2c-4.418 0-8 1.79-8 4v1h16v-1c0-2.21-3.582-4-8-4z" fill="#9ca3af" transform="translate(${safeWidth / 2 - 12},${safeHeight / 2 - 12})"/></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const inlineImages = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll('img')) as HTMLImageElement[];

  await Promise.all(
    images.map(async (img) => {
      if (!img.src || img.src.startsWith('data:')) {
        return;
      }

      const { width, height } = img.getBoundingClientRect();

      try {
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';

        const response = await fetch(img.src, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (event) => reject(event);
          reader.readAsDataURL(blob);
        });

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            img.onload = null;
            img.onerror = null;
            resolve();
          };
          img.onerror = (event) => {
            img.onload = null;
            img.onerror = null;
            reject(event);
          };
          img.src = dataUrl;
        });
      } catch (error) {
        console.warn('Não foi possível converter uma imagem para data URL ao gerar o resumo.', error);
        const fallback = createPlaceholderDataUrl(width, height);
        await new Promise<void>((resolve) => {
          img.crossOrigin = 'anonymous';
          img.referrerPolicy = 'no-referrer';
          img.onload = () => {
            img.onload = null;
            img.onerror = null;
            resolve();
          };
          img.onerror = () => {
            img.onload = null;
            img.onerror = null;
            resolve();
          };
          img.src = fallback;
        });
      }
    }),
  );
};

export async function elementToPng(element: HTMLElement, options?: ExportOptions) {
  const rect = element.getBoundingClientRect();

  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);

  if (!width || !height) {
    throw new Error('Não foi possível calcular as dimensões do elemento.');
  }

  const clone = element.cloneNode(true) as HTMLElement;
  cloneComputedStyles(element, clone);
  await inlineImages(clone);

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.backgroundColor = options?.backgroundColor ?? '#ffffff';
  wrapper.style.padding = '0';
  wrapper.style.margin = '0';
  wrapper.appendChild(clone);

  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');
  foreignObject.setAttribute('x', '0');
  foreignObject.setAttribute('y', '0');
  foreignObject.appendChild(wrapper);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.appendChild(foreignObject);

  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = (event) => reject(event);
    img.src = url;
  });

  if ('decode' in image) {
    try {
      await image.decode();
    } catch (error) {
      console.warn('Não foi possível decodificar a imagem antes de desenhar no canvas.', error);
    }
  }

  const pixelRatio = options?.pixelRatio ?? window.devicePixelRatio ?? 1;
  const canvas = document.createElement('canvas');
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;

  const context = canvas.getContext('2d');
  if (!context) {
    URL.revokeObjectURL(url);
    throw new Error('Não foi possível criar o contexto 2D para gerar a imagem.');
  }

  context.scale(pixelRatio, pixelRatio);
  context.drawImage(image, 0, 0, width, height);

  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/png');
    });

    if (!blob) {
      throw new Error('Não foi possível gerar a imagem em PNG.');
    }

    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadElementAsPng(element: HTMLElement, filename: string, options?: ExportOptions) {
  const blob = await elementToPng(element, options);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  requestAnimationFrame(() => {
    URL.revokeObjectURL(objectUrl);
  });
}
