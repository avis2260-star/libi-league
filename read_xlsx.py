import zipfile
import xml.etree.ElementTree as ET
import sys
import io

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

XLSX_PATH = r"C:\Users\Avi_Sab\Desktop\ליגת ליבי\2025-6\תוצאות וטבלאות לעונת 2025-6 ליגת ליבי(AutoRecovered).xlsx"

NS = {
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r':    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'rel':  'http://schemas.openxmlformats.org/package/2006/relationships',
}

def col_letter(n):
    """Convert 0-based column index to Excel letter(s)."""
    result = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        result = chr(65 + r) + result
    return result

def cell_ref_to_indices(ref):
    """'B3' -> (row=2, col=1) both 0-based."""
    col_str = ""
    row_str = ""
    for ch in ref:
        if ch.isalpha():
            col_str += ch
        else:
            row_str += ch
    col_idx = 0
    for ch in col_str:
        col_idx = col_idx * 26 + (ord(ch) - ord('A') + 1)
    return int(row_str) - 1, col_idx - 1

with zipfile.ZipFile(XLSX_PATH, 'r') as z:
    names = z.namelist()

    # ── shared strings ────────────────────────────────────────────────────
    shared_strings = []
    if 'xl/sharedStrings.xml' in names:
        with z.open('xl/sharedStrings.xml') as f:
            tree = ET.parse(f)
        root = tree.getroot()
        for si in root.findall('main:si', NS):
            parts = []
            for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
                if t.text:
                    parts.append(t.text)
            shared_strings.append(''.join(parts))

    # ── workbook: sheet list ───────────────────────────────────────────────
    with z.open('xl/workbook.xml') as f:
        wb_tree = ET.parse(f)
    wb_root = wb_tree.getroot()

    sheets_elem = wb_root.findall('.//main:sheet', NS)

    # ── workbook relationships ─────────────────────────────────────────────
    with z.open('xl/_rels/workbook.xml.rels') as f:
        rel_tree = ET.parse(f)
    rel_root = rel_tree.getroot()
    rel_map = {}
    for rel in rel_root:
        rel_map[rel.attrib['Id']] = rel.attrib['Target']

    # ── styles (for number formats) ────────────────────────────────────────
    num_fmt_map = {}
    cell_xfs = []
    if 'xl/styles.xml' in names:
        with z.open('xl/styles.xml') as f:
            sty_tree = ET.parse(f)
        sty_root = sty_tree.getroot()
        for nf in sty_root.findall('.//main:numFmt', NS):
            num_fmt_map[nf.attrib['numFmtId']] = nf.attrib.get('formatCode', '')
        for xf in sty_root.findall('.//main:cellXfs/main:xf', NS):
            cell_xfs.append(xf.attrib.get('numFmtId', '0'))

    # ── iterate sheets ─────────────────────────────────────────────────────
    for sh_elem in sheets_elem:
        sheet_name = sh_elem.attrib['name']
        r_id = sh_elem.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        target = rel_map.get(r_id, '')
        sheet_path = 'xl/' + target if not target.startswith('xl/') else target

        if sheet_path not in names:
            print(f"\n{'='*60}")
            print(f"SHEET: {sheet_name}  [file not found: {sheet_path}]")
            continue

        with z.open(sheet_path) as f:
            sh_tree = ET.parse(f)
        sh_root = sh_tree.getroot()

        # collect all cells into a 2-D dict {row: {col: value}}
        grid = {}
        max_row = 0
        max_col = 0

        for row_elem in sh_root.findall('.//main:row', NS):
            r_idx = int(row_elem.attrib['r']) - 1  # 0-based
            if r_idx > max_row:
                max_row = r_idx
            for cell in row_elem.findall('main:c', NS):
                ref = cell.attrib['r']
                _, c_idx = cell_ref_to_indices(ref)
                if c_idx > max_col:
                    max_col = c_idx

                cell_type = cell.attrib.get('t', '')
                v_elem = cell.find('main:v', NS)
                f_elem = cell.find('main:f', NS)
                is_elem = cell.find('main:is', NS)

                raw_val = None
                if v_elem is not None and v_elem.text is not None:
                    raw_val = v_elem.text

                if cell_type == 's':
                    # shared string
                    try:
                        val = shared_strings[int(raw_val)]
                    except (TypeError, IndexError, ValueError):
                        val = raw_val
                elif cell_type == 'inlineStr':
                    if is_elem is not None:
                        parts = [t.text or '' for t in is_elem.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')]
                        val = ''.join(parts)
                    else:
                        val = raw_val
                elif cell_type == 'b':
                    val = 'TRUE' if raw_val == '1' else 'FALSE'
                elif cell_type == 'str':
                    # formula result stored as string
                    val = raw_val if raw_val is not None else ''
                    if f_elem is not None and val == '':
                        val = f'[formula: {f_elem.text}]'
                elif raw_val is None:
                    val = ''
                else:
                    # numeric — try to present as int if whole number
                    try:
                        fval = float(raw_val)
                        if fval == int(fval):
                            val = str(int(fval))
                        else:
                            val = raw_val
                    except ValueError:
                        val = raw_val

                grid.setdefault(r_idx, {})[c_idx] = val

        num_rows = max_row + 1
        num_cols = max_col + 1

        print(f"\n{'='*60}")
        print(f"SHEET: {sheet_name}")
        print(f"Dimensions: {num_rows} rows x {num_cols} columns")
        print()

        # header row of column letters
        header = "ROW\t" + "\t".join(col_letter(c) for c in range(num_cols))
        print(header)
        print("-" * (len(header) + num_cols * 4))

        for r in range(num_rows):
            row_data = grid.get(r, {})
            cells = [str(row_data.get(c, '')) for c in range(num_cols)]
            print(f"{r+1}\t" + "\t".join(cells))

        print()

print("\n\nDone.")
