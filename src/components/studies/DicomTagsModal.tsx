import React, { useState } from 'react';
import { X, Search, FileText, Download, Copy, Check } from 'lucide-react';
import { DicomStudy } from '../../types/pacs';

interface DicomTagsModalProps {
  study: DicomStudy;
  onClose: () => void;
}

export const DicomTagsModal: React.FC<DicomTagsModalProps> = ({ study, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const firstInstance = study.series[0]?.instances[0];
  const tags = firstInstance?.tags || [];

  const filteredTags = tags.filter(
    t =>
      t.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(t.value).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(tags, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[85vh] text-slate-800 font-sans overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Metadatos DICOM Header (0008, 0010, 0018, 0028)</h3>
              <p className="text-xs text-slate-500">
                Estudio {study.accessionNumber} - {study.patientName} ({study.manufacturer} {study.manufacturerModelName})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por tag (e.g. 0008), nombre o valor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleCopyJson}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-blue-600" />}
            {copied ? 'Copiado JSON' : 'Copiar JSON'}
          </button>
        </div>

        {/* Tags Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Etiqueta (Group,Elem)</th>
                  <th className="py-2.5 px-3">VR</th>
                  <th className="py-2.5 px-3">Nombre DICOM</th>
                  <th className="py-2.5 px-3">Valor / Metadato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredTags.map((tag, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 text-blue-700 font-bold">{tag.tag}</td>
                    <td className="py-2 px-3 text-amber-700 font-semibold">{tag.vr}</td>
                    <td className="py-2 px-3 text-slate-800 font-sans font-medium">{tag.name}</td>
                    <td className="py-2 px-3 text-emerald-700 break-all">{String(tag.value)}</td>
                  </tr>
                ))}
                {filteredTags.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 font-sans">
                      No se encontraron etiquetas DICOM que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>Mostrando {filteredTags.length} de {tags.length} etiquetas registradas.</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
