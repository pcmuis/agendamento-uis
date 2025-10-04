export async function elementToPng(element: HTMLElement, options?: { backgroundColor?: string; pixelRatio?: number }) {
  const rect = element.getBoundingClientRect();

  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);

  if (!width || !height) {
    throw new Error('Não foi possível calcular as dimensões do elemento.');
  }

  const clone = element.cloneNode(true) as HTMLElement;

  const collectCssText = () => {
    let css = '';
    const styleSheets = Array.from(document.styleSheets);

    for (const sheet of styleSheets) {
      try {
        const rules = sheet.cssRules;
        if (!rules) continue;

        css += Array.from(rules)
          .map((rule) => rule.cssText)
          .join(' ');
      } catch (error) {
        console.warn('Não foi possível acessar uma folha de estilo ao gerar a imagem.', error);
      }
    }

    return css;
  };

  const style = document.createElement('style');
  style.textContent = collectCssText();

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.backgroundColor = options?.backgroundColor ?? '#ffffff';
  wrapper.style.padding = '0';
  wrapper.style.margin = '0';
  wrapper.appendChild(style);
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
    img.onload = () => resolve(img);
    img.onerror = (event) => reject(event);
    img.src = url;
  });

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
  URL.revokeObjectURL(url);

  return canvas.toDataURL('image/png');
}

export async function downloadElementAsPng(
  element: HTMLElement,
  filename: string,
  options?: { backgroundColor?: string; pixelRatio?: number },
) {
  const dataUrl = await elementToPng(element, options);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
