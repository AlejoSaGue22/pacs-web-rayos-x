import PDFDocument from 'pdfkit';

interface StudyData {
  accessionNumber: string;
  studyInstanceUid: string;
  studyDate: string;
  studyTime: string;
  studyDescription: string;
  modality: string;
  patientName: string;
  patientDocument: string;
  patientSex: string;
  patientBirthDate: string;
  referringPhysician: string;
  performingTechnician: string;
  institutionName: string;
  manufacturer: string;
  manufacturerModelName: string;
  status: string;
  notes?: string | null;
  series: {
    seriesNumber: number;
    seriesDescription: string;
    modality: string;
    bodyPartExamined: string;
    numberOfInstances: number;
    instances: {
      instanceNumber: number;
      sopInstanceUid: string;
      rows: number;
      columns: number;
      windowCenter: number;
      windowWidth: number;
      kvp?: number | null;
      exposureTimeMs?: number | null;
      tubeCurrentMA?: number | null;
      mAs?: number | null;
      viewPosition?: string | null;
    }[];
  }[];
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr || 'N/A';
  return `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}/${dateStr.slice(0, 4)}`;
}

function formatTime(timeStr: string): string {
  if (!timeStr || timeStr.length < 6) return timeStr || 'N/A';
  return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
}

function calculateAge(birthDateStr: string): string {
  if (!birthDateStr || birthDateStr.length < 10) return 'N/A';
  const birth = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} años`;
}

function sexLabel(sex: string): string {
  if (sex === 'M') return 'Masculino';
  if (sex === 'F') return 'Femenino';
  return sex || 'N/A';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    'Recibido': 'Recibido (Pendiente de revisión)',
    'En Revisión': 'En Revisión',
    'Informado': 'Informado / Reportado',
    'Archivado': 'Archivado',
  };
  return labels[status] || status;
}

export function generateStudyPdf(study: StudyData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      info: {
        Title: `Informe - ${study.accessionNumber}`,
        Author: study.institutionName,
        Subject: `${study.studyDescription} - ${study.patientName}`,
      },
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const col1 = 50;
    const col2 = 220;
    const col3 = 390;

    // ── HEADER ──
    doc.fontSize(20).font('Helvetica-Bold').text(study.institutionName || 'Consultorio de Rayos X', col1, 50, { align: 'center', width: pageWidth });
    doc.fontSize(10).font('Helvetica').fillColor('#4B5563')
      .text(`${study.manufacturer} ${study.manufacturerModelName}`, { align: 'center', width: pageWidth });
    doc.moveDown(0.3);
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E3A5F')
      .text('INFORME DE ESTUDIO RADIOLÓGICO', { align: 'center', width: pageWidth });

    doc.moveDown(0.2);
    doc.moveTo(col1, doc.y).lineTo(col1 + pageWidth, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(0.8);

    // ── SECTION 1: PACIENTE ──
    const y1Start = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E3A5F').text('1. DATOS DEL PACIENTE', col1);
    doc.moveDown(0.4);
    doc.fontSize(9).font('Helvetica');

    drawField(doc, 'Nombre completo:', study.patientName, col1, doc.y, col2, pageWidth);
    drawField(doc, 'Documento:', study.patientDocument, col1, doc.y, col2, pageWidth);
    drawField(doc, 'Fecha de nacimiento:', formatDate(study.patientBirthDate), col1, doc.y, col2, pageWidth);
    drawField(doc, 'Edad:', calculateAge(study.patientBirthDate), col1, doc.y, col2, pageWidth);
    drawField(doc, 'Sexo:', sexLabel(study.patientSex), col1, doc.y, col2, pageWidth);
    doc.moveDown(0.6);

    const y1End = doc.y;
    doc.save();
    doc.roundedRect(col1, y1Start, pageWidth, y1End - y1Start, 4).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.restore();
    doc.moveDown(0.6);

    // ── SECTION 2: ESTUDIO ──
    const y2Start = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E3A5F').text('2. DATOS DEL ESTUDIO', col1);
    doc.moveDown(0.4);
    doc.fontSize(9).font('Helvetica').fillColor('#111827');

    drawField(doc, 'N° de accesión:', study.accessionNumber, col1, doc.y, col2, pageWidth);
    drawField(doc, 'Fecha del estudio:', formatDate(study.studyDate), col1, doc.y, col2, pageWidth);
    drawField(doc, 'Hora:', formatTime(study.studyTime), col1, doc.y, col2, pageWidth);
    drawField(doc, 'Modalidad:', `DX - Radiografía Digital (${study.modality})`, col1, doc.y, col2, pageWidth);
    drawField(doc, 'Descripción:', study.studyDescription, col1, doc.y, col2, pageWidth);
    drawField(doc, 'Médico referente:', study.referringPhysician || 'N/A', col1, doc.y, col2, pageWidth);
    drawField(doc, 'Técnico:', study.performingTechnician || 'N/A', col1, doc.y, col2, pageWidth);
    drawField(doc, 'Estado:', statusLabel(study.status), col1, doc.y, col2, pageWidth);
    drawField(doc, 'Study UID:', study.studyInstanceUid, col1, doc.y, col2, pageWidth);
    doc.moveDown(0.6);

    const y2End = doc.y;
    doc.save();
    doc.roundedRect(col1, y2Start, pageWidth, y2End - y2Start, 4).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.restore();
    doc.moveDown(0.6);

    // ── SECTION 3: PARÁMETROS TÉCNICOS ──
    const seriesInstances = study.series.flatMap(s => s.instances);
    const hasInstances = seriesInstances.length > 0;
    const firstInst = hasInstances ? seriesInstances[0] : null;

    if (firstInst) {
      const y3Start = doc.y;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E3A5F').text('3. PARÁMETROS TÉCNICOS DE EXPOSICIÓN', col1);
      doc.moveDown(0.4);
      doc.fontSize(9).font('Helvetica').fillColor('#111827');

      drawField(doc, 'Equipo:', `${study.manufacturer} ${study.manufacturerModelName}`, col1, doc.y, col2, pageWidth);
      drawField(doc, 'kVp:', firstInst.kvp ? `${firstInst.kvp} kV` : 'N/A', col1, doc.y, col2, pageWidth);
      drawField(doc, 'mAs:', firstInst.mAs ? `${firstInst.mAs} mAs` : 'N/A', col1, doc.y, col2, pageWidth);
      drawField(doc, 'Tiempo de exposición:', firstInst.exposureTimeMs ? `${firstInst.exposureTimeMs} ms` : 'N/A', col1, doc.y, col2, pageWidth);
      drawField(doc, 'Corriente tubo:', firstInst.tubeCurrentMA ? `${firstInst.tubeCurrentMA} mA` : 'N/A', col1, doc.y, col2, pageWidth);
      drawField(doc, 'Resolución:', firstInst.rows && firstInst.columns ? `${firstInst.rows} × ${firstInst.columns} px` : 'N/A', col1, doc.y, col2, pageWidth);
      drawField(doc, 'Window Level/Center:', firstInst.windowCenter ? `${firstInst.windowCenter}` : 'N/A', col1, doc.y, col2, pageWidth);
      drawField(doc, 'Window Width:', firstInst.windowWidth ? `${firstInst.windowWidth}` : 'N/A', col1, doc.y, col2, pageWidth);
      doc.moveDown(0.6);

      const y3End = doc.y;
      doc.save();
      doc.roundedRect(col1, y3Start, pageWidth, y3End - y3Start, 4).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
      doc.restore();
      doc.moveDown(0.6);
    }

    // ── SECTION 4: SERIES Y PROYECCIONES ──
    if (study.series.length > 0) {
      const y4Start = doc.y;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E3A5F')
        .text(`4. SERIES RADIOGRÁFICAS (${study.series.length})`, col1);
      doc.moveDown(0.4);

      study.series.forEach((s, idx) => {
        if (doc.y > 680) {
          doc.addPage();
        }

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827')
          .text(`Serie ${s.seriesNumber}: ${s.seriesDescription}`, col1, undefined, { continued: false });
        doc.fontSize(8).font('Helvetica').fillColor('#6B7280');

        const lines = [
          `  Modalidad: ${s.modality}  |  Región: ${s.bodyPartExamined}  |  Instancias: ${s.numberOfInstances}`,
        ];

        s.instances.forEach(inst => {
          const parts: string[] = [];
          if (inst.viewPosition) parts.push(`Proyección: ${inst.viewPosition}`);
          parts.push(`${inst.columns}×${inst.rows}px`);
          lines.push(`  Instancia #${inst.instanceNumber}: ${parts.join('  |  ')}`);
        });

        lines.forEach(line => doc.text(line));

        if (idx < study.series.length - 1) {
          doc.moveDown(0.3);
        }
      });

      doc.moveDown(0.6);

      const y4End = doc.y;
      doc.save();
      doc.roundedRect(col1, y4Start, pageWidth, y4End - y4Start, 4).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
      doc.restore();
      doc.moveDown(0.6);
    }

    // ── SECTION 5: NOTAS ──
    const y5Start = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E3A5F').text('5. NOTAS / OBSERVACIONES', col1);
    doc.moveDown(0.4);

    if (study.notes) {
      doc.fontSize(9).font('Helvetica').fillColor('#111827').text(study.notes, col1, undefined, { width: pageWidth });
    } else {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#9CA3AF')
        .text('(Sin notas registradas para este estudio)', col1, undefined, { width: pageWidth });
    }

    doc.moveDown(2);

    const y5End = doc.y;
    doc.save();
    doc.roundedRect(col1, y5Start, pageWidth, y5End - y5Start, 4).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.restore();
    doc.moveDown(0.8);

    // ── SIGNATURE LINE ──
    const signY = doc.y + 10;
    doc.moveTo(col1 + pageWidth - 200, signY)
      .lineTo(col1 + pageWidth, signY)
      .strokeColor('#9CA3AF').lineWidth(0.5).stroke();

    doc.fontSize(8).font('Helvetica').fillColor('#6B7280')
      .text('Firma del Médico Radiólogo', col1 + pageWidth - 200, signY + 5, {
        width: 200,
        align: 'center',
      });

    doc.moveDown(1);

    // ── FOOTER ──
    const footerY = doc.page.height - 50;
    
    // Hack para PDFKit: desactivar margen inferior para dibujar en el footer sin saltar de página
    const originalBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.moveTo(col1, footerY).lineTo(col1 + pageWidth, footerY).strokeColor('#E5E7EB').stroke();
    doc.fontSize(7).font('Helvetica').fillColor('#9CA3AF')
      .text(`Generado: ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, col1, footerY + 8, { width: pageWidth / 2, align: 'left', lineBreak: false });
    doc.text(`Mini PACS Web - ${study.institutionName}`, col1 + pageWidth / 2, footerY + 8, { width: pageWidth / 2, align: 'right', lineBreak: false });

    // Restaurar margen inferior
    doc.page.margins.bottom = originalBottom;

    doc.end();
  });
}

function drawField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth: number,
  pageWidth: number,
) {
  doc.font('Helvetica-Bold').fillColor('#4B5563').text(label, x, y, { width: labelWidth - x, continued: false });
  doc.font('Helvetica').fillColor('#111827').text(value || 'N/A', labelWidth - 10, y, { width: x + pageWidth - labelWidth + 10 });
}
