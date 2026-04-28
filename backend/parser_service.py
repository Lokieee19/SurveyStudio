import re

# =========================================================
# 🔹 CLEAN TEXT
# =========================================================
def normalize_logic(logic, rows=None, options=None):
    if not logic:
        return None

    if isinstance(logic, str):
        logic = logic.strip()

        # q1 == 3 → q1.r3
        logic = re.sub(
            r'(\w+)\s*==\s*(\d+)',
            lambda m: f"{m.group(1)}.r{m.group(2)}",
            logic
        )

        # 🔥 FIX: "in" → OR
        logic = re.sub(
            r'(\w+)\s+in\s+([\d,]+)',
            lambda m: " or ".join([f"{m.group(1)}.r{x.strip()}" for x in m.group(2).split(",")]),
            logic,
            flags=re.I
        )

        # 🔥 FIX: contains → OR
        logic = re.sub(
            r'(\w+)\s+contains\s+([\d,]+)',
            lambda m: " or ".join([f"{m.group(1)}.r{x.strip()}" for x in m.group(2).split(",")]),
            logic,
            flags=re.I
        )

        # 🔥 REMOVE unsupported < and >
        logic = re.sub(r'(\w+)\s*<\s*\d+', '', logic)
        logic = re.sub(r'(\w+)\s*>\s*\d+', '', logic)

        # 🔥 FIX spacing issues (q1 .r3 → q1.r3)
        logic = re.sub(r'\s*\.\s*', '.', logic)

        logic = logic.strip()

        # 🔥 CRITICAL: prevent empty logic
        if not logic:
            return None

        return logic

    if isinstance(logic, dict):
        return logic

    return None

def split_blocks(text):
    return re.split(r'(?=\n?\s*\[q[^\]]+\])', text.strip(), flags=re.I)

def normalize_pipe(text):
    if not text:
        return text

    return re.sub(r'\[PIPE:\s*(.*?)\]', r'[pipe: \1]', text, flags=re.I)

def build_cond(logic):
    if not logic:
        return ""

    if isinstance(logic, str):
        return f' cond="({logic})"'

    if isinstance(logic, dict):
        source = logic.get("source")
        rows = logic.get("rows") or []
        cols = logic.get("columns") or []

        if not source or not rows or not cols:
            return ""

        conds = [f"{source}.r{r}.c{c}" for r in rows for c in cols]

        return f' cond="({" or ".join(conds)})"'

    return ""

def clean_text(text):
    if not text:
        return ""

    # 🔥 remove ONLY flag-type brackets (keep pipe)
    text = re.sub(
        r'[\(\[\{]\s*(anchor|exclusive|terminate|other)[^)\]\}]*[\)\]\}]',
        '',
        text,
        flags=re.I
    )

    return text.strip()


# =========================================================
# 🔹 NORMALIZE TEXT
# =========================================================
def normalize(text):
    return re.sub(r'\s+', ' ', text).strip()


# =========================================================
# 🔹 SPLIT TEXT + DESCRIPTION (🔥 NEW)
# =========================================================
def split_text_desc(text):
    if not text:
        return "", ""

    # 🔥 support: "text | description"
    if "|" in text:
        parts = text.split("|", 1)
        return parts[0].strip(), parts[1].strip()

    return text.strip(), ""


# =========================================================
# 🔹 FLAG DETECTION (UNCHANGED CORE)
# =========================================================
def detect_flags(text):
    if not text:
        return {
            "anchor": False,
            "exclusive": False,
            "terminate": False,
            "other": False
        }

    text = text.replace("’", "'")
    lower = text.lower()

    tags = re.findall(r'[\(\[\{](.*?)[\)\]\}]', lower)
    tag_text = " ".join(tags)

    is_other = (
        "other" in lower and
        any(x in lower for x in ["specify", "mention", "please"])
    )

    is_exclusive = (
        "exclusive" in tag_text
        or "exclusive" in lower
        or "all of the above" in lower
        or "none of the above" in lower
        or "none of these" in lower
        or "don't know" in lower
        or "dont know" in lower
    )

    is_terminate = (
        "terminate" in tag_text
        or "screen out" in lower
        or "disqualify" in lower
    )

    is_anchor = (
        "anchor" in tag_text
        or "anchor" in lower
        or is_other
        or is_exclusive
    )

    return {
        "anchor": is_anchor,
        "exclusive": is_exclusive,
        "terminate": is_terminate,
        "other": is_other
    }

def smart_block_parser(text):
    blocks = split_blocks(text)   # ✅ USE FUNCTION HERE
    questions = []

    for block in blocks:
        lines = [l.strip() for l in block.split("\n") if l.strip()]

        if not lines:
            continue

        qid, title, logic, config = extract_flexible_header(lines)

        # 🔥 fallback if header missed
        if not qid:
            match = re.search(r'\[(q[^\]]+)\]', block, re.I)
            if match:
                qid = match.group(1).lower()
            else:
                continue

        lower = block.lower()

        if "select all" in lower or "ms" in lower:
            qtype = "checkbox"
        elif "grid" in lower:
            qtype = "radio_grid"
        elif "numeric" in lower or "$" in lower:
            qtype = "number_multi"
        elif "open" in lower:
            qtype = "textarea_single"
        else:
            qtype = "radio"

        # 🔥 FIX: better option capture
        option_lines = []
        capture = False

        for l in lines:
            if not capture and title.lower() in l.lower():
                capture = True
                continue

            if capture:
                option_lines.append(l)

        options_text = "\n".join(option_lines)

        questions.append({
            "id": qid,
            "title": title,
            "type": qtype,
            "optionsText": options_text,
            "logic": logic,
            "config": config,
            "rawText": block   # 🔥 important for grids later
        })

    return questions

# =========================================================
# 🔹 PARSE LIST (🔥 MAJOR UPGRADE)
# =========================================================
def parse_list(text):
    if not text:
        return []

    lines = text.split("\n")
    result = []
    seen_values = set()

    for raw_line in lines:
        if not raw_line:
            continue

        line = normalize(raw_line.replace("\u00A0", " ").replace("’", "'"))
        if not line:
            continue

        # 🔢 number detection
        num_match = re.match(r'^\s*(\d{1,3})[\.\)\-:]\s+(.*)', line)

        if num_match:
            value = int(num_match.group(1))
            raw = num_match.group(2)
        else:
            value = len(result) + 1
            raw = line

        # 🚫 prevent duplicates
        if value in seen_values:
            continue
        seen_values.add(value)

        text_part, desc_part = split_text_desc(raw)
        flags = detect_flags(text_part)

        clean = normalize_pipe(clean_text(text_part))
        lower = clean.lower()

        item = {
            "label": f"r{value}",
            "value": value,
            "text": clean,
            "desc": desc_part,

            "anchor": flags.get("anchor", False),
            "exclusive": flags.get("exclusive", False),
            "terminate": flags.get("terminate", False),
            "other": flags.get("other", False),
        }

        # =====================================================
        # 🔥 HARD DECIPHER NORMALIZATION
        # =====================================================

        # 97 → Don't know
        if (
            value == 97
            or "don't know" in lower
            or "dont know" in lower
        ):
            item.update({
                "value": 97,
                "label": "r97",
                "text": "Don't know",
                "exclusive": True,
                "anchor": True,
                "other": False
            })

        # 98 → Other
        elif (
            value == 98
            or ("other" in lower and "specify" in lower)
        ):
            item.update({
                "value": 98,
                "label": "r98",
                "text": "Other",
                "exclusive": False,
                "anchor": True,
                "other": True
            })

        # 99 → None
        elif (
            value == 99
            or "none of these" in lower
            or "none of the above" in lower
        ):
            item.update({
                "value": 99,
                "label": "r99",
                "text": "None of these",
                "exclusive": True,
                "anchor": True,
                "other": False
            })

        result.append(item)

    # =====================================================
    # 🔥 ENSURE ORDER → normal first, special last
    # =====================================================
    normal = [r for r in result if r["value"] not in [97, 98, 99]]
    special = [r for r in result if r["value"] in [97, 98, 99]]

    return normal + special


# =========================================================
# 🔹 GRID PARSER
# =========================================================
def parse_grid(rows_text, cols_text):
    return parse_list(rows_text), parse_list(cols_text)


# =========================================================
# 🔹 LABEL BUILDER (UNCHANGED)
# =========================================================
def build_label_from_qid(qid):
    if not qid:
        return "q1"

    text = qid.strip()

    q_match = re.search(r'q\d+', text, re.I)
    q_prefix = q_match.group(0).lower() if q_match else "q1"

    bracket = re.search(r'\[(.*?)\]', text)

    if bracket:
        content = bracket.group(1)
    else:
        content = re.sub(r'q\d+[\.\_\s]*', '', text, flags=re.I)

    content = re.sub(r'[^a-z0-9]+', '_', content.lower())
    content = re.sub(r'_+', '_', content).strip("_")
    content = content[:40]

    return f"{q_prefix}_{content}" if content else q_prefix


def extract_flexible_header(lines):
    qid = ""
    title = ""
    logic = None
    config = {}

    for i, line in enumerate(lines):

        # 🔥 detect [qX] ANYWHERE in line
        match = re.search(r'\[(q[^\]]+)\]', line, re.I)

        if match:
            qid = match.group(1).lower()

            # remove it safely
            line = re.sub(r'\[q[^\]]+\]', '', line, flags=re.I).strip()

            # logic
            if "ask if" in line.lower():
                logic = line.lower().split("ask if")[-1].strip()

            continue

        # first real sentence = title
        if not title and len(line) > 20:
            title = line.strip()

    return qid, title, logic, config

# =========================================================
# 🔹 DEFAULT COMMENTS (UNCHANGED)
# =========================================================
def get_default_comment(qtype):
    return {
        "radio": "Select one",
        "checkbox": "Select all that apply",
        "radio_grid": "Please select one for each",
        "checkbox_grid": "Please select all that apply for each row",
        "card_radio": "Please select one for each card",
        "card_checkbox": "Please select all that apply for each card",
        "text_single": "Please specify",
        "text_multi": "Please specify",
        "textarea_single": "Please be as specific as possible but do not include any personal information",
        "textarea_multi": "Please be as specific as possible but do not include any personal information",
        "number_single": "Please enter a number",
        "number_multi": "Please provide your best estimate",
        "float_multi": "Enter a value",
        "autosum": "Please provide your best estimate",
        "ranking": "Please rank the following features",
        "html": ""
    }.get(qtype, "")

# =========================================================
# 🔹 MAIN PARSER (FULL UPGRADE)
# =========================================================
def parse_input(payload):

    qid = (payload.get("id") or "q1").strip()
    title_raw = payload.get("title", "")
    title = normalize_pipe(normalize(title_raw))

    qtype = payload.get("type", "radio")

    # =============================
    # 🔄 TYPE NORMALIZATION
    # =============================
    type_map = {
        "number": "number_multi",
        "float": "float_multi",
        "text": "text_multi",
        "textarea": "textarea_multi"
    }

    qtype = type_map.get(qtype, qtype)

    options = []
    rows = []
    columns = []
    special_rows = []

    # =============================
    # 🔥 TYPE HANDLING
    # =============================

    if qtype in ["radio", "checkbox"]:
        options = parse_list(payload.get("optionsText", ""))

        # =====================================================
        # 🔥 AUTO-INJECT SPECIAL OPTIONS FROM LOGIC
        # =====================================================
        logic_text = (payload.get("logic") or "").lower()

        def ensure_option(val, text, exclusive, anchor, other):
            if not any(o["value"] == val for o in options):
                options.append({
                    "label": f"r{val}",
                    "value": val,
                    "text": text,
                    "anchor": anchor,
                    "exclusive": exclusive,
                    "terminate": False,
                    "other": other
                })

        if "97" in logic_text:
            ensure_option(97, "Don't know", True, True, False)

        if "98" in logic_text:
            ensure_option(98, "Other", False, True, True)

        if "99" in logic_text:
            ensure_option(99, "None of these", True, True, False)

        # 🔥 enforce ordering (normal first, special last)
        normal = [o for o in options if o["value"] not in [97, 98, 99]]
        special = [o for o in options if o["value"] in [97, 98, 99]]
        options = normal + special

    elif qtype in ["radio_grid", "checkbox_grid", "card_radio", "card_checkbox"]:
        rows, columns = parse_grid(
            payload.get("rowsText", ""),
            payload.get("columnsText", "")
        )

    elif qtype == "number_single":
        options = parse_list(payload.get("optionsText", ""))

        rows = [{"label": "r1", "value": 1, "text": "Value", "desc": ""}]

        special_rows = [
            opt for opt in options
            if opt.get("terminate") or opt.get("exclusive")
        ]

    elif qtype in ["number_multi", "float_multi", "autosum"]:

        if payload.get("parsedRows"):
            rows = payload.get("parsedRows")

            for i, r in enumerate(rows):
                rows[i] = {
                    "label": r.get("label") or f"r{r.get('value', i+1)}",
                    "value": r.get("value", i + 1),
                    "text": r.get("text", ""),
                    "desc": r.get("description") or r.get("desc") or "",
                    "anchor": r.get("anchor", False),
                    "exclusive": r.get("exclusive", False),
                    "terminate": r.get("terminate", False),
                    "other": r.get("other", False),
                }

        else:
            rows = parse_list(payload.get("rowsText", ""))

    elif qtype in ["text_multi", "textarea_multi"]:
        rows = parse_list(payload.get("rowsText", ""))

        if not rows:
            rows = [{"label": "r1", "value": 1, "text": "", "desc": ""}]

    elif qtype in ["text_single", "textarea_single"]:
        rows = [{"label": "r1", "value": 1, "text": "", "desc": ""}]

    elif qtype == "ranking":
        rows = parse_list(payload.get("optionsText", ""))

    # =============================
    # 🔥 AUTO FLOAT DETECTION
    # =============================
    title_lower = (payload.get("title") or "").lower()

    if qtype == "number_multi":
        if "%" in title_lower or "percent" in title_lower:
            qtype = "float_multi"

    # =============================
    # 🧠 AUTO TYPE UPGRADE
    # =============================
    if qtype == "number_multi" and len(rows) == 1:
        qtype = "number_single"

    if qtype == "text_multi" and len(rows) == 1:
        qtype = "text_single"

    if qtype == "textarea_multi" and len(rows) == 1:
        qtype = "textarea_single"

    # =============================
    # 🔧 CONFIG
    # =============================
    randomize = payload.get("randomize", {}) or {}
    cfg_in = payload.get("config") or {}

    config = {
        "range": payload.get("range"),
        "optional": payload.get("optional"),
        "atleast": cfg_in.get("atleast"),
        "atmost": cfg_in.get("atmost"),
        "exact": cfg_in.get("exact"),
        "verify": payload.get("verify"),

        "amount": cfg_in.get("amount"),
        "tolerance": cfg_in.get("tolerance"),
        "enforceTotal": cfg_in.get("enforceTotal"),
        "autoFillRemainder": cfg_in.get("autoFillRemainder"),
        "showTotal": cfg_in.get("showTotal"),

        "minRanks": cfg_in.get("minRanks"),
        "unique": cfg_in.get("unique"),

        "rowLegend": cfg_in.get("rowLegend"),
        "preText": cfg_in.get("preText"),
        "alignment": cfg_in.get("alignment"),
        "inputSize": cfg_in.get("inputSize"),
        "placeholder": cfg_in.get("placeholder"),

        "autoAdvance": cfg_in.get("autoAdvance"),
        "disableInsteadOfHide": cfg_in.get("disableInsteadOfHide"),

        "randomize": randomize,
        "randomizeSubset": cfg_in.get("randomizeSubset"),
        "keepFirstFixed": cfg_in.get("keepFirstFixed"),
        "keepLastFixed": cfg_in.get("keepLastFixed"),

        "includeOther": cfg_in.get("includeOther"),
        "includeNone": cfg_in.get("includeNone"),
        "includeDK": cfg_in.get("includeDK"),
        "includePNA": cfg_in.get("includePNA"),

        "errorMessage": cfg_in.get("errorMessage"),

        "variableName": cfg_in.get("variableName"),
        "exportLabel": cfg_in.get("exportLabel"),

        "uses": None
    }

    # =============================
    # 🔢 RANGE DETECTION
    # =============================
    if not config.get("range"):
        match = re.search(r'\[(\d+)\s*-\s*(\d+)\]', title_raw)
        if match:
            config["range"] = [int(match.group(1)), int(match.group(2))]

    # =============================
    # 💰 PREFIX DETECTION
    # =============================
    if not config.get("preText"):
        if "$" in title_raw:
            config["preText"] = "$"
        elif "₹" in title_raw:
            config["preText"] = "₹"
        elif "%" in title_raw:
            config["preText"] = "%"

    # =============================
    # 🔗 LOGIC
    # =============================
    logic = normalize_logic(payload.get("logic"), rows, options)

    # 🔥 CRITICAL FIX: remove bad spacing
    if isinstance(logic, str):
        logic = re.sub(r'\s*\.\s*', '.', logic)

    # =============================
    # 🔚 FINAL OBJECT
    # =============================
    question = {
        "id": qid,
        "label": build_label_from_qid(qid),
        "title": title,
        "type": qtype,
        "base_type": qtype.split("_")[0],

        "options": options,
        "special_rows": special_rows,
        "rows": rows,
        "columns": columns,

        "description": payload.get("description"),
        "comment": payload.get("comment") or get_default_comment(qtype),

        "config": config,
        "randomize": randomize,
        "optional": payload.get("optional"),

        "logic": logic,
        "target": payload.get("target"),
        "terminate": payload.get("terminate"),
        "defaultTarget": payload.get("defaultTarget"),

        "loop": payload.get("loop"),

        "raw": payload
    }

    # 🔥 FINAL SAFETY
    if not rows:
        question["rows"] = [{
            "label": "r1",
            "value": 1,
            "text": "Value",
            "desc": "",
            "anchor": False,
            "exclusive": False,
            "terminate": False,
            "other": False
        }]

    return [question]