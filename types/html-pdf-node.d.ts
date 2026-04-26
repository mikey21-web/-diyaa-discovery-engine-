declare module 'html-pdf-node' {
  interface Options {
    format?: string
    margin?: {
      top?: string
      right?: string
      bottom?: string
      left?: string
    }
    printBackground?: boolean
    scale?: number
    timeout?: number
  }

  interface File {
    content: string
  }

  export function generatePdf(file: File, options: Options): Promise<Buffer>
}
