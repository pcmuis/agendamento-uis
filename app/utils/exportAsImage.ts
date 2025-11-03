type ExportOptions = { backgroundColor?: string; pixelRatio?: number };

const isSvgElement = (element: Element): element is SVGElement =>
  element.namespaceURI === 'http://www.w3.org/2000/svg' && !(element instanceof SVGForeignObjectElement);

const sanitizeStyleValue = (property: string, value: string) => {
  if (!value) {
    return value;
  }

  // Remove referências a URLs externas (exceto data URLs)
  const hasExternalUrl = /url\((?!['"]?data:)/.test(value);

  if (!hasExternalUrl) {
    return value;
  }

  // Remove background-images e outras propriedades com URLs externas
  if (property === 'background' || property === 'background-image' || property.includes('background')) {
    return 'none';
  }

  // Remove qualquer URL externa de outras propriedades
  return value.replace(/url\((?!['"]?data:)[^)]*\)/g, 'none');
};

const cloneComputedStyles = (source: Element, target: Element) => {
  if (!source || !target) {
    return;
  }

  if (!isSvgElement(source)) {
    const computed = window.getComputedStyle(source as HTMLElement);
    const propertiesToInclude = [
      'color', 'background-color', 'background', 'border', 'border-radius',
      'padding', 'margin', 'width', 'height', 'font-size', 'font-weight',
      'font-family', 'text-align', 'display', 'flex', 'flex-direction',
      'justify-content', 'align-items', 'gap', 'box-shadow', 'opacity',
      'overflow', 'position', 'top', 'left', 'right', 'bottom',
      'transform', 'transition', 'z-index', 'max-width', 'min-width',
      'max-height', 'min-height', 'line-height', 'letter-spacing',
      'text-transform', 'text-decoration', 'white-space', 'word-wrap',
    ];
    
    const cssText = propertiesToInclude
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

  // Remove elementos que podem causar problemas (scripts, links, etc)
  const elementsToRemove = clone.querySelectorAll('script, link[rel="stylesheet"], style[data-next-hide-fouc]');
  elementsToRemove.forEach((el) => el.remove());

  // Força o uso de fontes genéricas para evitar problemas com fontes externas
  const allElements = clone.querySelectorAll('*');
  allElements.forEach((el) => {
    if (el instanceof HTMLElement) {
      const computedFont = window.getComputedStyle(el).fontFamily;
      // Se a fonte não for uma fonte genérica, substitui por uma genérica
      if (computedFont && !/serif|sans-serif|monospace|cursive|fantasy/i.test(computedFont)) {
        el.style.fontFamily = 'Arial, sans-serif';
      }
    }
  });

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.backgroundColor = options?.backgroundColor ?? '#ffffff';
  wrapper.style.padding = '0';
  wrapper.style.margin = '0';
  wrapper.style.boxSizing = 'border-box';
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

  // Converte SVG para data URL diretamente para evitar problemas de CORS
  const svgData = new XMLSerializer().serializeToString(svg);
  // Remove qualquer referência a recursos externos no SVG antes de serializar
  const cleanedSvgData = svgData.replace(/href=["'][^"']*["']/gi, '').replace(/xlink:href=["'][^"']*["']/gi, '');
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanedSvgData)}`;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    // Não usar crossOrigin para data URLs
    img.onload = () => {
      // Aguarda um frame extra para garantir que a imagem esteja completamente carregada
      requestAnimationFrame(() => {
        resolve(img);
      });
    };
    img.onerror = (event) => {
      reject(new Error('Falha ao carregar a imagem SVG gerada.'));
    };
    img.src = svgDataUrl;
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

  const context = canvas.getContext('2d', { willReadFrequently: false });
  if (!context) {
    throw new Error('Não foi possível criar o contexto 2D para gerar a imagem.');
  }

  // Preenche o fundo antes de desenhar
  context.fillStyle = options?.backgroundColor ?? '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.scale(pixelRatio, pixelRatio);
  
  try {
    context.drawImage(image, 0, 0, width, height);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    throw new Error(`Não foi possível desenhar a imagem no canvas: ${errorMessage}`);
  }

  // Verifica se o canvas está contaminado antes de tentar exportar
  try {
    // Tenta ler um pixel para verificar se o canvas está contaminado
    const imageData = context.getImageData(0, 0, 1, 1);
    if (!imageData) {
      throw new Error('Canvas está contaminado e não pode ser exportado.');
    }
  } catch (error) {
    throw new Error('Canvas está contaminado. Isso geralmente acontece quando há recursos externos (fontes, imagens) sendo carregados. Tente garantir que todos os recursos sejam locais.');
  }

  try {
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      try {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error('toBlob retornou null. O canvas pode estar contaminado ou há um problema na geração da imagem.'));
            }
          },
          'image/png',
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        reject(new Error(`Erro ao chamar toBlob: ${errorMessage}`));
      }
    });

    if (!blob) {
      throw new Error('Não foi possível gerar a imagem em PNG.');
    }

    return blob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    // Se o erro for SecurityError, é o problema de canvas tainted
    if (errorMessage.includes('Tainted') || errorMessage.includes('tainted') || errorMessage.includes('SecurityError')) {
      throw new Error('Canvas contaminado: O canvas não pode ser exportado porque contém recursos de origem cruzada. Isso geralmente acontece quando há fontes ou imagens externas sendo carregadas.');
    }
    throw error;
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
