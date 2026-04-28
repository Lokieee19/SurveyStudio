import re


# =========================================================
# 🔥 AST LOGIC ENGINE (ADD BELOW IMPORTS)
# =========================================================
# ---------------- TOKENIZER ----------------
TOKEN_SPEC = [
    ("NUMBER",   r'\d+'),
    ("AND",      r'\band\b', re.I),
    ("OR",       r'\bor\b', re.I),

    ("EQ",       r'==|='),
    ("NEQ",      r'!='),
    ("IN",       r'\bin\b', re.I),
    ("CONTAINS", r'\bcontains\b', re.I),

    ("GTE", r'>='),
    ("LTE", r'<='),

    ("GT", r'>'),
    ("LT", r'<'),

    ("LPAREN",   r'\('),
    ("RPAREN",   r'\)'),
    ("COMMA",    r','),

    ("VAR", r'[A-Za-z][A-Za-z0-9_]*'),
    ("SKIP",     r'\s+'),
]

def gen_insert(source_text):
    if not source_text or "<Insert" not in source_text:
        return ""

    match = re.search(r"<Insert (.*?)>", source_text, re.IGNORECASE)
    if not match:
        return ""

    rule = match.group(1).strip().lower()

    # =====================================================
    # 🔹 SOURCE
    # =====================================================
    source_match = re.match(r"(q\d+[a-z0-9_]*)", rule)
    if not source_match:
        return ""

    source_key = source_match.group(1)

    source_q = None
    for q in questions_global:
        lbl = q.get("label", "")
        if lbl == source_key or lbl.startswith(f"{source_key}_"):
            source_q = lbl
            break

    if not source_q:
        source_q = source_key

    # =====================================================
    # 🔹 CONDITION
    # =====================================================
    cond_str = ""
    rows_str = ""

    where_match = re.search(r"where (.+)", rule)
    if where_match:
        condition = where_match.group(1).strip()

        col_match = re.search(r'column\s*=\s*([\d,\s]+)', condition)
        if col_match:
            values = col_match.group(1).replace(" ", "")
            vals = values.split(",")

            condition = " or ".join(
                f"{source_q}.c{v}" for v in vals
            )

        cond_str = f' cond="{condition}"'

    # =====================================================
    # 🔹 ROW MODES
    # =====================================================
    if "selected" in rule:
        rows_str = ' rows="selected"'
    elif "notselected" in rule:
        rows_str = ' rows="notselected"'

    # =====================================================
    # 🔥 FINAL
    # =====================================================
    return f'<insert source="{source_q}" type="rows"{cond_str}{rows_str}/>'

def tokenize(text):
    tokens = []
    pos = 0

    while pos < len(text):
        match = None

        for spec in TOKEN_SPEC:
            name = spec[0]
            pattern = spec[1]
            flags = spec[2] if len(spec) > 2 else 0

            regex = re.compile(pattern, flags)
            match = regex.match(text, pos)

            if match:
                val = match.group(0)
                if name != "SKIP":
                    tokens.append((name, val))
                pos = match.end()
                break

        if not match:
            raise SyntaxError(f"Unexpected token: {text[pos]}")

    return tokens


# ---------------- AST ----------------
class Node: pass

class BinOp(Node):
    def __init__(self, left, op, right):
        self.left = left
        self.op = op
        self.right = right

class Condition(Node):
    def __init__(self, var, op, values):
        self.var = var
        self.op = op
        self.values = values


# ---------------- PARSER ----------------
class Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0

    def peek(self):
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def eat(self, t):
        token = self.peek()
        if token and token[0] == t:
            self.pos += 1
            return token[1]
        raise SyntaxError(f"Expected {t}, got {token}")

    def parse(self):
        return self.expr()

    def expr(self):
        node = self.term()
        while self.peek() and self.peek()[0] == "OR":
            self.eat("OR")
            node = BinOp(node, "or", self.term())
        return node

    def term(self):
        node = self.factor()
        while self.peek() and self.peek()[0] == "AND":
            self.eat("AND")
            node = BinOp(node, "and", self.factor())
        return node

    def factor(self):
        token = self.peek()

        if not token:
            raise SyntaxError("Unexpected end of input")

        if token[0] == "LPAREN":
            self.eat("LPAREN")
            node = self.expr()
            self.eat("RPAREN")
            return node

        return self.condition()

    def condition(self):
        var = self.eat("VAR")
        op_token = self.peek()

        if op_token[0] in ("EQ", "NEQ", "GT", "LT", "GTE", "LTE"):
            op = self.eat(op_token[0])
            value = int(self.eat("NUMBER"))
            return Condition(var, op, [value])

        if op_token[0] in ("IN", "CONTAINS"):
            op = self.eat(op_token[0])
            values = []

            while True:
                values.append(int(self.eat("NUMBER")))
                if self.peek() and self.peek()[0] == "COMMA":
                    self.eat("COMMA")
                else:
                    break

            return Condition(var, op, values)

        raise SyntaxError("Invalid condition")

def build_dependency_graph(questions):
    graph = {}

    for q in questions:
        label = q.get("label")
        deps = set()

        # routing dependencies
        routing = q.get("routing") or {}
        logic = routing.get("cond") or ""
        deps.update(re.findall(r'\b(q\d+)\b', logic))

        # piping dependencies
        pipes = extract_pipe_vars(q.get("title"))
        deps.update(pipes)

        graph[label] = list(deps)

    return graph

# ---------------- TRANSFORM ----------------
def to_decipher(node):
    if isinstance(node, BinOp):
        left = to_decipher(node.left)
        right = to_decipher(node.right)

        if not left:
            return right
        if not right:
            return left

        return f"({left} {node.op} {right})"

    if isinstance(node, Condition):
        var = node.var.lower()

        # ===============================
        # EQUALITY
        # ===============================
        if node.op in ("==", "="):
            if node.values:
                # 🔥 SPECIAL CASE FOR HV VARIABLES
                if var.startswith("hv_"):
                    return f"{var} == {node.values[0]}"
                return f"{var}.r{node.values[0]}"
            return var

        # ===============================
        # NOT EQUAL
        # ===============================
        if node.op == "!=":
            if node.values:
                if var.startswith("hv_"):
                    return f"{var} != {node.values[0]}"
                return f"not({var}.r{node.values[0]})"
            return var

        # ===============================
        # IN / CONTAINS
        # ===============================
        if node.op.lower() in ("in", "contains"):
            if node.values:
                return "(" + " or ".join(f"{var}.r{v}" for v in node.values) + ")"
            return var

        # ===============================
        # 🚨 CRITICAL FIX (DO NOT DROP)
        # ===============================
        return var  # 🔥 NEVER RETURN ""

    return ""


# ---------------- FINAL ----------------
def normalize_logic_advanced(logic):
    if not logic:
        return None

    # =====================================================
    # 🔤 NORMALIZE CASE + VARIABLES
    # =====================================================

    # Q1 → q1
    logic = re.sub(r'\bQ(\d+)\b', lambda m: f"q{m.group(1)}", logic, flags=re.I)

    # 🔥 FORCE ALL HV VARIABLES TO LOWERCASE
    logic = re.sub(r'\bhv_[a-z0-9_]+\b', lambda m: m.group(0).lower(), logic, flags=re.I)
    logic = re.sub(r'\bHV_([A-Z0-9_]+)\b', lambda m: f"hv_{m.group(1).lower()}", logic)

    # Normalize operators
    logic = logic.replace("&&", " and ")
    logic = logic.replace("||", " or ")

    # Normalize equals
    logic = re.sub(r'==', '=', logic)

    # =====================================================
    # 🔁 NORMALIZE COMPARISONS (CRITICAL)
    # =====================================================

    # q1 = 1 → q1.r1
    logic = re.sub(r'\b(q\d+)\s*=\s*(\d+)', r'\1.r\2', logic)

    # q1 != 97 → not(q1.r97)
    logic = re.sub(r'\b(q\d+)\s*!=\s*(\d+)', r'not(\1.r\2)', logic)

    # hv_bd = 1 → hv_bd.r1
    logic = re.sub(r'\b(hv_[a-z0-9_]+)\s*=\s*(\d+)', r'\1 == \2', logic)

    # hv_bd != 2 → not(hv_bd.r2)
    logic = re.sub(r'\b(hv_[a-z0-9_]+)\s*!=\s*(\d+)', r'\1 != \2', logic)

    # =====================================================
    # 🧠 PARSE USING AST (YOUR EXISTING SYSTEM)
    # =====================================================

    try:
        tokens = tokenize(logic)
        tree = Parser(tokens).parse()
        result = to_decipher(tree)
    except Exception:
        return None

    # =====================================================
    # 🧹 CLEAN EMPTY EXPRESSIONS
    # =====================================================
    result = re.sub(r'\(\s*\)', '', result)

    # =====================================================
    # 🧹 FIX DUPLICATE OPERATORS
    # =====================================================
    result = re.sub(r'\b(and|or)\s+(and|or)\b', r'\1', result, flags=re.I)

    # =====================================================
    # 🧹 REMOVE LEADING / TRAILING OPERATORS
    # =====================================================
    result = re.sub(r'^\s*(and|or)\b', '', result, flags=re.I)
    result = re.sub(r'\b(and|or)\s*$', '', result, flags=re.I)

    # =====================================================
    # 🧹 COLLAPSE SPACES
    # =====================================================
    result = re.sub(r'\s+', ' ', result).strip()

    # =====================================================
    # 🔥 REMOVE DOUBLE WRAPPING ()
    # =====================================================
    while result.startswith("(") and result.endswith(")"):
        inner = result[1:-1].strip()

        # stop if unbalanced
        if inner.count("(") != inner.count(")"):
            break

        result = inner

    # =====================================================
    # 🚨 FINAL SAFETY CHECK
    # =====================================================
    if not result or result.lower() in ["and", "or"]:
        return None
    return result

# =========================================================
# 🔥 GLOBAL CONSTANTS
# =========================================================
SPECIAL_VALUES = [97, 98, 99]


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
# 🔹 LOGIC NORMALIZATION (FINAL PRODUCTION VERSION)
# =========================================================
def normalize_logic(logic, rows=None, options=None):
    if not logic:
        return None

    if isinstance(logic, str):
        logic = logic.strip()

        # =========================
        # 🔥 BASIC NORMALIZATION
        # =========================
        logic = re.sub(r'\s+', ' ', logic)

        # =========================
        # 🔥 == → .r
        # =========================
        logic = re.sub(
            r'(\w+)\s*==\s*(\d+)',
            lambda m: f"{m.group(1)}.r{m.group(2)}",
            logic
        )

        # =========================
        # 🔥 != → not()
        # =========================
        logic = re.sub(
            r'(\w+)\s*!=\s*(\d+)',
            lambda m: f"not({m.group(1)}.r{m.group(2)})",
            logic
        )

        # =========================
        # 🔥 IN → OR
        # =========================
        logic = re.sub(
            r'(\w+)\s+in\s+([\d,]+)',
            lambda m: " or ".join([
                f"{m.group(1)}.r{x.strip()}"
                for x in m.group(2).split(",")
            ]),
            logic,
            flags=re.I
        )

        # =========================
        # 🔥 CONTAINS → OR
        # =========================
        logic = re.sub(
            r'(\w+)\s+contains\s+([\d,]+)',
            lambda m: " or ".join([
                f"{m.group(1)}.r{x.strip()}"
                for x in m.group(2).split(",")
            ]),
            logic,
            flags=re.I
        )

        # =========================
        # 🔥 AND / OR NORMALIZATION
        # =========================
        logic = re.sub(r'\bAND\b', 'and', logic, flags=re.I)
        logic = re.sub(r'\bOR\b', 'or', logic, flags=re.I)

        # =========================
        # 🔥 REMOVE UNSUPPORTED < >
        # =========================
        logic = re.sub(r'(\w+)\s*<\s*\d+', '', logic)
        logic = re.sub(r'(\w+)\s*>\s*\d+', '', logic)

        # =========================
        # 🔥 FIX DOT SPACING
        # =========================
        logic = re.sub(r'\s*\.\s*', '.', logic)

        # =========================
        # 🔥 CLEAN EMPTY BRACKETS
        # =========================
        logic = re.sub(r'\(\s*\)', '', logic)

        logic = logic.strip()

        if not logic:
            return None

        return logic

    if isinstance(logic, dict):
        return logic

    return None


# =========================================================
# 🔹 BUILD CONDITION (MAJOR UPGRADE)
# =========================================================
def build_cond(logic):
    if not logic or not isinstance(logic, (str, dict)):
        return ""

    import re

    # =====================================================
    # 🔹 STRING LOGIC
    # =====================================================
    if isinstance(logic, str):
        logic = logic.strip()

        logic = re.sub(r'\bAND\b', 'and', logic, flags=re.I)
        logic = re.sub(r'\bOR\b', 'or', logic, flags=re.I)

        logic = re.sub(r'\(\s*\)', '', logic)
        logic = re.sub(r'\(\s*(and|or)\s*\)', '', logic, flags=re.I)

        logic = re.sub(r'^\s*(and|or)\s+', '', logic, flags=re.I)
        logic = re.sub(r'\s+(and|or)\s*$', '', logic, flags=re.I)

        logic = re.sub(r'\b(and|or)\s+(and|or)\b', r'\1', logic, flags=re.I)
        logic = re.sub(r'\s+', ' ', logic).strip()

        if not logic:
            return ""

        return f' cond="{logic}"'

    # =====================================================
    # 🔹 STRUCTURED LOGIC
    # =====================================================
    if isinstance(logic, dict):
        source = logic.get("source")
        rows = logic.get("rows") or []
        cols = logic.get("columns") or []

        if not source:
            return ""

        conds = []

        if rows and cols:
            conds = [f"{source}.r{r}.c{c}" for r in rows for c in cols]
        elif rows:
            conds = [f"{source}.r{r}" for r in rows]

        if not conds:
            return ""

        return f' cond="({" or ".join(conds)})"'

    return ""


# =========================================================
# 🔹 PIPE NORMALIZATION
# =========================================================
def normalize_pipe(text):
    if not text:
        return text

    return re.sub(r'\[PIPE:\s*(.*?)\]', r'[pipe: \1]', text, flags=re.I)


# =========================================================
# 🔹 NORMALIZE
# =========================================================
def normalize(text):
    return re.sub(r'\s+', ' ', text).strip()


# =========================================================
# 🔹 SPLIT TEXT / DESC
# =========================================================
def split_text_desc(text):
    if not text:
        return "", ""

    if "|" in text:
        parts = text.split("|", 1)
        return parts[0].strip(), parts[1].strip()

    return text.strip(), ""


# =========================================================
# 🔥 FLAG DETECTION (UPGRADED HEAVILY)
# =========================================================
def detect_flags(text):
    if not text:
        return {}

    text = text.replace("’", "'")
    lower = text.lower()

    tags = re.findall(r'[\(\[\{](.*?)[\)\]\}]', lower)
    tag_text = " ".join(tags)

    # 🔥 OTHER
    is_other = (
        "other" in lower and
        any(x in lower for x in ["specify", "mention", "please"])
    )

    # 🔥 EXCLUSIVE
    is_exclusive = (
        "exclusive" in tag_text
        or "none of the above" in lower
        or "none of these" in lower
        or "all of the above" in lower
        or "don't know" in lower
        or "dont know" in lower
        or "not sure" in lower
    )

    # 🔥 TERMINATE
    is_terminate = (
        "terminate" in tag_text
        or "screen out" in lower
        or "disqualify" in lower
    )

    # 🔥 ANCHOR
    is_anchor = (
        "anchor" in tag_text
        or is_exclusive
        or is_other
    )

    return {
        "anchor": is_anchor,
        "exclusive": is_exclusive,
        "terminate": is_terminate,
        "other": is_other
    }


# =========================================================
# 🔹 PIPE EXTRACTION
# =========================================================
def extract_pipe_vars(text):
    if not text:
        return []
    return re.findall(r'\[pipe:\s*(.*?)\]', text, flags=re.I)


# =========================================================
# 🔥 SMART LIST PARSER (CRITICAL UPGRADE)
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

        line = normalize(raw_line.replace("\u00A0", " "))
        if not line:
            continue

        # 🔢 NUMBER MATCH
        num_match = re.match(r'^\s*(\d{1,3})[\.\)\-:]\s+(.*)', line)

        if num_match:
            value = int(num_match.group(1))
            raw = num_match.group(2)
        else:
            value = len(result) + 1
            raw = line

        # 🚫 SKIP DUPLICATE VALUES
        if value in seen_values:
            continue
        seen_values.add(value)

        text_part, desc_part = split_text_desc(raw)
        flags = detect_flags(text_part)

        clean = normalize_pipe(clean_text(text_part))

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
        # 🔥 HARD ENFORCE DECIPHER SPECIAL VALUES
        # =====================================================

        # 97 → Don't know
        if value == 97 or "don't know" in clean.lower() or "dont know" in clean.lower():
            item.update({
                "value": 97,
                "label": "r97",
                "text": "Don't know",
                "exclusive": True,
                "anchor": True,
                "other": False
            })

        # 98 → Other
        elif value == 98 or "other" in clean.lower():
            item.update({
                "value": 98,
                "label": "r98",
                "text": "Other",
                "exclusive": False,
                "anchor": True,
                "other": True
            })

        # 99 → None
        elif value == 99 or "none of these" in clean.lower() or "none of the above" in clean.lower():
            item.update({
                "value": 99,
                "label": "r99",
                "text": clean,
                "exclusive": True,
                "anchor": True,
                "terminate": True,   # 🔥 ADD THIS
                "other": False
            })

        result.append(item)

    # =====================================================
    # 🔥 ENSURE ORDER → NORMAL OPTIONS FIRST, SPECIAL LAST
    # =====================================================
    normal = [r for r in result if r["value"] not in [97, 98, 99]]
    special = [r for r in result if r["value"] in [97, 98, 99]]

    return normal + special


# =========================================================
# 🔹 GRID PARSER
# =========================================================
def parse_grid(rows_text, cols_text):
    rows = parse_list(rows_text)
    cols = parse_list(cols_text)

    return rows, cols


# =========================================================
# 🔹 LABEL BUILDER
# =========================================================
def build_label_from_qid(qid):
    if not qid:
        return "q1"

    text = qid.lower()
    text = re.sub(r'[^a-z0-9]+', '_', text)
    text = re.sub(r'_+', '_', text).strip('_')

    return text


# =========================================================
# 🔹 DEFAULT COMMENTS
# =========================================================
def get_default_comment(qtype):
    return {
        "radio": "Select one",
        "checkbox": "Select all that apply",
        "radio_grid": "Select one per row",
        "checkbox_grid": "Select all that apply per row",
        "textarea_single": "Be specific but avoid personal information",
        "number_single": "Enter a number",
        "ranking": "Rank the following",
    }.get(qtype, "")


# =========================================================
# 🔥 CONDITION FROM TEXT (NEW)
# =========================================================
def parse_condition_from_text(text):
    if not text:
        return None

    text = text.lower()

    # 🔥 MATCH: Logic #@ q6_seat_price != 97
    m = re.search(r'logic\s*#@\s*([\w_]+)\s*!=\s*(\d+)', text)
    if m:
        return f"not({m.group(1)}.r{m.group(2)})"

    # 🔥 MATCH: Logic #@ q6_seat_price == 1
    m = re.search(r'logic\s*#@\s*([\w_]+)\s*==\s*(\d+)', text)
    if m:
        return f"{m.group(1)}.r{m.group(2)}"

    # 🔥 MATCH: Logic #@ hv_bd == 1
    m = re.search(r'logic\s*#@\s*([\w_]+)\s*==\s*(\d+)', text)
    if m:
        return f"{m.group(1)}.r{m.group(2)}"

    return None

# =========================================================
# 🔥 MAIN PARSER (COMPLETE REWRITE)
# =========================================================
def parse_input(payload):

    # =====================================================
    # 🔹 BASIC FIELDS
    # =====================================================
    qid = (payload.get("id") or "q1").strip()
    label = build_label_from_qid(qid)

    title_raw = payload.get("title", "")
    title = normalize_pipe(normalize(title_raw))

    qtype = payload.get("type", "radio")

    # =====================================================
    # 🔥 TYPE NORMALIZATION
    # =====================================================
    TYPE_MAP = {
        "single": "radio",
        "multi": "checkbox",
        "grid_single": "radio_grid",
        "grid_multi": "checkbox_grid",
        "card_single": "card_radio",
        "card_multi": "card_checkbox",
        "text": "textarea_single",
        "textarea": "textarea_single",
        "number": "number_single",
        "float": "number_single",
        "ranking": "ranking",
        "html": "html"
    }

    qtype = TYPE_MAP.get(qtype, qtype)

    # =====================================================
    # 🔥 DETECT GRID FROM TEXT
    # =====================================================
    if payload.get("rowsText") and payload.get("columnsText"):
        if qtype not in ["radio_grid", "checkbox_grid"]:
            qtype = "checkbox_grid" if payload.get("type") == "checkbox" else "radio_grid"

    # =====================================================
    # 🔹 INIT STRUCTURES
    # =====================================================
    options, rows, columns, special_rows = [], [], [], []

    # =====================================================
    # 🔥 TYPE HANDLING
    # =====================================================
    if qtype in ["radio", "checkbox"]:
        options = parse_list(payload.get("optionsText", ""))

    elif qtype in ["radio_grid", "checkbox_grid"]:
        rows, columns = parse_grid(
            payload.get("rowsText", ""),
            payload.get("columnsText", "")
        )

    elif qtype == "number_single":

        rows = parse_list(payload.get("rowsText", "")) or [{
            "label": "r1",
            "value": 1,
            "text": "Value",
            "desc": "",
            "anchor": False,
            "exclusive": False,
            "terminate": False,
            "other": False
        }]

        # ✅ FIX: NO convert_insert_to_pipe
        options = parse_list(payload.get("optionsText", ""))

        # ensure special options
        logic_text = payload.get("logic") or ""

        if not any(o["value"] == 97 for o in options):
            options.append({
                "label": "r97",
                "value": 97,
                "text": "Don't know",
                "anchor": True,
                "exclusive": True,
                "other": False
            })

        if "98" in logic_text and not any(o["value"] == 98 for o in options):
            options.append({
                "label": "r98",
                "value": 98,
                "text": "Other",
                "anchor": True,
                "exclusive": False,
                "other": True
            })

        if "99" in logic_text and not any(o["value"] == 99 for o in options):
            options.append({
                "label": "r99",
                "value": 99,
                "text": "None of these",
                "anchor": True,
                "exclusive": True,
                "other": False
            })

    elif qtype in ["number_multi", "float_multi", "autosum"]:
        rows = parse_list(payload.get("rowsText", "")) or [{
            "label": "r1",
            "value": 1,
            "text": "Value",
            "desc": "",
            "anchor": False,
            "exclusive": False,
            "terminate": False,
            "other": False
        }]

    elif qtype in ["textarea_single"]:
        rows = [{"label": "r1", "value": 1, "text": "", "desc": ""}]

        options = parse_list(payload.get("optionsText", ""))

    elif qtype in ["textarea_multi", "text_multi"]:
        rows = parse_list(payload.get("rowsText", "")) or [{
            "label": "r1",
            "value": 1,
            "text": "",
            "desc": ""
        }]

    elif qtype == "ranking":
        rows = parse_list(payload.get("optionsText", ""))

    # =====================================================
    # 🔥 AUTO TYPE CORRECTION
    # =====================================================
    if qtype == "number_multi" and len(rows) == 1:
        qtype = "number_single"

    if qtype == "textarea_multi" and len(rows) == 1:
        qtype = "textarea_single"

    # =====================================================
    # 🔹 CONFIG
    # =====================================================
    cfg = payload.get("config") or {}

    config = {
        "optional": payload.get("optional", 0),
        "atleast": cfg.get("atleast"),
        "atmost": cfg.get("atmost"),
        "exact": cfg.get("exact"),
        "amount": cfg.get("amount"),
        "tolerance": cfg.get("tolerance")
    }

    # =====================================================
    # 🔥 RANDOMIZE
    # =====================================================
    randomize_cfg = payload.get("randomize") or {}

    randomize = {
        "enabled": randomize_cfg.get("enabled", False),
        "rows": randomize_cfg.get("rows", False),
        "cols": randomize_cfg.get("cols", False)
    }

    # =====================================================
    # 🔥 ROUTING (FINAL SYSTEM)
    # =====================================================
    raw_logic = payload.get("logic")

    # 🔥 AUTO EXTRACT FROM TITLE (CRITICAL)
    if not raw_logic:
        raw_logic = parse_condition_from_text(payload.get("title"))

    if not raw_logic:
        auto_logic = parse_condition_from_text(title)
        if auto_logic:
            raw_logic = auto_logic

    routing = {
        "cond": raw_logic,
        "goto": {
            "target": payload.get("target"),
            "cond": raw_logic if payload.get("target") else None
        },
        "term": {
            "text": payload.get("terminate"),
            "cond": raw_logic if payload.get("terminate") else None
        },
        "block_cond": payload.get("block", {}).get("cond") if payload.get("block") else None
    }

    # =====================================================
    # 🔁 LOOP
    # =====================================================
    loop = payload.get("loop") or {}
    loop_data = None

    if loop.get("source"):
        loop_data = {
            "source": build_label_from_qid(loop.get("source")),
            "mode": loop.get("mode") or "selected"
        }

    # =============================
    # 🔗 LOGIC
    # =============================
    logic = payload.get("logic")

    # 🔥 FIX spacing again (safety)
    if isinstance(logic, str):
        logic = re.sub(r'\s*\.\s*', '.', logic)

    # =============================
    # 🔥 ROUTING SYNC FIX (CRITICAL)
    # =============================
    routing = payload.get("routing") or {}

    if logic:
        routing["cond"] = logic

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

        # ❌ REMOVE OLD cond
        # "cond": cond,

        "routing": routing,

        "target": payload.get("target"),
        "terminate": payload.get("terminate"),
        "defaultTarget": payload.get("defaultTarget"),

        "loop": payload.get("loop"),

        "raw": payload
    }

    return [question]

# =========================================================
# 🔹 CONDITION GENERATOR
# =========================================================
def gen_cond(q):
    routing = q.get("routing") or {}
    cond = routing.get("cond")

    if cond:
        return f' cond="{cond}"'

    return ""


# =========================================================
# 🔥 ROW BUILDER (DECHIPER EXACT)
# =========================================================
def gen_rows(rows, questions=None, source_text=None):
    out = ""


    for r in rows:
        attrs = [f'label="{r["label"]}"']

        if "value" in r:
            attrs.append(f'value="{r["value"]}"')

        if r.get("exclusive"):
            attrs.append('exclusive="1"')

        if r.get("anchor"):
            attrs.append('randomize="0"')

        if r.get("other"):
            attrs.append('open="1" openSize="25"')

        out += f'<row {" ".join(attrs)}>{r["text"]}</row>\n'

    return out


# =========================================================
# 🔹 COLUMN BUILDER
# =========================================================
def gen_cols(cols):
    out = ""

    for i, c in enumerate(cols, start=1):
        attrs = [f'label="c{i}"']

        if "value" in c:
            attrs.append(f'value="{c["value"]}"')

        if c.get("exclusive") and c.get("value") in SPECIAL_VALUES:
            attrs.append('exclusive="1"')

        out += f'<col {" ".join(attrs)}>{c["text"]}</col>\n'

    return out


# =========================================================
# 🔥 LOOP WRAPPER
# =========================================================
def wrap_loop(q, inner_xml):
    loop = q.get("loop")

    if not loop:
        return inner_xml

    source = loop.get("source")
    mode = loop.get("mode") or "selected"

    return f'''
<loop source="{source}" mode="{mode}">
{inner_xml}
</loop>
'''

# =========================================================
# 🔥 TERM BUILDER (FULL FIX)
# =========================================================
def gen_term(q):
    routing = q.get("routing") or {}
    term_data = routing.get("term")

    if not term_data or not term_data.get("text"):
        return ""

    label = f"{q['label']}_term"
    text = term_data.get("text")

    cond = build_cond(term_data.get("cond"))

    return f'<term label="{label}"{cond}>{text}</term>\n\n<suspend/>\n\n'

# =========================================================
# 🔥 GOTO BUILDER (FULL FIX)
# =========================================================
def gen_goto(q):
    routing = q.get("routing") or {}
    goto_data = routing.get("goto")

    if not goto_data or not goto_data.get("target"):
        return ""

    cond = build_cond(goto_data.get("cond"))
    target = build_label_from_qid(goto_data.get("target"))

    return f'<goto{cond} target="{target}"/>\n\n<suspend/>\n\n'


def gen_default_goto(q):
    if not q.get("defaultTarget") or q.get("target"):
        return ""

    target = build_label_from_qid(q.get("defaultTarget"))  # 🔥 FIX

    return f'<goto cond="(1)" target="{target}"/>\n\n<suspend/>\n\n'


# =========================================================
# 🔥 BLOCK BUILDER (NEW)
# =========================================================
def open_block(q):
    block = q.get("raw", {}).get("block")

    if not block:
        return ""

    label = block.get("label") or f"b_{q['label']}"
    cond = build_cond(block.get("cond"))

    title = block.get("title", "")

    return f'<block label="{label}"{cond} builder:title="{title}">\n'


def close_block(q):
    block = q.get("raw", {}).get("block")

    if not block:
        return ""

    return '</block>\n\n<suspend/>\n\n'

def build_hidden_exec_variables(questions):
    exec_blocks = []
    hv_map = {}

    # ============================================
    # 🔍 FIND HV VARIABLES
    # ============================================
    for q in questions:
        routing = q.get("routing") or {}
        logic = (routing.get("cond") or "").lower()

        for hv in re.findall(r'(hv_\w+)', logic):
            hv_map.setdefault(hv, None)

    # ============================================
    # 🔍 FIND SOURCE QUESTION
    # ============================================
    for hv in hv_map:
        key = hv.replace("hv_", "")

        for q in questions:
            label = q.get("label", "")

            if key in label:
                hv_map[hv] = label
                break

    # ============================================
    # 🔥 BUILD EXEC WITH SOURCE TAG
    # ============================================
    for hv, source_q in hv_map.items():
        if not source_q:
            continue

        exec_blocks.append({
            "source": source_q,
            "xml": f"""
<exec>
if {source_q}.r1:
    {hv}.val = 1
else:
    {hv}.val = 2
</exec>
"""
        })

    return exec_blocks

# =========================================================
# 🔥 EXEC BUILDER (NEW)
# =========================================================
def gen_exec(q):
    exec_code = q.get("raw", {}).get("exec")

    if not exec_code:
        return ""

    return f'<exec>\n{exec_code}\n</exec>\n'


# =========================================================
# 🔥 AUTOFILL ENGINE (FULL REWRITE)
# =========================================================
def build_autofill_blocks(questions):
    """
    Builds FULL decipher-compatible autofill blocks
    """
    autofill_blocks = {}
    mapping = {}

    for q in questions:
        title = q.get("title") or ""
        pipe_vars = extract_pipe_vars(title)

        for var in pipe_vars:

            var_norm = build_label_from_qid(var)

            source_q = next(
                (qq for qq in questions if qq["label"] == var_norm),
                None
            )

            if not source_q:
                continue

            auto_label = f"{var_norm}_autofill"
            mapping[var_norm] = auto_label

            if auto_label in autofill_blocks:
                continue

            rows_xml = ""

            source_rows = source_q.get("options") or source_q.get("rows") or []

            for r in source_rows:
                rows_xml += (
                    f'  <row label="{r["label"]}" '
                    f'autofill="{var_norm}.{r["label"]}">'
                    f'{r["text"]}</row>\n'
                )

            # 🔥 ADD NONE ROW (CRITICAL)
            rows_xml += (
                f'  <row label="none" '
                f'autofill="0" '
                f'builder:none="1"><i>None of These Classifications Apply</i></row>\n'
            )

            block = (
                f'<autofill label="{auto_label}" where="execute,survey,report">\n'
                f'<title>{auto_label}</title>\n'
                f'{rows_xml}</autofill>\n\n<suspend/>\n\n'
            )

            autofill_blocks[auto_label] = block

    return autofill_blocks, mapping


# =========================================================
# 🔥 APPLY PIPE FIX
# =========================================================
def apply_autofill_mapping(q, mapping):
    title = q.get("title") or ""

    for original, replacement in mapping.items():
        # 🔥 REPLACE PIPE WITH AUTOFILL VARIABLE
        title = re.sub(
            rf'\[pipe:\s*{original}\]',
            f'{{{replacement}}}',
            title,
            flags=re.I
        )

    q["title"] = title.strip()
    return q


# =========================================================
# 🔥 SUSPEND ENGINE (CRITICAL FIX)
# =========================================================
def add_suspend(xml):
    xml = xml.strip()

    if not xml:
        return ""

    if xml.endswith("<suspend/>"):
        return xml + "\n"

    return xml + "\n\n<suspend/>\n\n"


# =========================================================
# 🔥 QUESTION BUILDERS (UPGRADED)
# =========================================================
def gen_radio(q, questions):
    cond = gen_cond(q)

    insert_block = gen_insert(q.get("raw", {}).get("optionsText"))

    if insert_block:
        rows = insert_block
    else:
        rows = gen_rows(q["options"], questions)

    attrs = []

    if q.get("randomize", {}).get("enabled"):
        attrs.append('shuffle="rows"')

    attr_str = " " + " ".join(attrs)

    return f'''
<radio label="{q["label"]}"{cond}{attr_str}>
<title>{q["title"]}</title>
<comment>{q.get("comment") or ""}</comment>
{rows}</radio>
'''


def gen_checkbox(q, questions):
    cond = gen_cond(q)

    insert_block = gen_insert(q.get("raw", {}).get("optionsText"))

    if insert_block:
        rows = insert_block
    else:
        rows = gen_rows(q["options"], questions)

    atleast = q.get("config", {}).get("atleast") or 1

    attrs = [f'atleast="{atleast}"']

    if q.get("randomize", {}).get("enabled"):
        attrs.append('shuffle="rows"')

    attr_str = " " + " ".join(attrs)

    return f'''
<checkbox label="{q["label"]}"{cond}{attr_str}>
<title>{q["title"]}</title>
<comment>{q.get("comment") or ""}</comment>
{rows}</checkbox>
'''


def gen_grid(q, questions):
    cond = gen_cond(q)

    rows = gen_rows(q["rows"], questions, q.get("title"))
    cols = gen_cols(q["columns"])

    # 🔥 CORRECT DECIpher GRID FORMAT
    if q["type"] == "radio_grid":
        tag = "radio"
    else:
        tag = "checkbox"

    attrs = []

    # 🔥 IMPORTANT: DO NOT use builderHint
    if q.get("randomize", {}).get("rows"):
        attrs.append('shuffle="rows"')

    attr_str = (" " + " ".join(attrs)) if attrs else ""

    return f'''
<{tag} label="{q["label"]}" type="grid"{cond}{attr_str}>
<title>{q["title"]}</title>
<comment>{q.get("comment") or ""}</comment>
{cols}
{rows}</{tag}>
'''

def gen_number(q, questions):
    cond = gen_cond(q)

    insert_block = gen_insert(q.get("raw", {}).get("optionsText"))

    # 🔥 ONLY ONE SOURCE OF ROWS
    if insert_block:
        rows = insert_block
    else:
        rows = gen_rows(q.get("rows", []), questions, q.get("title"))

    return f'''
<number label="{q["label"]}"{cond}>
<title>{q["title"]}</title>
<comment>{q.get("comment") or ""}</comment>
{rows}
</number>
'''

def gen_textarea(q):
    cond = gen_cond(q)

    rows = q.get("rows") or [{"label": "r1", "value": 1, "text": ""}]

    rows_xml = ""
    for r in rows:
        rows_xml += f'<row label="{r["label"]}" value="{r.get("value",1)}"></row>\n'

    return f'''
<textarea label="{q["label"]}"{cond}>
<title>{q["title"]}</title>
<comment>{q.get("comment") or ""}</comment>
{rows_xml}</textarea>
'''

def map_logic_to_real_labels(logic, question, questions):
    if not logic or not isinstance(logic, str):
        return logic

    import re

    # =====================================================
    # 🔹 BUILD LABEL MAP (q1 → actual label)
    # =====================================================
    label_map = {}

    for q in questions:
        if not isinstance(q, dict):
            continue

        lbl = q.get("label")
        if not lbl:
            continue

        match = re.match(r'q(\d+)', lbl)
        if match:
            label_map[f"q{match.group(1)}"] = lbl

        # 🔥 ADD THIS (VERY IMPORTANT)
        label_map[lbl] = lbl

    # =====================================================
    # 🔹 STEP 1: REPLACE q1 → actual label
    # =====================================================
    def replace_var(match):
        var = match.group(1)
        return label_map.get(var, var)

    logic = re.sub(r'\b(q\d+[a-z0-9_]*)\b', replace_var, logic)

    # =====================================================
    # 🔹 STEP 2: MAP .r VALUES TO ACTUAL ROW LABELS
    # =====================================================
    def replace_row(match):
        q_label = match.group(1)
        val = int(match.group(2))

        source_q = next(
            (qq for qq in questions if isinstance(qq, dict) and qq.get("label") == q_label),
            None
        )

        if not source_q:
            print(f"⚠️ Missing mapping for {q_label}.r{val}")
            return f"{q_label}"  # safe fallback (not empty)

        # 🔹 OPTIONS
        for opt in (source_q.get("options") or []):
            if not isinstance(opt, dict):
                continue

            if opt.get("value") == val:
                return f"{q_label}.{opt.get('label')}"

        # 🔹 ROWS (GRID)
        for r in (source_q.get("rows") or []):
            if not isinstance(r, dict):
                continue

            if r.get("value") == val:
                return f"{q_label}.{r.get('label')}"

        # 🔥 IMPORTANT: DO NOT RETURN EMPTY
        return match.group(0)

    logic = re.sub(r'(\w+)\.r(\d+)', replace_row, logic)

    return logic

def gen_card(q, questions):
    cond = gen_cond(q)

    rows = gen_rows(q["rows"], questions, q.get("title"))
    cols = gen_cols(q["columns"])

    if q["type"] == "card_radio":
        tag = "radio"
    else:
        tag = "checkbox"

    attrs = ['builderHint="card"']

    if q.get("randomize", {}).get("rows"):
        attrs.append('shuffle="rows"')

    if q.get("randomize", {}).get("cols"):
        attrs.append('shuffle="cols"')

    attr_str = " " + " ".join(attrs)

    return f'''
<{tag} label="{q["label"]}"{cond}{attr_str}>
<title>{q["title"]}</title>
<comment>{q.get("comment") or ""}</comment>
{cols}
{rows}</{tag}>
'''

def gen_autosum(q):
    cond = gen_cond(q)
    rows = gen_rows(q["rows"])

    total = q.get("config", {}).get("amount") or 100

    return f'''
<number label="{q["label"]}"{cond} sum="rows">
<title>{q["title"]}</title>
<comment>{q.get("comment") or ""}</comment>
{rows}
<validate>Total == {total}</validate>
</number>
'''

def gen_textarea_multi(q, questions):
    cond = gen_cond(q)

    rows = gen_rows(q["rows"], questions, q.get("title"))

    return f'''
<textarea label="{q["label"]}"{cond}>
<title>{q["title"]}</title>
<comment>{q.get("comment") or ""}</comment>
{rows}</textarea>
'''

def gen_ranking(q):
    rows = gen_rows(q["rows"])

    return f'''
<rank label="{q["label"]}">
<title>{q["title"]}</title>
<comment>{q.get("comment") or ""}</comment>
{rows}</rank>
'''

# =========================================================
# 🔥 MAIN XML GENERATOR (COMPLETE REWRITE)
# =========================================================
def generate_xml(questions):

    # =====================================================
    # 🔥 GLOBAL FOR INSERT MAPPING
    # =====================================================
    global questions_global
    questions_global = questions or []

    # =====================================================
    # 🔥 SANITIZE INPUT
    # =====================================================
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue

        q["options"] = q.get("options") if isinstance(q.get("options"), list) else []
        q["rows"] = q.get("rows") if isinstance(q.get("rows"), list) else []
        q["columns"] = q.get("columns") if isinstance(q.get("columns"), list) else []

        q["options"] = [o for o in q["options"] if isinstance(o, dict)]
        q["rows"] = [r for r in q["rows"] if isinstance(r, dict)]
        q["columns"] = [c for c in q["columns"] if isinstance(c, dict)]

    questions = [q for q in questions if isinstance(q, dict)]
    output = ""

    # =====================================================
    # 🔥 AUTOFILL
    # =====================================================
    autofill_blocks, autofill_map = build_autofill_blocks(questions)

    for i, q in enumerate(questions):
        questions[i] = apply_autofill_mapping(q, autofill_map)

    inserted_autofills = set()

    # =====================================================
    # 🔥 PREPARE EXEC (STRUCTURED)
    # =====================================================
    hidden_execs = build_hidden_exec_variables(questions) or []

    # =====================================================
    # 🔥 MAIN LOOP
    # =====================================================
    for q in questions:

        if not isinstance(q, dict):
            continue

        # =================================================
        # 🔥 ROUTING NORMALIZATION
        # =================================================
        routing = q.get("routing") or {}
        raw_logic = routing.get("cond")

        # 🔥 AUTO APPLY HV CONDITION (BLOCK-LIMITED FIX)
        if not raw_logic:
            for exec_block in hidden_execs:
                hv_match = re.search(r'(hv_\w+)', exec_block.get("xml", ""))
                if not hv_match:
                    continue

                hv = hv_match.group(1)

                # 🔥 DEFINE BLOCK RANGE (ONLY HERE)
                hv_block_ranges = {
                    "hv_bd": ("q10_bd_pain", "q13_communication_oe")
                }

                if hv not in hv_block_ranges:
                    continue

                start_label, end_label = hv_block_ranges[hv]

                # find indexes
                start_idx = next((i for i, x in enumerate(questions) if x.get("label") == start_label), -1)
                end_idx = next((i for i, x in enumerate(questions) if x.get("label") == end_label), -1)
                curr_idx = next((i for i, x in enumerate(questions) if x.get("label") == q.get("label")), -1)

                # apply ONLY inside block
                if start_idx != -1 and end_idx != -1 and start_idx <= curr_idx <= end_idx:
                    q["routing"]["cond"] = f"{hv} == 1"
                    raw_logic = q["routing"]["cond"]
                    break

        # 🚨 REMOVE HV LOGIC FROM ITS SOURCE QUESTION (CRITICAL FIX)
        if raw_logic and isinstance(raw_logic, str):
            hv_vars = re.findall(r'(hv_\w+)', raw_logic.lower())

            for hv in hv_vars:
                key = hv.replace("hv_", "")
                if key in q.get("label", ""):
                    raw_logic = None
                    q["routing"]["cond"] = None
                    break

        if raw_logic and isinstance(raw_logic, str):

            raw_logic = re.sub(r'^\s*(AND|OR)\b', '', raw_logic, flags=re.I)
            raw_logic = re.sub(r'\(\s*(AND|OR)\s+', '(', raw_logic, flags=re.I)
            raw_logic = re.sub(r'\(\s*\)', '', raw_logic)
            raw_logic = re.sub(r'\s+', ' ', raw_logic).strip()

            logic = None

            try:
                logic = normalize_logic_advanced(raw_logic)
            except Exception:
                pass

            if logic and isinstance(logic, str) and logic.strip():
                logic = map_logic_to_real_labels(logic, q, questions)
                q["routing"]["cond"] = logic
            else:
                q["routing"]["cond"] = None

        # =================================================
        # 🔥 BUILD QUESTION XML
        # =================================================
        qtype = q.get("type")

        block_open = open_block(q)
        block_close = close_block(q)

        xml = ""

        if qtype == "html":
            xml = f'<html label="{q.get("id")}" where="survey">{q.get("title","")}</html>'

        elif qtype == "radio":
            xml = gen_radio(q, questions)

        elif qtype == "checkbox":
            xml = gen_checkbox(q, questions)

        elif qtype in ["radio_grid", "checkbox_grid"]:
            xml = gen_grid(q, questions)

        elif qtype in ["card_radio", "card_checkbox"]:
            xml = gen_card(q, questions)

        elif qtype in ["number_single", "number_multi", "float_multi"]:
            xml = gen_number(q, questions)

        elif qtype == "autosum":
            xml = gen_autosum(q)

        elif qtype in ["textarea_single", "text_single"]:
            xml = gen_textarea(q)

        elif qtype in ["textarea_multi", "text_multi"]:
            xml = gen_textarea_multi(q, questions)

        elif qtype == "ranking":
            xml = gen_ranking(q)

        # =================================================
        # 🔁 LOOP WRAP
        # =================================================
        xml = wrap_loop(q, xml)

        if block_open:
            output += block_open

        if isinstance(xml, str) and xml.strip():
            output += add_suspend(xml)

        # =================================================
        # 🔥 INSERT EXEC AFTER SOURCE QUESTION (FINAL FIX)
        # =================================================
        for exec_block in hidden_execs:
            if exec_block.get("source") == q.get("label"):
                output += exec_block.get("xml", "").strip() + "\n\n<suspend/>\n\n"

        # =================================================
        # 🔥 AUTOFILL INSERT
        # =================================================
        q_label = q.get("label")
        auto_label = autofill_map.get(q_label)

        if auto_label and auto_label not in inserted_autofills:
            block = autofill_blocks.get(auto_label)
            if block:
                output += block
                inserted_autofills.add(auto_label)

        # =================================================
        # 🔥 AUTO TERMINATE
        # =================================================
        routing = q.get("routing") or {}
        term_data = routing.get("term") or {}

        if not term_data.get("text"):
            for r in (q.get("options") or []) + (q.get("rows") or []):
                if isinstance(r, dict) and r.get("terminate"):
                    q["routing"]["term"] = {
                        "text": "Screened out",
                        "cond": routing.get("cond")
                    }
                    break

        # =================================================
        # 🔥 TERM / GOTO
        # =================================================
        output += gen_term(q) or ""
        output += gen_goto(q) or ""
        output += gen_default_goto(q) or ""

        if block_close:
            output += block_close

    # =====================================================
    # 🔥 FINAL CLEAN
    # =====================================================
    output = re.sub(r'\n{3,}', '\n\n', output)

    if not output.strip().endswith("<suspend/>"):
        output += "\n<suspend/>\n"

    return output
# =========================================================
# 🔥 DEBUG TOOL (VERY USEFUL)
# =========================================================
def debug_print_questions(questions):
    for q in questions:
        print("====================================")
        print("LABEL:", q["label"])
        print("TYPE:", q["type"])
        print("COND:", q.get("routing", {}).get("cond"))
        print("OPTIONS:", len(q.get("options", [])))
        print("ROWS:", len(q.get("rows", [])))
        print("COLS:", len(q.get("columns", [])))
        print("====================================\n")


# =========================================================
# 🔥 VALIDATION TOOL (BASIC)
# =========================================================
def validate_xml(xml):
    errors = []

    if "<radio" in xml and "</radio>" not in xml:
        errors.append("Missing </radio>")

    if "<checkbox" in xml and "</checkbox>" not in xml:
        errors.append("Missing </checkbox>")

    if "<term" in xml and "</term>" not in xml:
        errors.append("Missing </term>")

    if "<block" in xml and "</block>" not in xml:
        errors.append("Missing </block>")

    return errors
