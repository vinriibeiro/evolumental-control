import JSZip from 'jszip'

// PNG de 1x1 pixel
export const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHh6hSQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))

export interface EpubOpts {
  title?: string
  author?: string
  cover?: boolean
  chapter?: string
}

/** Monta um EPUB mínimo na memória (nenhum livro real é usado nos testes). */
export async function makeEpub(opts: EpubOpts = {}): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  )
  const meta =
    (opts.title === undefined ? '' : `<dc:title>${opts.title}</dc:title>`) +
    (opts.author ? `<dc:creator>${opts.author}</dc:creator>` : '') +
    `<dc:identifier id="uid">urn:test:${opts.chapter ?? 'x'}</dc:identifier><dc:language>pt-BR</dc:language>` +
    (opts.cover ? '<meta name="cover" content="capa"/>' : '')
  const coverItem = opts.cover ? '<item id="capa" href="images/capa.png" media-type="image/png" properties="cover-image"/>' : ''
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${meta}</metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/>${coverItem}</manifest><spine><itemref idref="c1"/></spine></package>`,
  )
  zip.file('OEBPS/c1.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>c</title></head><body><p>${opts.chapter ?? 'Olá'}</p></body></html>`)
  if (opts.cover) zip.file('OEBPS/images/capa.png', PNG)
  return zip.generateAsync({ type: 'arraybuffer' })
}

export const epubFile = async (name: string, opts?: EpubOpts) => new File([await makeEpub(opts)], name, { type: 'application/epub+zip' })
