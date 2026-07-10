declare module 'html2pdf.js' {
    interface Html2PdfOptions {
        margin?: number | number[] | [number, number] | [number, number, number, number];
        filename?: string;
        image?: { type?: string; quality?: number };
        html2canvas?: {
            scale?: number;
            useCORS?: boolean;
            logging?: boolean;
            scrollX?: number;
            scrollY?: number;
            windowWidth?: number;
            windowHeight?: number;
            [key: string]: any;
        };
        jsPDF?: {
            unit?: string;
            format?: string | [number, number];
            orientation?: 'portrait' | 'landscape' | 'p' | 'l';
            [key: string]: any;
        };
        pagebreak?: {
            mode?: string | string[];
            before?: string | string[];
            after?: string | string[];
            avoid?: string | string[];
        };
    }

    interface Html2PdfInstance {
        set(options: Html2PdfOptions): Html2PdfInstance;
        from(element: HTMLElement | string, type?: 'string' | 'element' | 'canvas' | 'img'): Html2PdfInstance;
        toPdf(): Html2PdfInstance;
        outputPdf(type: 'blob' | 'datauristring' | 'arraybuffer' | 'pdfobjectnewwindow' | 'pdfjsnewwindow', options?: string): Promise<any>;
        save(filename?: string): Promise<void>;
    }

    function html2pdf(): Html2PdfInstance;
    function html2pdf(element: HTMLElement | string, options?: Html2PdfOptions): Html2PdfInstance;

    export default html2pdf;
}
