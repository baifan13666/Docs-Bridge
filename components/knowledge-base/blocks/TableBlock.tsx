'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Block } from './BlockEditor';

interface TableBlockProps {
  block: Block;
  readOnly: boolean;
  focused: boolean;
  onFocus: () => void;
  onChange: (content: any) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  showMoveUp: boolean;
  showMoveDown: boolean;
}

interface TableCell {
  id: string;
  content: string;
}

interface TableRow {
  id: string;
  cells: TableCell[];
}

export default function TableBlock({
  block,
  readOnly,
  focused,
  onFocus,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  showMoveUp,
  showMoveDown
}: TableBlockProps) {
  const t = useTranslations();
  
  const headers: string[] = block.content?.headers || ['Column 1', 'Column 2', 'Column 3'];
  const rows: TableRow[] = block.content?.rows || [];

  const addRow = () => {
    const newRow: TableRow = {
      id: `row-${Date.now()}`,
      cells: headers.map((_, i) => ({
        id: `cell-${Date.now()}-${i}`,
        content: ''
      }))
    };
    onChange({ ...block.content, rows: [...rows, newRow] });
  };

  const addColumn = () => {
    const newHeaders = [...headers, `Column ${headers.length + 1}`];
    const newRows = rows.map(row => ({
      ...row,
      cells: [...row.cells, { id: `cell-${Date.now()}`, content: '' }]
    }));
    onChange({ headers: newHeaders, rows: newRows });
  };

  const updateCell = (rowId: string, cellIndex: number, content: string) => {
    const newRows = rows.map(row => {
      if (row.id === rowId) {
        const newCells = [...row.cells];
        newCells[cellIndex] = { ...newCells[cellIndex], content };
        return { ...row, cells: newCells };
      }
      return row;
    });
    onChange({ ...block.content, rows: newRows });
  };

  const updateHeader = (index: number, content: string) => {
    const newHeaders = [...headers];
    newHeaders[index] = content;
    onChange({ ...block.content, headers: newHeaders });
  };

  const deleteRow = (rowId: string) => {
    onChange({ ...block.content, rows: rows.filter(r => r.id !== rowId) });
  };

  const deleteColumn = (index: number) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    const newRows = rows.map(row => ({
      ...row,
      cells: row.cells.filter((_, i) => i !== index)
    }));
    onChange({ headers: newHeaders, rows: newRows });
  };

  return (
    <div className="group relative" onClick={onFocus}>
      <div className="bg-(--color-bg-secondary) border border-(--color-border) rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-(--color-bg-tertiary)">
                {headers.map((header, i) => (
                  <th key={i} className="relative group/header">
                    <input
                      type="text"
                      value={header}
                      onChange={(e) => !readOnly && updateHeader(i, e.target.value)}
                      disabled={readOnly}
                      className="w-full px-4 py-3 text-sm font-semibold bg-transparent border-none outline-none text-(--color-text-primary)"
                    />
                    {!readOnly && headers.length > 1 && (
                      <button
                        onClick={() => deleteColumn(i)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover/header:opacity-100 transition-opacity cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-(--color-border) group/row">
                  {row.cells.map((cell, i) => (
                    <td key={cell.id} className="border-r border-(--color-border) last:border-r-0">
                      <input
                        type="text"
                        value={cell.content}
                        onChange={(e) => !readOnly && updateCell(row.id, i, e.target.value)}
                        disabled={readOnly}
                        className="w-full px-4 py-2 text-sm bg-transparent border-none outline-none text-(--color-text-primary)"
                      />
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="w-8">
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="p-1 text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <div className="p-2 border-t border-(--color-border) flex gap-2">
            <button
              onClick={addRow}
              className="flex-1 px-3 py-2 text-xs text-(--color-text-secondary) hover:bg-(--color-bg-tertiary) rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {t('knowledgeBase.blocks.addRow')}
            </button>
            <button
              onClick={addColumn}
              className="flex-1 px-3 py-2 text-xs text-(--color-text-secondary) hover:bg-(--color-bg-tertiary) rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {t('knowledgeBase.blocks.addColumn')}
            </button>
          </div>
        )}
      </div>

      {/* Block Actions */}
      {focused && !readOnly && (
        <div className="absolute -left-12 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={onMoveUp} disabled={!showMoveUp} className="p-1 hover:bg-(--color-bg-tertiary) rounded cursor-pointer disabled:opacity-30">
            <span className="material-symbols-outlined text-sm">arrow_upward</span>
          </button>
          <button onClick={onMoveDown} disabled={!showMoveDown} className="p-1 hover:bg-(--color-bg-tertiary) rounded cursor-pointer disabled:opacity-30">
            <span className="material-symbols-outlined text-sm">arrow_downward</span>
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-red-500/10 rounded cursor-pointer">
            <span className="material-symbols-outlined text-sm text-red-500">delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
