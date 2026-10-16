"""
Escritura de XLSX (SpreadsheetML / OOXML mínimo) con la biblioteca estándar (T-06, módulo
NUEVO). Sin dependencias nuevas (Constitución 2): el paquete OOXML se arma a mano con
`zipfile` (ZIP_DEFLATED). Números NATIVOS (celdas `<v>` con estilo de formato), texto como
`inlineStr`, celdas vacías para los nulos. Ver plan §4.4.

`workbook_bytes(sheets, meta) -> bytes`:
- `sheets`: `[{name, columns: [{key, label, fmt}], rows: [[...]], footer: [[...]]}]` (1-20 hojas,
  nombres saneados y únicos ≤ 31 caracteres, filas del largo de `columns`).
- `meta`: metadatos de la Portada (título, entidad, competencia, filtros, base, generado, etc).
"""
import datetime
import io
import zipfile

# ── Estilos (índices de cellXfs en styles.xml) ──────────────────────────────────
# 0 general · 1 texto en negrita (títulos/footer) · 2 int (0) · 3 signed_int (+0;-0;0)
# 4 dec1 (0.0) · 5 dec2 (0.00) · 6 signed_dec2 (+0.00;-0.00;0.00) · 7 pct (0.0%)
# 8 nota en cursiva gris · 9 texto normal
STYLE_BOLD = 1
STYLE_NOTE = 8
STYLE_TEXT = 9

_FMT_STYLE = {
    "int": 2,
    "signed_int": 3,
    "dec1": 4,
    "dec2": 5,
    "signed_dec2": 6,
    "pct": 7,
    "text": STYLE_TEXT,
}

_INVALID_SHEET_CHARS = set('[]:*?/\\')
_MAX_SHEETS = 20

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _esc(s) -> str:
    """Escape XML + remoción de caracteres de control inválidos en XML 1.0."""
    s = "" if s is None else str(s)
    out = []
    for ch in s:
        o = ord(ch)
        if o in (0x9, 0xA, 0xD) or 0x20 <= o <= 0xD7FF or 0xE000 <= o <= 0xFFFD:
            if ch == "&":
                out.append("&amp;")
            elif ch == "<":
                out.append("&lt;")
            elif ch == ">":
                out.append("&gt;")
            elif ch == '"':
                out.append("&quot;")
            elif ch == "'":
                out.append("&apos;")
            else:
                out.append(ch)
        # else: carácter de control inválido → se omite
    return "".join(out)


def _col_ref(idx0: int) -> str:
    """Índice de columna 0-based → letra(s) A1 (base 26)."""
    n = idx0 + 1
    s = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def _sanitize_names(names: list) -> list:
    """Saneo + deduplicación de nombres de hoja (≤ 31, sin `[]:*?/\\`, con sufijo ' (2)')."""
    seen = {}
    out = []
    for raw in names:
        name = "".join(ch for ch in str(raw or "") if ch not in _INVALID_SHEET_CHARS).strip()
        if not name:
            name = "Hoja"
        name = name[:31]
        base = name
        n = 2
        while name.lower() in seen:
            suffix = f" ({n})"
            name = base[:31 - len(suffix)] + suffix
            n += 1
        seen[name.lower()] = True
        out.append(name)
    return out


def _is_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _cell(col_ref: str, row_i: int, value, fmt: str) -> str:
    """Celda OOXML: número nativo con estilo de formato; texto como inlineStr; None → omitida."""
    ref = f"{col_ref}{row_i}"
    if value is None or value == "":
        return ""
    if fmt != "text" and _is_number(value):
        style = _FMT_STYLE.get(fmt, 0)
        return f'<c r="{ref}" s="{style}"><v>{value}</v></c>'
    # texto (o número que se pide como texto)
    return (f'<c r="{ref}" s="{STYLE_TEXT}" t="inlineStr">'
            f'<is><t xml:space="preserve">{_esc(value)}</t></is></c>')


def _text_cell(col_ref: str, row_i: int, value, *, style: int = STYLE_TEXT) -> str:
    ref = f"{col_ref}{row_i}"
    if value is None or value == "":
        return ""
    return (f'<c r="{ref}" s="{style}" t="inlineStr">'
            f'<is><t xml:space="preserve">{_esc(value)}</t></is></c>')


def workbook_bytes(sheets: list, meta: dict) -> bytes:
    """Arma el XLSX. Valida y levanta `ValueError` ante cuerpo inválido (plan §4.4)."""
    if not isinstance(sheets, list) or not (1 <= len(sheets) <= _MAX_SHEETS):
        raise ValueError("El libro debe tener entre 1 y 20 hojas")

    # Validación de cada hoja
    for si, sheet in enumerate(sheets):
        if not isinstance(sheet, dict):
            raise ValueError(f"sheets[{si}] inválida")
        cols = sheet.get("columns")
        if not isinstance(cols, list) or not cols:
            raise ValueError(f"sheets[{si}].columns inválida")
        ncols = len(cols)
        for ci, c in enumerate(cols):
            fmt = (c or {}).get("fmt", "text")
            if fmt not in _FMT_STYLE:
                raise ValueError(f"sheets[{si}].columns[{ci}].fmt desconocido: {fmt}")
        for ri, row in enumerate(sheet.get("rows") or []):
            if not isinstance(row, list) or len(row) != ncols:
                raise ValueError(f"sheets[{si}].rows[{ri}] con cantidad de celdas distinta de las columnas")
        for ri, row in enumerate(sheet.get("footer") or []):
            if not isinstance(row, list) or len(row) != ncols:
                raise ValueError(f"sheets[{si}].footer[{ri}] con cantidad de celdas distinta de las columnas")

    raw_names = [s.get("name") for s in sheets]
    if any(not str(n or "").strip() for n in raw_names):
        raise ValueError("Nombre de hoja vacío")
    data_names = _sanitize_names(raw_names)

    # Portada + hojas de datos
    all_names = _sanitize_names(["Portada"] + data_names)
    portada_name = all_names[0]
    data_names = all_names[1:]

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", _content_types(len(sheets)))
        z.writestr("_rels/.rels", _root_rels())
        z.writestr("xl/workbook.xml", _workbook_xml(all_names))
        z.writestr("xl/_rels/workbook.xml.rels", _workbook_rels(len(sheets)))
        z.writestr("xl/styles.xml", _styles_xml())
        z.writestr("docProps/core.xml", _core_xml(meta))
        # sheet1 = Portada
        z.writestr("xl/worksheets/sheet1.xml", _portada_sheet(meta))
        for i, sheet in enumerate(sheets):
            z.writestr(f"xl/worksheets/sheet{i + 2}.xml", _data_sheet(sheet))
    return buf.getvalue()


# ── Partes del paquete ──────────────────────────────────────────────────────────

def _content_types(n_data: int) -> str:
    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    ]
    for i in range(n_data + 1):  # +1 por la Portada
        parts.append(f'<Override PartName="/xl/worksheets/sheet{i + 1}.xml" '
                     'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
    parts.append("</Types>")
    return "".join(parts)


def _root_rels() -> str:
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            '</Relationships>')


def _workbook_xml(all_names: list) -> str:
    sheets_xml = "".join(
        f'<sheet name="{_esc(name)}" sheetId="{i + 1}" r:id="rId{i + 1}"/>'
        for i, name in enumerate(all_names))
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f'<sheets>{sheets_xml}</sheets></workbook>')


def _workbook_rels(n_data: int) -> str:
    rels = []
    total = n_data + 1  # Portada + hojas de datos
    for i in range(total):
        rels.append(f'<Relationship Id="rId{i + 1}" '
                    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
                    f'Target="worksheets/sheet{i + 1}.xml"/>')
    rels.append(f'<Relationship Id="rId{total + 1}" '
                'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
                'Target="styles.xml"/>')
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + "".join(rels) + "</Relationships>")


def _styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<numFmts count="6">'
        '<numFmt numFmtId="164" formatCode="0"/>'
        '<numFmt numFmtId="165" formatCode="+0;-0;0"/>'
        '<numFmt numFmtId="166" formatCode="0.0"/>'
        '<numFmt numFmtId="167" formatCode="0.00"/>'
        '<numFmt numFmtId="168" formatCode="+0.00;-0.00;0.00"/>'
        '<numFmt numFmtId="169" formatCode="0.0%"/>'
        '</numFmts>'
        '<fonts count="4">'
        '<font><sz val="11"/><name val="Calibri"/></font>'                       # 0 normal
        '<font><b/><sz val="11"/><name val="Calibri"/></font>'                   # 1 negrita
        '<font><i/><sz val="10"/><color rgb="FF808080"/><name val="Calibri"/></font>'  # 2 nota
        '<font><sz val="11"/><name val="Calibri"/></font>'                       # 3 texto
        '</fonts>'
        '<fills count="2"><fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="10">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'                         # 0 general
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'           # 1 negrita
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'  # 2 int
        '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'  # 3 signed_int
        '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'  # 4 dec1
        '<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'  # 5 dec2
        '<xf numFmtId="168" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'  # 6 signed_dec2
        '<xf numFmtId="169" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'  # 7 pct
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'           # 8 nota
        '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'           # 9 texto
        '</cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        '</styleSheet>')


def _core_xml(meta: dict) -> str:
    title = _esc((meta or {}).get("title", "Exportación"))
    author = _esc((meta or {}).get("generated_by", ""))
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<cp:coreProperties '
            'xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/" '
            'xmlns:dcterms="http://purl.org/dc/terms/" '
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            f'<dc:title>{title}</dc:title>'
            f'<dc:creator>{author}</dc:creator>'
            f'<cp:lastModifiedBy>{author}</cp:lastModifiedBy>'
            f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>'
            f'<dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>'
            '</cp:coreProperties>')


def _portada_sheet(meta: dict) -> str:
    meta = meta or {}
    entity = meta.get("entity") or {}
    comp = meta.get("competition") or {}
    base = meta.get("base") or {}
    rows = [
        ("Título", meta.get("title", "")),
        ("Entidad", entity.get("name", "")),
        ("Competencia", comp.get("label", "")),
        ("Temporada", comp.get("season", "")),
    ]
    for f in (meta.get("filters") or []):
        rows.append((f.get("label", "Filtro"), f.get("value", "")))
    rows.extend([
        ("Base", base.get("label", "")),
        ("Orden", _sort_label(meta.get("sort"))),
        ("Columnas visibles", _columns_label(meta.get("columns_visible"))),
        ("Generado", meta.get("generated_at", "")),
        ("Usuario", meta.get("generated_by", "")),
        ("Versión", meta.get("app_version", "")),
    ])
    for t in (meta.get("empty_tables") or []):
        rows.append(("Sin datos", t))

    body = []
    r = 1
    for label, value in rows:
        cells = _text_cell("A", r, label, style=STYLE_BOLD)
        cells += _text_cell("B", r, value)
        body.append(f'<row r="{r}">{cells}</row>')
        r += 1
    # Nota final
    note = ("Celda vacía = dato inexistente (—). Métricas calculadas por Smart-Basket; "
            "fórmulas en docs/metrics.md.")
    r += 1
    body.append(f'<row r="{r}">{_text_cell("A", r, note, style=STYLE_NOTE)}</row>')

    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<cols><col min="1" max="1" width="22" customWidth="1"/>'
            '<col min="2" max="2" width="60" customWidth="1"/></cols>'
            f'<sheetData>{"".join(body)}</sheetData></worksheet>')


def _sort_label(sort) -> str:
    if not sort:
        return "—"
    key = sort.get("label") or sort.get("key", "")
    direction = "desc" if sort.get("dir") == "desc" else "asc"
    return f"{key} ({direction})"


def _columns_label(cols) -> str:
    if not cols:
        return "Todas"
    if isinstance(cols, list):
        return ", ".join(str(c) for c in cols)
    return str(cols)


def _data_sheet(sheet: dict) -> str:
    cols = sheet["columns"]
    ncols = len(cols)
    body = []

    # Fila 1: títulos (negrita)
    header_cells = ""
    for ci, c in enumerate(cols):
        header_cells += _text_cell(_col_ref(ci), 1, c.get("label", c.get("key", "")), style=STYLE_BOLD)
    body.append(f'<row r="1">{header_cells}</row>')

    r = 2
    for row in (sheet.get("rows") or []):
        cells = ""
        for ci, (c, v) in enumerate(zip(cols, row)):
            cells += _cell(_col_ref(ci), r, v, c.get("fmt", "text"))
        body.append(f'<row r="{r}">{cells}</row>')
        r += 1

    footer = sheet.get("footer") or []
    if footer:
        r += 1  # fila vacía de separación
        for frow in footer:
            cells = ""
            for ci, (c, v) in enumerate(zip(cols, frow)):
                # footer en negrita: para números usamos el estilo de formato normal (el valor
                # ya es nativo); para texto, negrita.
                if v is not None and v != "" and c.get("fmt", "text") != "text" and _is_number(v):
                    cells += _cell(_col_ref(ci), r, v, c.get("fmt", "text"))
                else:
                    cells += _text_cell(_col_ref(ci), r, v, style=STYLE_BOLD)
            body.append(f'<row r="{r}">{cells}</row>')
            r += 1

    # Anchos estimados por largo del título
    cols_xml = "".join(
        f'<col min="{i + 1}" max="{i + 1}" width="{_est_width(c.get("label", c.get("key", "")))}" customWidth="1"/>'
        for i, c in enumerate(cols))

    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<sheetViews><sheetView workbookViewId="0">'
            '<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>'
            '</sheetView></sheetViews>'
            f'<cols>{cols_xml}</cols>'
            f'<sheetData>{"".join(body)}</sheetData></worksheet>')


def _est_width(label: str) -> int:
    return max(8, min(40, len(str(label or "")) + 3))
