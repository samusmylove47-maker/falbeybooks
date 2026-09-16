"""Read-only, stdlib checks of native Mailchimp forms against the recovered embed.

Run from any directory with Python 3.9+. This reads generated files only, never
opens a network connection, submits an address, or sends email. The default root
is this repository's public directory. Use --root to override.
"""
from argparse import ArgumentParser
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import json
import re


HERE = Path(__file__).resolve().parent
REPOSITORY = HERE.parent
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class Document(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.text = path.read_text(encoding="utf-8")
        self.stack = []
        self.forms = []
        self.form = None
        self.elements = []
        self.feed(self.text)

    def handle_starttag(self, tag, attrs):
        element = {"tag": tag, "attrs": dict(attrs), "line": self.getpos()[0], "ancestors": self.stack.copy()}
        self.elements.append(element)
        if tag == "form":
            self.form = {"attrs": element["attrs"], "line": element["line"], "controls": []}
            self.forms.append(self.form)
        elif self.form is not None and tag in {"input", "button", "textarea", "select"}:
            self.form["controls"].append(element)
        if tag not in VOID:
            self.stack.append((tag, element["attrs"]))

    def handle_endtag(self, tag):
        if tag == "form":
            self.form = None
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)


def named(form, name):
    return [element for element in form["controls"] if element["attrs"].get("name") == name]


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--root", action="append", type=Path)
    parser.add_argument("--report", type=Path, default=REPOSITORY / ".build/newsletter-verification.json")
    args = parser.parse_args()
    roots = args.root or [REPOSITORY / "public"]
    recovered = Document(REPOSITORY / "docs/original-mailchimp-embed.html")
    if len(recovered.forms) != 1:
        raise SystemExit("Recovered evidence must contain exactly one form.")
    original = recovered.forms[0]
    expected_action = original["attrs"]["action"]
    original_honeypots = [item["attrs"]["name"] for item in original["controls"] if item["attrs"].get("name", "").startswith("b_")]
    if len(original_honeypots) != 1:
        raise SystemExit("Recovered evidence must contain exactly one Mailchimp honeypot.")
    expected_honeypot = original_honeypots[0]
    checks = []

    def check(scope, name, passed, detail=None):
        item = {"scope": scope, "check": name, "passed": bool(passed)}
        if detail is not None:
            item["detail"] = detail
        checks.append(item)

    check("evidence", "Endpoint is the author's HTTPS Mailchimp subscribe endpoint", urlsplit(expected_action).scheme == "https" and urlsplit(expected_action).netloc == "johnwaynefalbey.us8.list-manage.com" and urlsplit(expected_action).path == "/subscribe/post")
    check("evidence", "EMAIL is required and FNAME optional in recovered embed", len(named(original, "EMAIL")) == 1 and "required" in named(original, "EMAIL")[0]["attrs"] and len(named(original, "FNAME")) == 1 and "required" not in named(original, "FNAME")[0]["attrs"])

    for root in roots:
        root = root.resolve()
        scope = str(root)
        if not root.is_dir():
            check(scope, "Generated directory exists", False)
            continue
        documents = {str(path.relative_to(root)).replace("\\", "/"): Document(path) for path in root.rglob("*.html")}
        signup_locations = []
        for relative, document in documents.items():
            for form in document.forms:
                if "list-manage.com" in form["attrs"].get("action", ""):
                    signup_locations.append(relative)
        check(scope, "Exactly the homepage and newsletter page have Mailchimp forms", sorted(signup_locations) == ["index.html", "newsletter/index.html"], signup_locations)

        for relative in ("index.html", "newsletter/index.html"):
            page_scope = scope + "/" + relative
            document = documents.get(relative)
            check(page_scope, "Page exists", document is not None)
            if document is None:
                continue
            check(page_scope, "Exactly one signup form", len(document.forms) == 1)
            if len(document.forms) != 1:
                continue
            form = document.forms[0]
            attributes = form["attrs"]
            check(page_scope, "Action exactly matches recovered embed", attributes.get("action") == expected_action)
            check(page_scope, "Native POST with browser validation", attributes.get("method", "").lower() == "post" and "novalidate" not in attributes)
            check(page_scope, "Local JSON submit handler does not intercept signup", "data-form" not in attributes and "data-msg" not in attributes and "onsubmit" not in attributes)
            check(page_scope, "Mailchimp opens a separate page without opener access", attributes.get("target") == "_blank" and "noopener" in attributes.get("rel", "").split())
            emails = named(form, "EMAIL")
            check(page_scope, "Exactly one required EMAIL with native email validation", len(emails) == 1 and emails[0]["attrs"].get("type", "").lower() == "email" and "required" in emails[0]["attrs"] and "disabled" not in emails[0]["attrs"] and emails[0]["attrs"].get("value", "") == "")
            first_names = named(form, "FNAME")
            check(page_scope, "FNAME remains optional; full newsletter form provides it", len(first_names) == (1 if relative == "newsletter/index.html" else 0) and all("required" not in element["attrs"] for element in first_names))
            honeypots = named(form, expected_honeypot)
            check(page_scope, "Exact recovered honeypot submitted blank and outside tab order", len(honeypots) == 1 and honeypots[0]["attrs"].get("value", "") == "" and honeypots[0]["attrs"].get("tabindex") == "-1" and "disabled" not in honeypots[0]["attrs"])
            hidden_hp = bool(honeypots) and any(a.get("aria-hidden") == "true" and ("hp" in a.get("class", "").split() or "-5000px" in a.get("style", "")) for _, a in honeypots[0]["ancestors"])
            check(page_scope, "Honeypot is visually hidden and hidden from accessibility tree", hidden_hp)
            subscribers = named(form, "subscribe")
            check(page_scope, "Subscribe submit control preserves recovered field name", len(subscribers) == 1 and subscribers[0]["attrs"].get("type", "").lower() == "submit" and "disabled" not in subscribers[0]["attrs"])
            check(page_scope, "No control overrides native endpoint, target, method or validation", not any(set(element["attrs"]) & {"formaction", "formtarget", "formmethod", "formnovalidate"} for element in form["controls"]))
            allowed = {"EMAIL", "FNAME", expected_honeypot, "subscribe"}
            check(page_scope, "No obsolete local-handler fields or unverified subscription fields", all(element["attrs"].get("name") in allowed for element in form["controls"] if "name" in element["attrs"]))
            ids = [element["attrs"]["id"] for element in document.elements if "id" in element["attrs"]]
            check(page_scope, "Unique element IDs", all(count == 1 for count in Counter(ids).values()))
            labels = {element["attrs"].get("for") for element in document.elements if element["tag"] == "label"}
            visible_inputs = emails + first_names
            check(page_scope, "Visible fields have accessible names", all(element["attrs"].get("aria-label") or element["attrs"].get("id") in labels for element in visible_inputs))
            check(page_scope, "Manual author-confirmation copy removed", not any(old in document.text for old in ("enrollment is confirmed by the author", "the author will confirm your subscription", "The author will confirm your subscription", "Subscription requests are confirmed by the author", "does not automatically enroll you")))

        contact = documents.get("contact/index.html")
        check(scope, "Contact page retains one local form", contact is not None and len(contact.forms) == 1)
        if contact and len(contact.forms) == 1:
            form = contact.forms[0]
            attributes = form["attrs"]
            check(scope, "Contact retains local POST/JSON handler and status region", attributes.get("action") == "/form-handler.php" and attributes.get("method", "").lower() == "post" and "data-form" in attributes and attributes.get("data-msg") in {element["attrs"].get("id") for element in contact.elements})
            kinds = named(form, "form-name")
            check(scope, "Contact kind and required message preserved", len(kinds) == 1 and kinds[0]["attrs"].get("value") == "contact" and len(named(form, "message")) == 1 and "required" in named(form, "message")[0]["attrs"])
        script_path = root / "assets/site.js"
        script = script_path.read_text(encoding="utf-8") if script_path.is_file() else ""
        check(scope, "Shared JavaScript still scopes local JSON handling to data-form", bool(re.search(r"querySelectorAll\(\s*['\"]form\[data-form\]['\"]\s*\)", script)) and "fetch(form.action" in script and "response.json()" in script)
        php_path = root / "form-handler.php"
        php = php_path.read_text(encoding="utf-8") if php_path.is_file() else ""
        check(scope, "Contact transport remains disabled unless explicitly configured", "getenv('FALBEY_FORM_TRANSPORT') ?: 'disabled'" in php)

    report = {
        "checked_utc": datetime.now(timezone.utc).isoformat(),
        "scope": "Local generated HTML/native form contracts compared with the recovered public embed. No network requests, form submissions or emails; real enrollment and audience confirmation settings are not tested.",
        "checks": checks,
        "total": len(checks),
        "passed": sum(item["passed"] for item in checks),
        "failed": sum(not item["passed"] for item in checks),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("total", "passed", "failed")}))
    for item in checks:
        if not item["passed"]:
            print("FAIL", item["scope"], item["check"])
    print("Report:", args.report.resolve())
    return bool(report["failed"])


if __name__ == "__main__":
    raise SystemExit(main())
