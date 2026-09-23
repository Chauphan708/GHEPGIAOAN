const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = require('docx');
const JSZip = require('jszip');

async function generateSignatureDocxBuffer(sigInfo) {
    const tableBorderNone = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const bordersNone = {
        top: tableBorderNone,
        bottom: tableBorderNone,
        left: tableBorderNone,
        right: tableBorderNone,
        insideHorizontal: tableBorderNone,
        insideVertical: tableBorderNone
    };

    const placeDate = sigInfo.placeDate || "Trung Nhứt, ngày     tháng     năm 202...";
    const bghRole = (sigInfo.bghRole || "HIỆU TRƯỞNG").toUpperCase();
    const bghName = sigInfo.bghName || "";
    const ttRole = (sigInfo.ttRole || "TỔ TRƯỞNG").toUpperCase();
    const ttName = sigInfo.ttName || "";
    const gvRole = (sigInfo.gvRole || "GIÁO VIÊN").toUpperCase();
    const gvName = sigInfo.gvName || "";
    const layout = sigInfo.layout || '3col';

    let tableRows = [];
    let columnWidths = [];

    if (layout === '1col') {
        columnWidths = [4680, 4680];
        tableRows = [
            new TableRow({
                children: [
                    new TableCell({ borders: bordersNone, width: { size: 4680, type: WidthType.DXA }, children: [new Paragraph({ text: "" })] }),
                    new TableCell({
                        borders: bordersNone,
                        width: { size: 4680, type: WidthType.DXA },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: placeDate,
                                        italics: true,
                                        font: "Times New Roman",
                                        size: 24
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ borders: bordersNone, width: { size: 4680, type: WidthType.DXA }, children: [new Paragraph({ text: "" })] }),
                    new TableCell({
                        borders: bordersNone,
                        width: { size: 4680, type: WidthType.DXA },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: gvRole, bold: true, font: "Times New Roman", size: 26 })]
                            }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: gvName, bold: true, font: "Times New Roman", size: 26 })]
                            })
                        ]
                    })
                ]
            })
        ];
    } else if (layout === '2col') {
        columnWidths = [4680, 4680];
        tableRows = [
            new TableRow({
                children: [
                    new TableCell({ borders: bordersNone, width: { size: 4680, type: WidthType.DXA }, children: [new Paragraph({ text: "" })] }),
                    new TableCell({
                        borders: bordersNone,
                        width: { size: 4680, type: WidthType.DXA },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: placeDate,
                                        italics: true,
                                        font: "Times New Roman",
                                        size: 24
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({
                        borders: bordersNone,
                        width: { size: 4680, type: WidthType.DXA },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: ttRole, bold: true, font: "Times New Roman", size: 26 })]
                            }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: ttName, bold: true, font: "Times New Roman", size: 26 })]
                            })
                        ]
                    }),
                    new TableCell({
                        borders: bordersNone,
                        width: { size: 4680, type: WidthType.DXA },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: gvRole, bold: true, font: "Times New Roman", size: 26 })]
                            }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: gvName, bold: true, font: "Times New Roman", size: 26 })]
                            })
                        ]
                    })
                ]
            })
        ];
    } else {
        columnWidths = [3120, 3120, 3120];
        tableRows = [
            new TableRow({
                children: [
                    new TableCell({ borders: bordersNone, width: { size: 3120, type: WidthType.DXA }, children: [new Paragraph({ text: "" })] }),
                    new TableCell({ borders: bordersNone, width: { size: 3120, type: WidthType.DXA }, children: [new Paragraph({ text: "" })] }),
                    new TableCell({
                        borders: bordersNone,
                        width: { size: 3120, type: WidthType.DXA },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: placeDate,
                                        italics: true,
                                        font: "Times New Roman",
                                        size: 24
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({
                        borders: bordersNone,
                        width: { size: 3120, type: WidthType.DXA },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: bghRole, bold: true, font: "Times New Roman", size: 26 })]
                            }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: bghName, bold: true, font: "Times New Roman", size: 26 })]
                            })
                        ]
                    }),
                    new TableCell({
                        borders: bordersNone,
                        width: { size: 3120, type: WidthType.DXA },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: ttRole, bold: true, font: "Times New Roman", size: 26 })]
                            }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: ttName, bold: true, font: "Times New Roman", size: 26 })]
                            })
                        ]
                    }),
                    new TableCell({
                        borders: bordersNone,
                        width: { size: 3120, type: WidthType.DXA },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: gvRole, bold: true, font: "Times New Roman", size: 26 })]
                            }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ text: "" }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: gvName, bold: true, font: "Times New Roman", size: 26 })]
                            })
                        ]
                    })
                ]
            })
        ];
    }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 720, bottom: 720, left: 1440, right: 1440 }
                }
            },
            children: [
                new Paragraph({ text: "" }),
                new Paragraph({ text: "" }),
                new Table({
                    width: { size: 9360, type: WidthType.DXA },
                    columnWidths: columnWidths,
                    borders: bordersNone,
                    rows: tableRows
                })
            ]
        }]
    });

    return await Packer.toBuffer(doc);
}

async function fixContinuousPageNumbers(docxBuffer) {
    try {
        const zip = await JSZip.loadAsync(docxBuffer);
        const docXmlFile = zip.file("word/document.xml");
        if (docXmlFile) {
            let xml = await docXmlFile.async("string");
            xml = xml.replace(/(<w:pgNumType\b[^>]*?)\s+w:start="[^"]*"/gi, '$1');
            zip.file("word/document.xml", xml);
            return await zip.generateAsync({ type: "nodebuffer" });
        }
    } catch (e) {
        console.error("Lỗi khi xử lý số trang liên tục:", e);
    }
    return docxBuffer;
}

module.exports = {
    generateSignatureDocxBuffer,
    fixContinuousPageNumbers
};