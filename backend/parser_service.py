import re
import html

# =========================================================
# 🔐 GLOBAL SECURITY LAYER (NON-BREAKING)
# =========================================================

MAX_INPUT_SIZE = 50000  # prevent abuse / DOS

def safe_text(text):
    if text is None:
        return ""

    # convert to string safely
    text = str(text)

    # 🔒 prevent huge payloads
    if len(text) > MAX_INPUT_SIZE:
        raise ValueError("Input too large")

    # 🔒 escape XML/HTML
    text = html.escape(text)

    # 🔒 remove control characters
    text = re.sub(r'[\x00-\x1F\x7F]', '', text)

    return text.strip()


def safe_logic(logic):
    if not isinstance(logic, str):
        return logic

    # 🔒 remove dangerous characters (non-breaking)
    logic = re.sub(r'[^a-zA-Z0-9\.\_\s\(\)orand]+', '', logic)

    return logic.strip()


# =========================================================
# 🔹 CLEAN TEXT (ORIGINAL — NOT MODIFIED)
# =========================================================
def normalize_logic(logic, rows=None, options=None):
    if not logic:
        return None

    if isinstance(logic, str):
        logic = logic.strip()

        # 🔒 SAFE WRAP
        logic = safe_logic(logic)

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

        if not logic:
            return None

        return logic

    if isinstance(logic, dict):
        return logic

    return None


# =========================================================
# 🔹 SAFE SPLIT BLOCKS
# =========================================================
def split_blocks(text):
    text = safe_text(text)
    return re.split(r'(?=\n?\s*\[q[^\]]+\])', text.strip(), flags=re.I)


def normalize_pipe(text):
    text = safe_text(text)

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
    text = safe_text(text)

    if not text:
        return ""

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
    text = safe_text(text)
    return re.sub(r'\s+', ' ', text).strip()


# =========================================================
# 🔹 SPLIT TEXT + DESCRIPTION
# =========================================================
def split_text_desc(text):
    text = safe_text(text)

    if not text:
        return "", ""

    if "|" in text:
        parts = text.split("|", 1)
        return parts[0].strip(), parts[1].strip()

    return text.strip(), ""

# =========================================================
# 🔹 FLAG DETECTION (SECURE WRAPPED)
# =========================================================
def detect_flags(text):
    text = safe_text(text)

    if not text:
        return {
            "anchor": False,
            "exclusive": False,
            "terminate": False,
            "other": False
        }

    text = text.replace("’", "'")
    lower = text.lower()

    # 🔒 SAFE extraction
    try:
        tags = re.findall(r'[\(\[\{](.*?)[\)\]\}]', lower)
    except Exception:
        tags = []

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


# =========================================================
# 🔹 SAFE BLOCK PARSER
# =========================================================
def smart_block_parser(text):
    text = safe_text(text)

    try:
        blocks = split_blocks(text)
    except Exception:
        return []

    questions = []

    for block in blocks:
        try:
            lines = [safe_text(l) for l in block.split("\n") if l.strip()]
        except Exception:
            continue

        if not lines:
            continue

        qid, title, logic, config = extract_flexible_header(lines)

        # 🔒 fallback safe
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
            "rawText": block
        })

    return questions


# =========================================================
# 🔹 PARSE LIST (CRITICAL HARDENING)
# =========================================================
def parse_list(text):
    text = safe_text(text)

    if not text:
        return []

    lines = text.split("\n")
    result = []
    seen_values = set()

    for raw_line in lines:

        if not raw_line:
            continue

        try:
            line = normalize(raw_line.replace("\u00A0", " ").replace("’", "'"))
        except Exception:
            continue

        if not line:
            continue

        # 🔢 SAFE number detection
        num_match = re.match(r'^\s*(\d{1,3})[\.\)\-:]\s+(.*)', line)

        if num_match:
            try:
                value = int(num_match.group(1))
            except:
                continue

            raw = num_match.group(2)
        else:
            value = len(result) + 1
            raw = line

        # 🔒 HARD LIMIT
        if value > 999:
            continue

        # 🚫 prevent duplicates
        if value in seen_values:
            continue
        seen_values.add(value)

        try:
            text_part, desc_part = split_text_desc(raw)
        except:
            text_part, desc_part = raw, ""

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
        # 🔥 DECIPHER NORMALIZATION (UNCHANGED)
        # =====================================================

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

    # 🔒 SAFE ORDERING
    normal = [r for r in result if r["value"] not in [97, 98, 99]]
    special = [r for r in result if r["value"] in [97, 98, 99]]

    return normal + special


# =========================================================
# 🔹 GRID PARSER
# =========================================================
def parse_grid(rows_text, cols_text):
    rows_text = safe_text(rows_text)
    cols_text = safe_text(cols_text)

    return parse_list(rows_text), parse_list(cols_text)

# =========================================================
# 🔹 BUILD LABEL FROM QID
# =========================================================
def build_label_from_qid(qid):
    qid = safe_text(qid)

    if not qid:
        return ""

    return qid.replace(".", "_")


# =========================================================
# 🔹 EXTRACT FLEXIBLE HEADER (HARDENED)
# =========================================================
def extract_flexible_header(lines):
    if not lines:
        return None, "", None, {}

    first = safe_text(lines[0])

    # 🔒 SAFE REGEX
    match = re.match(r'\[(q[^\]]+)\](.*)', first, re.I)

    if not match:
        return None, "", None, {}

    qid = match.group(1).lower().strip()

    # 🔐 VALIDATE QID
    if not re.match(r'^[a-zA-Z0-9_\[\]\.]+$', qid):
        raise ValueError("Invalid question ID")

    rest = safe_text(match.group(2)).strip()

    # =====================================================
    # 🔹 LOGIC EXTRACTION
    # =====================================================
    logic = None

    logic_match = re.search(r'\((.*?)\)', rest)
    if logic_match:
        raw_logic = logic_match.group(1)

        # 🔒 SAFE LOGIC
        logic = normalize_logic(raw_logic)

        rest = rest.replace(f"({raw_logic})", "").strip()

    # =====================================================
    # 🔹 CONFIG EXTRACTION
    # =====================================================
    config = {}

    config_matches = re.findall(r'\[(.*?)\]', rest)

    for conf in config_matches:
        conf = safe_text(conf).lower()

        if "=" in conf:
            try:
                k, v = conf.split("=", 1)
                config[k.strip()] = v.strip()
            except:
                continue
        else:
            config[conf.strip()] = True

    # remove config from title
    rest = re.sub(r'\[.*?\]', '', rest).strip()

    title = normalize_pipe(normalize(rest))
    title = safe_text(title)

    return qid, title, logic, config


# =========================================================
# 🔹 MAIN PARSER (MOST IMPORTANT)
# =========================================================
def parse_input(payload):
    # =====================================================
    # 🔐 GLOBAL INPUT PROTECTION
    # =====================================================
    raw_text = safe_text(payload)

    if not raw_text:
        return []

    if len(raw_text) > MAX_INPUT_SIZE:
        raise ValueError("Input too large")

    # =====================================================
    # 🔹 SPLIT INTO BLOCKS
    # =====================================================
    try:
        blocks = split_blocks(raw_text)
    except Exception:
        return []

    all_questions = []

    # =====================================================
    # 🔹 PROCESS EACH BLOCK
    # =====================================================
    for block in blocks:

        block = safe_text(block)

        if not block:
            continue

        try:
            lines = [safe_text(l) for l in block.split("\n") if l.strip()]
        except Exception:
            continue

        if not lines:
            continue

        # =================================================
        # 🔹 HEADER EXTRACTION
        # =================================================
        try:
            qid, title, logic, config = extract_flexible_header(lines)
        except Exception:
            continue

        if not qid:
            continue

        # =================================================
        # 🔐 LOGIC HARDENING
        # =================================================
        logic = safe_logic(logic)

        # =================================================
        # 🔹 DETECT QUESTION TYPE
        # =================================================
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

        # =================================================
        # 🔹 OPTIONS EXTRACTION
        # =================================================
        option_lines = []
        capture = False

        for l in lines:
            if not capture and title.lower() in l.lower():
                capture = True
                continue

            if capture:
                option_lines.append(l)

        options_text = "\n".join(option_lines)

        # =================================================
        # 🔹 SAFE OPTION PARSING
        # =================================================
        try:
            parsed_options = parse_list(options_text)
        except Exception:
            parsed_options = []

        # =================================================
        # 🔹 BUILD QUESTION OBJECT
        # =================================================
        question = {
            "id": qid,
            "label": build_label_from_qid(qid),
            "title": title,
            "type": qtype,
            "logic": logic,
            "config": config,
            "options": parsed_options,
            "rawText": block
        }

        # 🔒 FINAL SAFETY CHECKS
        if not isinstance(question["options"], list):
            question["options"] = []

        all_questions.append(question)

    return all_questions

# =========================================================
# 🔹 FINAL SANITIZATION LAYER (OUTPUT SAFE)
# =========================================================

def sanitize_output_text(text):
    if not text:
        return ""

    text = str(text)

    # already escaped earlier, but double safety for output layer
    text = html.escape(text)

    # remove any remaining control chars
    text = re.sub(r'[\x00-\x1F\x7F]', '', text)

    return text.strip()


# =========================================================
# 🔹 SAFE QUESTION NORMALIZER
# =========================================================
def normalize_question_output(question):
    if not isinstance(question, dict):
        return {}

    safe_q = {}

    # 🔒 basic fields
    safe_q["id"] = sanitize_output_text(question.get("id"))
    safe_q["label"] = sanitize_output_text(question.get("label"))
    safe_q["title"] = sanitize_output_text(question.get("title"))
    safe_q["type"] = sanitize_output_text(question.get("type"))

    # 🔒 logic safe
    logic = question.get("logic")
    safe_q["logic"] = sanitize_output_text(logic) if logic else None

    # 🔒 config safe
    config = question.get("config", {})
    safe_config = {}

    if isinstance(config, dict):
        for k, v in config.items():
            safe_config[sanitize_output_text(k)] = sanitize_output_text(v)

    safe_q["config"] = safe_config

    # 🔒 options safe
    safe_options = []

    for opt in question.get("options", []):
        if not isinstance(opt, dict):
            continue

        safe_opt = {
            "label": sanitize_output_text(opt.get("label")),
            "value": opt.get("value"),
            "text": sanitize_output_text(opt.get("text")),
            "desc": sanitize_output_text(opt.get("desc")),

            "anchor": bool(opt.get("anchor")),
            "exclusive": bool(opt.get("exclusive")),
            "terminate": bool(opt.get("terminate")),
            "other": bool(opt.get("other")),
        }

        safe_options.append(safe_opt)

    safe_q["options"] = safe_options

    return safe_q


# =========================================================
# 🔹 FINAL PIPELINE WRAPPER
# =========================================================
def secure_parse_pipeline(payload):
    try:
        parsed = parse_input(payload)
    except Exception:
        return []

    if not isinstance(parsed, list):
        return []

    safe_output = []

    for q in parsed:
        try:
            safe_q = normalize_question_output(q)
            safe_output.append(safe_q)
        except Exception:
            continue

    return safe_output


# =========================================================
# 🔹 SAFE XML PREPARATION
# =========================================================
def prepare_for_xml(questions):
    if not isinstance(questions, list):
        return []

    final = []

    for q in questions:
        if not isinstance(q, dict):
            continue

        # 🔒 ensure required fields exist
        if not q.get("id") or not q.get("type"):
            continue

        # 🔒 sanitize again (defense in depth)
        safe_q = normalize_question_output(q)

        final.append(safe_q)

    return final


# =========================================================
# 🔹 SAFE EXPORT (XML GENERATOR ENTRY)
# =========================================================
def generate_safe_xml(payload, xml_generator_func):
    """
    Wrapper to ensure all data going into XML generator is safe
    """

    # Step 1: secure parse
    questions = secure_parse_pipeline(payload)

    # Step 2: final prep
    questions = prepare_for_xml(questions)

    # Step 3: fail-safe
    if not questions:
        return "<survey></survey>"

    try:
        xml = xml_generator_func(questions)
    except Exception:
        return "<survey></survey>"

    # 🔒 final sanity check
    if not isinstance(xml, str):
        return "<survey></survey>"

    return xml


# =========================================================
# 🔹 FAIL-SAFE FALLBACK
# =========================================================
def safe_empty_response():
    return {
        "questions": [],
        "xml": "<survey></survey>"
    }


# =========================================================
# 🔹 DEBUG SAFE (OPTIONAL)
# =========================================================
def debug_safe_preview(payload):
    """
    Safe preview for debugging (no raw exposure)
    """

    try:
        parsed = secure_parse_pipeline(payload)

        return {
            "count": len(parsed),
            "ids": [q.get("id") for q in parsed]
        }

    except Exception:
        return {
            "count": 0,
            "ids": []
        }


# =========================================================
# 🔹 FINAL ENTRY (USE THIS IN API)
# =========================================================
def process_request(payload, xml_generator_func):
    """
    🔥 THIS is the ONLY function your API should call
    """

    if not payload:
        return safe_empty_response()

    # 🔐 full secure pipeline
    xml = generate_safe_xml(payload, xml_generator_func)

    return {
        "xml": xml
    }