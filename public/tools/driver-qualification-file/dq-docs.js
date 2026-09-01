/* =============================================================================
   dq-docs.js — Driver Qualification File packet generator
   Builds a multi-document PDF entirely in the browser. No data leaves the page.

   Requires pdf-lib (window.PDFLib). Exposes window.DQ.buildPacket(data).

   Regulatory basis, current as of August 2026:
     49 CFR 391.21  application for employment
     49 CFR 391.23  investigations and inquiries (incl. 391.23(m) medical)
     49 CFR 391.25  annual inquiry and review of driving record
     49 CFR 391.31  road test          391.33  equivalent of road test
     49 CFR 391.51  driver qualification files
     49 CFR 391.53  driver investigation history file
     49 CFR 382.601 educational materials    382.701 Clearinghouse queries
   Note: 49 CFR 391.27 (annual list of violations) was REMOVED effective
   May 9, 2022 (87 FR 13192) and is deliberately not generated here.
   ========================================================================== */
(function (global) {
"use strict";

var PT = { LETTER: [612, 792] };
var M = { left: 54, right: 54, top: 54, bottom: 62 };
var INK = null, GREY = null, RULE = null, LIGHT = null;

/* ---------------------------------------------------------------- layout -- */

function Doc(pdf, fonts) {
  this.pdf = pdf;
  this.f = fonts;
  this.page = null;
  this.y = 0;
  this.footerText = "";
  this.docTitle = "";
}

Doc.prototype.addPage = function (label) {
  if (label != null) this.footerText = label;
  this.page = this.pdf.addPage(PT.LETTER);
  this.y = PT.LETTER[1] - M.top;
  this._footer();
  return this.page;
};

Doc.prototype.width = function () { return PT.LETTER[0] - M.left - M.right; };

Doc.prototype.need = function (h) {
  if (this.y - h < M.bottom) this.addPage();
};

Doc.prototype._footer = function () {
  var p = this.page, self = this;
  var y = M.bottom - 24;
  p.drawLine({
    start: { x: M.left, y: y + 26 }, end: { x: PT.LETTER[0] - M.right, y: y + 26 },
    thickness: 0.5, color: LIGHT
  });
  var left = safe(this.footerText);
  var right = "We Heart Paperwork · weheartpaperwork.com";
  p.drawText(left, { x: M.left, y: y + 14, size: 6.5, font: self.f.reg, color: GREY });
  p.drawText(right, {
    x: PT.LETTER[0] - M.right - self.f.reg.widthOfTextAtSize(right, 6.5),
    y: y + 14, size: 6.5, font: self.f.reg, color: GREY
  });
};

/* pdf-lib's StandardFonts are WinAnsi-encoded and throw on anything outside that
   range. Every string that reaches drawText passes through here first; check
   boxes are drawn as rectangles rather than typed as glyphs. */
var WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ" +
                    "‘’“”•–—˜™š›œžŸ";
function safe(str) {
  var s = String(str == null ? "" : str)
    .replace(/[☐☑☒□■✓✔]/g, "")
    .replace(/[‑‒]/g, "-")
    .replace(/[   ]/g, " ");
  var out = "";
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c <= 0xFF || WINANSI_EXTRA.indexOf(s[i]) !== -1) out += s[i];
  }
  return out;
}

/* wrap text to width, return array of lines */
Doc.prototype.wrap = function (text, font, size, width) {
  var words = safe(text).split(/\s+/), lines = [], line = "";
  for (var i = 0; i < words.length; i++) {
    var t = line ? line + " " + words[i] : words[i];
    if (font.widthOfTextAtSize(t, size) > width && line) { lines.push(line); line = words[i]; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
};

Doc.prototype.text = function (str, opts) {
  opts = opts || {};
  var size = opts.size || 9.5;
  var font = opts.font || this.f.reg;
  var color = opts.color || INK;
  var x = M.left + (opts.indent || 0);
  var w = (opts.width || this.width()) - (opts.indent || 0);
  var lead = opts.lead || size * 1.35;
  var lines = this.wrap(str, font, size, w);
  for (var i = 0; i < lines.length; i++) {
    this.need(lead);
    this.page.drawText(lines[i], { x: x, y: this.y - size, size: size, font: font, color: color });
    this.y -= lead;
  }
  if (opts.after) this.y -= opts.after;
  return this;
};

Doc.prototype.title = function (str, kicker) {
  this.need(64);
  if (kicker) {
    this.page.drawText(safe(kicker).toUpperCase(), {
      x: M.left, y: this.y - 7, size: 7, font: this.f.bold, color: GREY,
      characterSpacing: 1.3
    });
    this.y -= 16;
  }
  this.text(str, { size: 17, font: this.f.bold, lead: 20 });
  this.y -= 3;
  this.page.drawLine({
    start: { x: M.left, y: this.y }, end: { x: PT.LETTER[0] - M.right, y: this.y },
    thickness: 1.6, color: INK
  });
  this.y -= 13;
  return this;
};

Doc.prototype.h2 = function (str) {
  this.need(28);
  this.y -= 6;
  this.text(str, { size: 10.5, font: this.f.bold, lead: 13 });
  this.page.drawLine({
    start: { x: M.left, y: this.y + 2 }, end: { x: PT.LETTER[0] - M.right, y: this.y + 2 },
    thickness: 0.5, color: RULE
  });
  this.y -= 8;
  return this;
};

Doc.prototype.cite = function (str) {
  this.text(str, { size: 7.5, font: this.f.reg, color: GREY, lead: 10, after: 3 });
  return this;
};

/* a labelled fill-in line; cols = [{label, value, w}] where w sums to 1 */
Doc.prototype.fields = function (cols, opts) {
  opts = opts || {};
  var gap = 12, total = this.width(), n = cols.length;
  var avail = total - gap * (n - 1);
  var h = opts.h || 30;
  this.need(h + 4);
  var x = M.left;
  for (var i = 0; i < n; i++) {
    var c = cols[i], w = avail * (c.w || 1 / n);
    this.page.drawText(safe(c.label).toUpperCase(), {
      x: x, y: this.y - 6, size: 6.2, font: this.f.bold, color: GREY, characterSpacing: 1
    });
    if (c.value) {
      var v = safe(c.value), sz = 10;
      while (sz > 6 && this.f.bold.widthOfTextAtSize(v, sz) > w) sz -= 0.5;
      this.page.drawText(v, {
        x: x, y: this.y - 20, size: sz, font: this.f.bold, color: INK
      });
    }
    this.page.drawLine({
      start: { x: x, y: this.y - 24 }, end: { x: x + w, y: this.y - 24 },
      thickness: 0.75, color: c.value ? RULE : INK
    });
    x += w + gap;
  }
  this.y -= h;
  return this;
};

/* blank ruled lines for handwriting */
Doc.prototype.lines = function (n, opts) {
  opts = opts || {};
  var gap = opts.gap || 20;
  for (var i = 0; i < n; i++) {
    this.need(gap);
    this.page.drawLine({
      start: { x: M.left + (opts.indent || 0), y: this.y - 12 },
      end: { x: PT.LETTER[0] - M.right, y: this.y - 12 },
      thickness: 0.6, color: RULE
    });
    this.y -= gap;
  }
  return this;
};

Doc.prototype.checkbox = function (label, opts) {
  opts = opts || {};
  var s = 9.5, box = 9;
  var indent = opts.indent || 0;
  var lines = this.wrap(label, this.f.reg, s, this.width() - 18 - indent);
  this.need(lines.length * 13 + 4);
  this.page.drawRectangle({
    x: M.left + indent, y: this.y - box - 1, width: box, height: box,
    borderWidth: 0.9, borderColor: INK, color: undefined
  });
  for (var i = 0; i < lines.length; i++) {
    this.page.drawText(lines[i], {
      x: M.left + indent + 16, y: this.y - s, size: s, font: this.f.reg, color: INK
    });
    this.y -= 13;
  }
  this.y -= 2;
  return this;
};

/* numbered requirement block: "1." + bold lead-in + body */
Doc.prototype.numbered = function (num, body, opts) {
  opts = opts || {};
  var s = 9.5, indent = 20;
  var lines = this.wrap(body, this.f.reg, s, this.width() - indent);
  this.need(lines.length * 13 + (opts.blank ? opts.blank * 20 : 0) + 6);
  this.page.drawText(String(num) + ".", {
    x: M.left, y: this.y - s, size: s, font: this.f.bold, color: INK
  });
  for (var i = 0; i < lines.length; i++) {
    this.page.drawText(lines[i], {
      x: M.left + indent, y: this.y - s, size: s, font: this.f.reg, color: INK
    });
    this.y -= 13;
  }
  if (opts.blank) this.lines(opts.blank, { indent: indent });
  this.y -= 4;
  return this;
};

Doc.prototype.callout = function (str, opts) {
  opts = opts || {};
  var s = 9, pad = 9;
  var lines = this.wrap(str, this.f.reg, s, this.width() - pad * 2 - 4);
  var h = lines.length * 12 + pad * 2;
  this.need(h + 8);
  this.page.drawRectangle({
    x: M.left, y: this.y - h, width: this.width(), height: h,
    borderWidth: 0.8, borderColor: opts.warn ? INK : RULE
  });
  this.page.drawRectangle({
    x: M.left, y: this.y - h, width: 3, height: h, color: INK
  });
  var yy = this.y - pad;
  for (var i = 0; i < lines.length; i++) {
    this.page.drawText(lines[i], {
      x: M.left + pad + 4, y: yy - s, size: s, font: this.f.reg, color: INK
    });
    yy -= 12;
  }
  this.y -= h + 10;
  return this;
};

/* simple table; cols=[{head,w}] rows=[[...]] */
Doc.prototype.table = function (cols, rows, opts) {
  opts = opts || {};
  var s = 8.5, pad = 5, total = this.width();
  var self = this;
  function widths() { return cols.map(function (c) { return total * c.w; }); }
  var W = widths();

  function header() {
    self.need(22);
    var x = M.left;
    self.page.drawLine({
      start: { x: M.left, y: self.y - 15 }, end: { x: M.left + total, y: self.y - 15 },
      thickness: 1, color: INK
    });
    for (var i = 0; i < cols.length; i++) {
      self.page.drawText(safe(cols[i].head).toUpperCase(), {
        x: x + pad, y: self.y - 11, size: 6.2, font: self.f.bold, color: GREY, characterSpacing: 0.9
      });
      x += W[i];
    }
    self.y -= 19;
  }
  header();

  /* A cell of "[]" draws an empty box; "[] Yes [] No" draws boxes inline. */
  function boxRun(page, str, x, y, font) {
    var parts = String(str).split("[]"), cx = x;
    for (var i = 0; i < parts.length; i++) {
      if (i > 0) {
        page.drawRectangle({ x: cx, y: y - 0.5, width: 7.5, height: 7.5, borderWidth: 0.8, borderColor: INK });
        cx += 10;
      }
      var t = safe(parts[i]);
      if (t) { page.drawText(t, { x: cx, y: y, size: 8.5, font: font, color: INK }); cx += font.widthOfTextAtSize(t, 8.5); }
    }
  }

  for (var r = 0; r < rows.length; r++) {
    var cells = rows[r];
    var wrapped = [], maxL = 1;
    for (var i = 0; i < cols.length; i++) {
      var f = (r === 0 && opts.boldFirst) ? this.f.bold : this.f.reg;
      var raw = cells[i] == null ? "" : String(cells[i]);
      var L = raw.indexOf("[]") !== -1 ? [raw] : this.wrap(raw, f, s, W[i] - pad * 2);
      wrapped.push(L);
      if (L.length > maxL) maxL = L.length;
    }
    var h = maxL * 11 + 8;
    if (this.y - h < M.bottom) { this.addPage(); header(); }
    var x = M.left;
    for (var i = 0; i < cols.length; i++) {
      for (var k = 0; k < wrapped[i].length; k++) {
        var fnt = cols[i].bold ? this.f.bold : this.f.reg;
        if (wrapped[i][k].indexOf("[]") !== -1) {
          boxRun(this.page, wrapped[i][k], x + pad, this.y - 8 - k * 11, fnt);
        } else {
          this.page.drawText(wrapped[i][k], {
            x: x + pad, y: this.y - 8 - k * 11, size: s, font: fnt, color: INK
          });
        }
      }
      x += W[i];
    }
    this.y -= h;
    this.page.drawLine({
      start: { x: M.left, y: this.y + 2 }, end: { x: M.left + total, y: this.y + 2 },
      thickness: 0.4, color: LIGHT
    });
  }
  this.y -= 6;
  return this;
};

Doc.prototype.signature = function (cols) {
  this.y -= 14;
  this.need(40);
  this.fields(cols, { h: 34 });
  return this;
};

Doc.prototype.disclaimer = function (d) {
  this.y -= 6;
  this.text(
    "Template generated " + d.today + ". Prepared to reflect the cited sections of 49 CFR as in effect August 2026; " +
    "verify current requirements at ecfr.gov before use. Compliance with 49 CFR Part 391 is the sole responsibility of " +
    "the motor carrier. This template is a drafting aid and is not a determination that a driver qualification file is " +
    "complete or compliant, is not legal advice, and is not approved or endorsed by FMCSA.",
    { size: 6.5, font: this.f.reg, color: GREY, lead: 8.5 }
  );
  return this;
};

/* ------------------------------------------------------------- documents -- */

function fmtDate(iso) {
  if (!iso) return "";
  var p = String(iso).split("-");
  if (p.length !== 3) return iso;
  var mo = ["January","February","March","April","May","June","July",
            "August","September","October","November","December"][+p[1] - 1];
  return mo + " " + (+p[2]) + ", " + p[0];
}

var DOCS = {};

/* 1 — cover sheet / index ------------------------------------------------- */
DOCS.cover = function (D, d) {
  D.addPage("DQ file index · 49 CFR 391.51");
  D.title("Driver Qualification File", d.carrierName || "Motor carrier");

  D.fields([
    { label: "Driver", value: d.driverName, w: 0.5 },
    { label: "USDOT #", value: d.dot, w: 0.22 },
    { label: "Date of hire", value: fmtDate(d.hireDate), w: 0.28 }
  ]);
  D.fields([
    { label: "License state", value: d.licState, w: 0.24 },
    { label: "License number", value: d.licNum, w: 0.38 },
    { label: "Assigned operation", value: d.cdl ? "CDL required" : "CDL not required", w: 0.38 }
  ]);

  D.h2("What belongs in this file");
  D.cite("49 CFR 391.51(b). Retention under 391.51(c) and (d).");

  var rows = [
    ["391.51(b)(1)", "Application for employment", "Employment + 3 years", "In packet"],
    ["391.51(b)(2)", "Pre-employment MVR from each licensing authority", "Employment + 3 years", "Obtain within 30 days of hire"],
    ["391.51(b)(3)", d.roadTestPath === "cdl"
      ? "Copy of the CDL accepted in lieu of a road test"
      : "Certificate of driver's road test", "Employment + 3 years",
      d.roadTestPath === "cdl" ? "Copy the license" : "In packet"],
    ["391.51(b)(4)", "Annual MVR", "3 years from execution", "Every 12 months"],
    ["391.51(b)(5)", "Note of the annual review of driving record", "3 years from execution", "In packet"]
  ];
  if (d.cdl) {
    rows.push(["391.51(b)(6)(ii)", "CDLIS motor vehicle record showing medical certification status",
      "3 years from execution", "Pull the CDLIS MVR"]);
  } else {
    rows.push(["391.51(b)(6)(i)", "Medical examiner's certificate (Form MCSA-5876) or legible copy",
      "3 years from execution", "Copy the card"]);
    rows.push(["391.51(b)(8)(i)", "National Registry verification note",
      "3 years from execution", "In packet"]);
  }
  rows.push(["391.51(b)(7)", "Medical variance, SPE certificate or exemption, if any",
    "3 years from execution", d.medicalVariance ? "Attach current document" : "Not indicated"]);
  if (d.lcv) {
    rows.push(["49 CFR Part 380", "LCV training certificate or grandfathering certificate",
      "Employment + 3 years", "Obtain and attach"]);
  }

  var outsideRows = [
    ["Previous employer safety performance history responses, and documentation of good faith efforts",
     "Driver investigation history file, 391.53", "Employment + 3 years"]
  ];
  if (d.cdl) {
    outsideRows.push(
      ["Clearinghouse query records and results", "Clearinghouse account, 382.701(e)", "3 years"],
      ["Signed receipt for drug and alcohol educational materials",
       "Drug and alcohol program records, 382.401(b)(4)", "Employment + 2 years"],
      ["Drug and alcohol test results", "Drug and alcohol program records, 382.401", "1 to 5 years by type"]
    );
  }
  D.table(
    [{ head: "Section", w: 0.16, bold: true }, { head: "Document", w: 0.42 },
     { head: "Retention", w: 0.22 }, { head: "Status", w: 0.20 }],
    rows
  );

  D.h2("Kept outside this file");
  D.cite("Separate files required by 49 CFR 391.53 and 382.701(e).");
  D.table(
    [{ head: "Record", w: 0.46 }, { head: "Where", w: 0.30 }, { head: "Retention", w: 0.24 }],
    outsideRows
  );

  if (d.selfEmployed) {
    D.callout(
      "You are the driver and the motor carrier. You still need a complete qualification file on yourself — " +
      "the regulations make no exception for owner-operators running under their own authority. One thing you " +
      "cannot do alone: 391.31(b) requires that a driver who is also the motor carrier be road tested by another person.",
      { warn: true }
    );
  }

  D.callout(
    "Special classifications can change this checklist. This packet is not designed to determine the reduced records " +
    "allowed for a multiple-employer driver under 391.63, or additional State and specialized-operation requirements."
  );

  D.callout(
    "49 CFR 391.27, the driver's annual certificate of violations, was removed effective May 9, 2022 " +
    "(87 FR 13192). It is not in this packet and it is no longer required. Checklists that still list it are out of date.",
    { warn: true }
  );

  D.disclaimer(d);
};

/* 2 — application for employment ----------------------------------------- */
DOCS.application = function (D, d) {
  D.addPage("Application for employment · 49 CFR 391.21");
  D.title("Driver's Application for Employment", d.carrierName || "Motor carrier");

  D.text(
    "To the applicant: this application must be completed and signed by you. 49 CFR 391.21 requires every item below. " +
    "Do not leave gaps in the employment history — account for all time, including periods of unemployment.",
    { size: 9, color: GREY, after: 6 }
  );

  D.h2("1 · Employing motor carrier");
  D.cite("391.21(b)(1)");
  D.fields([
    { label: "Company name", value: d.carrierName, w: 0.55 },
    { label: "USDOT #", value: d.dot, w: 0.2 },
    { label: "Date submitted", value: "", w: 0.25 }
  ]);
  D.fields([{ label: "Address", value: d.carrierAddress, w: 1 }]);

  D.h2("2 · Applicant");
  D.cite("391.21(b)(2), (b)(3)");
  D.fields([
    { label: "Full name", value: "", w: 0.5 },
    { label: "Date of birth", value: "", w: 0.25 },
    { label: "Social security number", value: "", w: 0.25 }
  ]);
  D.fields([{ label: "Current address", value: "", w: 1 }]);
  D.text("All addresses where you have resided during the past 3 years:", { size: 9, after: 2 });
  D.lines(3);

  D.h2("3 · Licenses");
  D.cite("391.21(b)(5). List every unexpired commercial motor vehicle operator's license or permit.");
  D.table(
    [{ head: "Issuing licensing authority", w: 0.34 }, { head: "License / permit number", w: 0.33 },
     { head: "Expiration date", w: 0.33 }],
    [["", "", ""], ["", "", ""], ["", "", ""]]
  );
  D.callout("49 CFR 391.11(b)(5): a driver may hold a commercial motor vehicle operator's license from only one State or jurisdiction.");

  D.h2("4 · Driving experience");
  D.cite("391.21(b)(6)");
  D.table(
    [{ head: "Class of equipment", w: 0.28 }, { head: "Type (van, tank, flat, etc.)", w: 0.26 },
     { head: "Date from", w: 0.15 }, { head: "Date to", w: 0.15 }, { head: "Approx. miles", w: 0.16 }],
    [["Straight truck", "", "", "", ""], ["Tractor and semitrailer", "", "", "", ""],
     ["Tractor, two trailers", "", "", "", ""], ["Tractor, three trailers", "", "", "", ""],
     ["Motorcoach / school bus", "", "", "", ""], ["Other", "", "", "", ""]]
  );

  D.h2("5 · Accidents, past 3 years");
  D.cite("391.21(b)(7). Enter NONE if there were none.");
  D.table(
    [{ head: "Date", w: 0.16 }, { head: "Nature of accident", w: 0.44 },
     { head: "Fatalities", w: 0.2 }, { head: "Injuries", w: 0.2 }],
    [["", "", "", ""], ["", "", "", ""], ["", "", "", ""]]
  );

  D.h2("6 · Traffic convictions and forfeitures, past 3 years");
  D.cite("391.21(b)(8). Parking violations excluded. Enter NONE if there were none.");
  D.table(
    [{ head: "Date", w: 0.16 }, { head: "Violation", w: 0.42 },
     { head: "State", w: 0.14 }, { head: "Penalty", w: 0.28 }],
    [["", "", "", ""], ["", "", "", ""], ["", "", "", ""]]
  );

  D.h2("7 · License denials, revocations and suspensions");
  D.cite("391.21(b)(9). Give the facts and circumstances in detail, or state that none have occurred.");
  D.lines(3);

  D.h2("8 · Employment history, past 3 years");
  D.cite("391.21(b)(10). Every employer, in order, most recent first. Account for all time.");
  D.table(
    [{ head: "Employer name and address", w: 0.36 }, { head: "From", w: 0.11 }, { head: "To", w: 0.11 },
     { head: "Position and reason for leaving", w: 0.24 },
     { head: "FMCSR? Safety-sensitive under Part 40?", w: 0.18 }],
    [["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""]]
  );

  D.h2("9 · Additional commercial driving employment, prior 7 years");
  D.cite("391.21(b)(11). The 7 years before the 3 years above — 10 years of history in total. Commercial motor vehicle employment only.");
  D.table(
    [{ head: "Employer name and address", w: 0.44 }, { head: "From", w: 0.13 }, { head: "To", w: 0.13 },
     { head: "Position and reason for leaving", w: 0.30 }],
    [["", "", "", ""], ["", "", "", ""], ["", "", "", ""], ["", "", "", ""]]
  );

  D.h2("10 · Notice to applicant");
  D.cite("391.21(d), 391.23(i)");
  D.text(
    "The information you provide about previous employers will be used, and those employers will be contacted, for the " +
    "purpose of investigating your safety performance history as required by 49 CFR 391.23(d) and (e). You have the right " +
    "to review information provided by previous employers, to have errors corrected by the previous employer and for that " +
    "employer to resend the corrected information, and to have a rebuttal statement attached to the information if you and " +
    "the previous employer cannot resolve a disagreement. You may request this review in writing at any time, including at " +
    "the time of application or within 30 days of being employed. This motor carrier will provide the information within " +
    "five business days of receiving your written request.",
    { size: 8.8, lead: 11.5, after: 4 }
  );

  D.h2("11 · Certification");
  D.cite("391.21(b)(12)");
  D.text(
    "This certifies that this application was completed by me, and that all entries on it and information in it are true " +
    "and complete to the best of my knowledge.",
    { size: 9.5, font: D.f.bold, after: 4 }
  );
  D.signature([
    { label: "Applicant's signature", value: "", w: 0.6 },
    { label: "Date", value: "", w: 0.4 }
  ]);
  D.disclaimer(d);
};

/* 3 — safety performance history request ---------------------------------- */
DOCS.history = function (D, d) {
  D.addPage("Safety performance history request · 49 CFR 391.23");
  D.title("Safety Performance History Request", "To a previous employer");

  D.fields([
    { label: "Requesting motor carrier", value: d.carrierName, w: 0.62 },
    { label: "USDOT #", value: d.dot, w: 0.38 }
  ]);
  D.fields([{ label: "Address", value: d.carrierAddress, w: 1 }]);
  D.fields([
    { label: "Contact", value: d.safetyContact, w: 0.5 },
    { label: "Phone", value: d.carrierPhone, w: 0.25 },
    { label: "Date sent", value: "", w: 0.25 }
  ]);

  D.h2("Previous employer receiving this request");
  D.fields([{ label: "Company name", value: "", w: 1 }]);
  D.fields([{ label: "Address", value: "", w: 1 }]);

  D.h2("Driver being investigated");
  D.fields([
    { label: "Driver name", value: d.driverName, w: 0.5 },
    { label: "Date of birth", value: fmtDate(d.driverDob), w: 0.25 },
    { label: "SSN (last 4)", value: "", w: 0.25 }
  ]);
  D.fields([
    { label: "License state", value: d.licState, w: 0.3 },
    { label: "License number", value: d.licNum, w: 0.4 },
    { label: "Dates employed by you", value: "", w: 0.3 }
  ]);

  D.callout(
    "You are required by 49 CFR 391.23(g)(1) to respond within 30 days of receiving this request, including a response " +
    "confirming that no data exists. Keep a record of this request and your response for one year, per 391.23(g)(4)."
  );

  D.h2("Part A · Employment verification and accident history");
  D.cite("391.23(d). Accident data as defined in 390.5 and specified in 390.15(b)(1), for the 3 years preceding this request.");
  D.checkbox("The driver was employed by us. Dates: ______________ to ______________");
  D.checkbox("Position held: ______________________________   Reason for leaving: ______________________________");
  D.checkbox("The driver was subject to the FMCSRs while employed by us.");
  D.checkbox("The position was a safety-sensitive function subject to alcohol and controlled substances testing under 49 CFR Part 40.");
  D.text("Accidents in the 3 years preceding this request (attach additional sheets if needed). Enter NONE if there were none.",
    { size: 9, after: 3 });
  D.table(
    [{ head: "Date", w: 0.14 }, { head: "City and state", w: 0.22 }, { head: "Fatalities", w: 0.12 },
     { head: "Injuries", w: 0.12 }, { head: "HM released?", w: 0.14 }, { head: "Nature", w: 0.26 }],
    [["", "", "", "", "", ""], ["", "", "", "", "", ""], ["", "", "", "", "", ""]]
  );
  D.checkbox("We also elect to provide the following additional accidents retained under our internal policy: (attach)");

  D.h2("Part B · Drug and alcohol history");
  D.cite("391.23(e), 40.25. For the 3 years preceding this request.");
  D.callout(
    "For employment with FMCSA-regulated employers, this information is obtained through the FMCSA Drug and Alcohol " +
    "Clearinghouse under 382.701(a) — as of January 6, 2023 the Clearinghouse query replaces the manual inquiry. " +
    "Complete Part B only if you are a DOT-regulated employer in another mode (FAA, FRA, FTA, PHMSA or USCG), or if we " +
    "have asked you for a follow-up testing plan under 391.23(e)(4)(i)."
  );
  D.table(
    [{ head: "Item, past 3 years", w: 0.62 }, { head: "None", w: 0.12 }, { head: "Yes - details attached", w: 0.26 }],
    [
      ["Alcohol tests with a result of 0.04 or higher", "[]", "[]"],
      ["Verified positive controlled substances tests", "[]", "[]"],
      ["Refusals to be tested, including adulterated or substituted specimens", "[]", "[]"],
      ["Other violations of 49 CFR Part 40 or Part 382", "[]", "[]"],
      ["Failed to undertake or complete a rehabilitation program prescribed by a substance abuse professional", "[]", "[]"],
      ["If the driver completed a SAP program and remained employed: subsequent alcohol tests of 0.04 or higher, verified positive drug tests, or refusals", "[]", "[]"],
      ["Subject to a follow-up testing plan that is not yet complete - if so, attach the plan", "[]", "[]"]
    ]
  );

  D.h2("Response");
  D.signature([
    { label: "Name and title of person responding", value: "", w: 0.5 },
    { label: "Signature", value: "", w: 0.3 },
    { label: "Date", value: "", w: 0.2 }
  ]);

  /* driver release, own page */
  D.addPage("Driver release · 49 CFR 391.23(f), 40.321(b)");
  D.title("Driver's Release of Information", "Attach to the request above");

  D.text(
    "I, the undersigned, authorize the release of the information described below by my previous employers to the " +
    "prospective motor carrier named on this form. I understand this information will be used only in connection with a " +
    "decision to hire me and is otherwise protected from disclosure.",
    { size: 9.5, lead: 12.5, after: 6 }
  );
  D.checkbox("Safety performance history and accident information under 49 CFR 391.23(d).");
  D.checkbox("Alcohol and controlled substances information under 49 CFR 391.23(e) and 40.321(b).");
  D.checkbox("A query of the FMCSA Drug and Alcohol Clearinghouse under 49 CFR 382.701.");

  D.callout(
    "49 CFR 391.23(f): if the driver refuses to provide this consent, the prospective motor carrier must not permit the " +
    "driver to operate a commercial motor vehicle. The same applies to a refusal to consent to the Clearinghouse query.",
    { warn: true }
  );

  D.text(
    "I have been notified of my right to review information provided by previous employers, to have errors corrected, and " +
    "to have a rebuttal statement attached if a disagreement cannot be resolved.",
    { size: 9, lead: 12, after: 4 }
  );

  D.signature([
    { label: "Driver's printed name", value: d.driverName, w: 0.4 },
    { label: "Driver's signature", value: "", w: 0.36 },
    { label: "Date", value: "", w: 0.24 }
  ]);
  D.disclaimer(d);
};

/* 4 — good faith effort log ----------------------------------------------- */
DOCS.goodFaith = function (D, d) {
  D.addPage("Good faith effort log · 49 CFR 391.23(c)");
  D.title("Record of Contact with Previous Employers", "Driver investigation history file");

  D.fields([
    { label: "Driver", value: d.driverName, w: 0.55 },
    { label: "Date of hire", value: fmtDate(d.hireDate), w: 0.22 },
    { label: "30-day deadline", value: fmtDate(d.deadline30), w: 0.23 }
  ]);

  D.callout(
    "This is the document carriers skip, and it is the one that saves them. 49 CFR 391.23(c)(2) requires a written record " +
    "for each previous employer contacted — name and address, date contacted, and the information received — and requires " +
    "you to document failures to contact as well. If a previous employer never answers, you are not blocked from hiring: " +
    "you are required to have proof you tried. File this in the driver investigation history file under 391.53, not in the " +
    "qualification file.",
    { warn: true }
  );

  D.h2("Contact log");
  D.cite("Log every attempt: mail, fax, email, phone. Record who you spoke to.");
  D.table(
    [{ head: "Previous employer, name and address", w: 0.3 }, { head: "Date", w: 0.11 },
     { head: "Method", w: 0.13 }, { head: "Person contacted", w: 0.16 },
     { head: "Result / information received", w: 0.3 }],
    [["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""],
     ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""]]
  );

  D.h2("Outcome");
  D.checkbox("All previous DOT-regulated employers in the past 3 years responded. Responses are in the driver investigation history file.");
  D.checkbox("One or more previous employers did not respond within 30 days. Good faith efforts are logged above. Non-response reported to FMCSA under 49 CFR 386.12 on ______________ (391.23(c)(3)).");
  D.checkbox("This driver had no DOT-regulated employment in the preceding 3 years, so no investigation was possible. This documentation is filed under 391.23(c)(4).");

  D.signature([
    { label: "Completed by", value: d.safetyContact, w: 0.4 },
    { label: "Signature", value: "", w: 0.36 },
    { label: "Date", value: "", w: 0.24 }
  ]);
  D.disclaimer(d);
};

/* 5 — road test rating form ----------------------------------------------- */
DOCS.roadTestForm = function (D, d) {
  D.addPage("Road test rating form · 49 CFR 391.31(c), (d)");
  D.title("Driver's Road Test — Examiner's Rating Form", d.carrierName || "Motor carrier");

  D.fields([
    { label: "Driver", value: d.driverName, w: 0.5 },
    { label: "Date of test", value: "", w: 0.25 },
    { label: "Miles driven", value: "", w: 0.25 }
  ]);
  D.fields([
    { label: "Power unit type and plate", value: "", w: 0.5 },
    { label: "Trailer type and plate", value: "", w: 0.5 }
  ]);

  D.callout(
    "49 CFR 391.31(b): the examiner must be competent to evaluate and determine whether the driver has the skills and " +
    "ability to safely operate this type of vehicle." +
    (d.selfEmployed
      ? " Because you are both the driver and the motor carrier, the regulation requires that you be tested by another person — you cannot test yourself."
      : ""),
    { warn: !!d.selfEmployed }
  );

  D.h2("Required elements");
  D.cite("391.31(c). The examiner must rate performance on each item and sign the form. 391.31(d).");
  D.table(
    [{ head: "#", w: 0.05 }, { head: "Operation tested", w: 0.55 },
     { head: "Satisfactory", w: 0.13 }, { head: "Needs work", w: 0.13 }, { head: "Remarks", w: 0.14 }],
    [
      ["1", "Pre-trip inspection required by 392.7", "[]", "[]", ""],
      ["2", "Coupling and uncoupling of combination units, if the driver may be assigned them", "[]", "[]", ""],
      ["3", "Placing the commercial motor vehicle in operation", "[]", "[]", ""],
      ["4", "Use of the vehicle's controls and emergency equipment", "[]", "[]", ""],
      ["5", "Operating the vehicle in traffic and while passing other vehicles", "[]", "[]", ""],
      ["6", "Turning the vehicle", "[]", "[]", ""],
      ["7", "Braking, and slowing the vehicle by means other than braking", "[]", "[]", ""],
      ["8", "Backing and parking the vehicle", "[]", "[]", ""]
    ]
  );

  D.h2("Examiner's remarks");
  D.lines(3);

  D.signature([
    { label: "Examiner's printed name and title", value: "", w: 0.5 },
    { label: "Examiner's signature", value: "", w: 0.3 },
    { label: "Date", value: "", w: 0.2 }
  ]);
  D.text("Retain this original signed rating form in the driver qualification file together with the certificate on the next page. 49 CFR 391.31(g).",
    { size: 8, color: GREY });
  D.disclaimer(d);
};

/* 6 — certificate of road test -------------------------------------------- */
DOCS.roadTestCert = function (D, d) {
  D.addPage("Certificate of road test · 49 CFR 391.31(e), (f)");
  D.title("Certificate of Driver's Road Test", d.carrierName || "Motor carrier");

  D.text("Substantially in the form prescribed by 49 CFR 391.31(f).", { size: 8.5, color: GREY, after: 8 });

  D.fields([{ label: "Driver's name", value: d.driverName, w: 1 }]);
  D.fields([
    { label: "Type of power unit", value: "", w: 0.34 },
    { label: "Type of trailer(s)", value: "", w: 0.33 },
    { label: "If passenger carrier, type of bus", value: "", w: 0.33 }
  ]);

  D.y -= 8;
  D.text(
    "This is to certify that the above-named driver was given a road test under my supervision on the date shown below, " +
    "consisting of approximately ______________ miles of driving.",
    { size: 10, lead: 14, after: 6 }
  );
  D.text(
    "It is my considered opinion that this driver possesses sufficient driving skill to operate safely the type of " +
    "commercial motor vehicle listed above.",
    { size: 10, lead: 14, after: 12 }
  );

  D.fields([{ label: "Date of test", value: "", w: 0.4 }]);
  D.signature([
    { label: "Signature of examiner", value: "", w: 0.5 },
    { label: "Title", value: "", w: 0.5 }
  ]);
  D.fields([{ label: "Organization and address of examiner", value: d.carrierName ? d.carrierName + (d.carrierAddress ? " · " + d.carrierAddress : "") : "", w: 1 }]);

  D.y -= 6;
  D.callout(
    "49 CFR 391.31(g): give a copy of this certificate to the driver. Keep the original signed rating form and the " +
    "original certificate in the driver qualification file."
  );
  D.disclaimer(d);
};

/* 7 — CDL in lieu of road test -------------------------------------------- */
DOCS.cdlEquivalent = function (D, d) {
  D.addPage("Equivalent of road test · 49 CFR 391.33");
  D.title("CDL Accepted as the Road-Test Equivalent", d.carrierName || "Motor carrier");

  D.text(
    "49 CFR 391.33(a)(1) permits a motor carrier to accept a valid commercial driver's license in place of the road test " +
    "required by 391.31, where the State licensed the driver after a road test in a vehicle of the type the carrier " +
    "intends to assign. A legible copy of the license must be retained in the driver qualification file, 391.33(b).",
    { size: 9.5, lead: 12.5, after: 8 }
  );

  D.callout(
    "Plain English: for most standard CDL assignments, the carrier keeps a legible copy of the valid CDL and does not " +
    "administer another road test. This page documents the carrier's decision; the CDL copy is the required evidence."
  );

  D.callout(
    "This substitution does not extend to double or triple trailer endorsements or tank vehicle endorsements. " +
    "If this driver will pull doubles or triples, or operate a tank vehicle, an actual road test under 391.31 is " +
    "required — or a certificate of road test issued within the preceding 3 years under 391.33(a)(2).",
    { warn: true }
  );

  D.fields([
    { label: "Driver", value: d.driverName, w: 0.5 },
    { label: "License state", value: d.licState, w: 0.22 },
    { label: "License number", value: d.licNum, w: 0.28 }
  ]);
  D.fields([
    { label: "Class", value: "", w: 0.2 },
    { label: "Endorsements", value: "", w: 0.4 },
    { label: "Expiration date", value: "", w: 0.4 }
  ]);

  D.h2("Basis of acceptance");
  D.checkbox("A valid CDL under 49 CFR 383.5, accepted under 391.33(a)(1). Legible copy attached.");
  D.checkbox("A certificate of driver's road test issued under 391.31 within the preceding 3 years, accepted under 391.33(a)(2). Copy attached.");
  D.checkbox("The driver will operate double or triple trailers or a tank vehicle. A road test under 391.31 was administered — see the road test certificate in this file.");

  D.text(
    "49 CFR 391.33(c) permits this motor carrier to require a road test or other test of driving skill from any driver " +
    "who presents a license or certificate as equivalent. Accepting the license does not waive that right.",
    { size: 8.8, color: GREY, lead: 11.5, after: 4 }
  );

  D.signature([
    { label: "Accepted by", value: d.safetyContact, w: 0.4 },
    { label: "Title", value: d.safetyTitle, w: 0.3 },
    { label: "Date", value: "", w: 0.3 }
  ]);
  D.disclaimer(d);
};

/* 8 — annual review of driving record ------------------------------------- */
DOCS.annualReview = function (D, d) {
  D.addPage("Annual review of driving record · 49 CFR 391.25");
  D.title("Annual Review of Driving Record", d.carrierName || "Motor carrier");

  D.fields([
    { label: "Driver", value: d.driverName, w: 0.55 },
    { label: "License state", value: d.licState, w: 0.2 },
    { label: "License number", value: d.licNum, w: 0.25 }
  ]);

  D.callout(
    "Two elements make this record compliant and both are routinely missing: the name of the person who performed the " +
    "review, and the date of the review. 49 CFR 391.25(c)(2). Failing to maintain driving record inquiries in the " +
    "qualification file is a critical violation under Appendix B to Part 385, and it is the most frequently cited " +
    "qualification-file violation FMCSA writes.",
    { warn: true }
  );

  D.h2("What the review must consider");
  D.cite("391.25(b)");
  D.text(
    "Whether the driver meets the minimum requirements for safe driving and is not disqualified under 391.15. Consider " +
    "violations of the Federal Motor Carrier Safety Regulations and Hazardous Materials Regulations, the driver's accident " +
    "record, and violations of motor vehicle laws and ordinances — giving great weight to violations showing disregard for " +
    "the safety of the public, such as speeding, reckless driving, and operating while under the influence of alcohol or drugs.",
    { size: 9, lead: 11.5, after: 4 }
  );

  D.h2("Review record");
  D.cite("One row per year. Attach the MVR obtained under 391.25(a) to each.");
  D.table(
    [{ head: "MVR date", w: 0.13 }, { head: "Licensing authority", w: 0.17 },
     { head: "Violations or accidents noted", w: 0.28 },
     { head: "Qualified?", w: 0.12 }, { head: "Reviewed by (name)", w: 0.18 }, { head: "Review date", w: 0.12 }],
    [["", "", "", "[] Yes  [] No", "", ""], ["", "", "", "[] Yes  [] No", "", ""],
     ["", "", "", "[] Yes  [] No", "", ""], ["", "", "", "[] Yes  [] No", "", ""]]
  );

  D.h2("Certification for the current review");
  D.text(
    "I have reviewed the motor vehicle record identified above for this driver, considering the factors in 49 CFR 391.25(b), " +
    "and have determined that the driver meets the minimum requirements for safe driving and is not disqualified under 49 CFR 391.15.",
    { size: 9.2, lead: 12, after: 4 }
  );
  D.signature([
    { label: "Reviewer's printed name", value: d.safetyContact, w: 0.36 },
    { label: "Signature", value: "", w: 0.34 },
    { label: "Date of review", value: "", w: 0.3 }
  ]);

  D.callout(
    "Next review due " + (d.nextReview ? fmtDate(d.nextReview) : "twelve months from the date above") +
    ". The MVR and this note may be removed from the file three years after execution, 391.51(d)(1) and (d)(2)."
  );
  D.disclaimer(d);
};

/* 9 — national registry verification note (non-CDL) ----------------------- */
DOCS.registryNote = function (D, d) {
  D.addPage("National Registry verification · 49 CFR 391.23(m)(1), 391.51(b)(8)(i)");
  D.title("National Registry Verification Note", "Non-CDL interstate driver");

  D.text(
    "For a driver who is not required to hold a commercial driver's license, 49 CFR 391.23(m)(1) requires the motor " +
    "carrier to verify that the medical examiner who issued the certificate is listed on the FMCSA National Registry of " +
    "Certified Medical Examiners, and to keep a note of that verification in the qualification file before allowing the " +
    "driver to operate a commercial motor vehicle.",
    { size: 9.5, lead: 12.5, after: 8 }
  );

  D.fields([
    { label: "Driver", value: d.driverName, w: 0.55 },
    { label: "Date of birth", value: fmtDate(d.driverDob), w: 0.45 }
  ]);
  D.fields([
    { label: "Medical examiner's name", value: "", w: 0.5 },
    { label: "National Registry number", value: "", w: 0.5 }
  ]);
  D.fields([
    { label: "Certificate issued", value: "", w: 0.33 },
    { label: "Certificate expires", value: "", w: 0.33 },
    { label: "Date verified", value: "", w: 0.34 }
  ]);

  D.h2("Verification");
  D.checkbox("I verified at nationalregistry.fmcsa.dot.gov that the medical examiner named above is listed on the National Registry of Certified Medical Examiners on the date shown.");
  D.checkbox("A legible copy of the medical examiner's certificate (Form MCSA-5876) is filed with this note. 391.51(b)(6)(i).");
  D.checkbox("The driver holds a medical variance, SPE certificate or exemption. A copy is filed. 391.51(b)(7).");

  D.signature([
    { label: "Verified by", value: d.safetyContact, w: 0.4 },
    { label: "Signature", value: "", w: 0.34 },
    { label: "Date", value: "", w: 0.26 }
  ]);

  D.callout(
    "This requirement still applies to non-CDL drivers. It ended for CDL and CLP holders after June 22, 2025, when " +
    "medical certification for those drivers moved to electronic transmission and the CDLIS motor vehicle record."
  );
  D.disclaimer(d);
};

/* 10 — drug & alcohol policy receipt -------------------------------------- */
DOCS.policyReceipt = function (D, d) {
  D.addPage("Educational materials receipt · 49 CFR 382.601");
  D.title("Drug and Alcohol Program — Receipt", d.carrierName || "Motor carrier");

  D.text(
    "49 CFR 382.601 requires this motor carrier to provide written educational materials to every covered driver before " +
    "testing begins, and to obtain the driver's signed receipt for them. This page is only the receipt and content checklist. " +
    "It does not replace the carrier's actual written policy and educational materials, which must address the subjects below.",
    { size: 9.5, lead: 12.5, after: 6 }
  );

  D.h2("Contents of the materials provided");
  D.cite("382.601(b)");
  var items = [
    "The identity of the person designated to answer driver questions about the materials.",
    "The categories of drivers subject to the requirements of Part 382.",
    "Sufficient information about the safety-sensitive functions performed by those drivers to make clear what period of the work day the driver is required to be in compliance.",
    "Specific information concerning driver conduct that is prohibited by Part 382, Subpart B.",
    "The circumstances under which a driver will be tested for alcohol and controlled substances, including post-accident testing under 382.303.",
    "The procedures used to test for the presence of alcohol and controlled substances, protect the driver and the integrity of the process, safeguard the validity of results, and ensure results are attributed to the correct driver.",
    "The requirement that a driver submit to alcohol and controlled substances tests administered in accordance with Part 382.",
    "An explanation of what constitutes a refusal to submit to a test and the attendant consequences.",
    "The consequences for drivers found to have violated Subpart B, including the requirement that the driver be removed immediately from safety-sensitive functions and the procedures of Part 40, Subpart O.",
    "The consequences for drivers found to have an alcohol concentration of 0.02 or greater but less than 0.04.",
    "Information concerning the effects of alcohol and controlled substances on health, work and personal life; signs and symptoms of a problem; and available methods of intervening when a problem is suspected, including confrontation, referral to an employee assistance program, and referral to management.",
    "Information about the reporting of positive tests, refusals and return-to-duty completions to the FMCSA Drug and Alcohol Clearinghouse."
  ];
  for (var i = 0; i < items.length; i++) D.numbered(i + 1, items[i]);

  D.h2("Driver's certificate of receipt");
  D.cite("382.601(d). Retain while the driver performs safety-sensitive functions and for 2 years after, 382.401(b)(4).");
  D.text(
    "I certify that I have received a copy of the educational materials described above concerning the requirements of " +
    "49 CFR Part 382 and this motor carrier's policies with respect to those requirements.",
    { size: 9.5, font: D.f.bold, lead: 12.5, after: 4 }
  );
  D.signature([
    { label: "Driver's printed name", value: d.driverName, w: 0.36 },
    { label: "Driver's signature", value: "", w: 0.34 },
    { label: "Date", value: "", w: 0.3 }
  ]);
  D.fields([
    { label: "Designated contact person for questions", value: d.safetyContact, w: 0.6 },
    { label: "Phone", value: d.carrierPhone, w: 0.4 }
  ]);
  D.disclaimer(d);
};

/* 11 — clearinghouse limited query consent -------------------------------- */
DOCS.chConsent = function (D, d) {
  D.addPage("Clearinghouse limited query consent · 49 CFR 382.701(b)");
  D.title("Clearinghouse Limited Query Consent", d.carrierName || "Motor carrier");

  D.text(
    "49 CFR 382.701(b) requires this motor carrier to query the FMCSA Drug and Alcohol Clearinghouse at least once every " +
    "twelve months for every employee subject to Part 382 testing. A limited query may be used, and it requires the driver's general written " +
    "consent. One signed consent may cover more than one year.",
    { size: 9.5, lead: 12.5, after: 8 }
  );

  D.fields([
    { label: "Driver", value: d.driverName, w: 0.5 },
    { label: "Date of birth", value: fmtDate(d.driverDob), w: 0.22 },
    { label: "CDL number and state", value: d.licNum ? d.licNum + " / " + (d.licState || "") : "", w: 0.28 }
  ]);

  D.y -= 4;
  D.text(
    "I authorize " + (d.carrierName || "the motor carrier named above") + " to conduct limited queries of the FMCSA " +
    "Commercial Driver's License Drug and Alcohol Clearinghouse to determine whether information about me exists in the " +
    "Clearinghouse. I understand that a limited query does not release the contents of any such record, and that if a " +
    "limited query indicates information exists, the motor carrier must obtain my specific electronic consent in the " +
    "Clearinghouse before conducting a full query.",
    { size: 9.5, lead: 12.5, after: 6 }
  );
  D.text(
    "This consent remains in effect for the period indicated below, or until I revoke it in writing.",
    { size: 9.5, lead: 12.5, after: 4 }
  );
  D.fields([
    { label: "Consent period from", value: "", w: 0.35 },
    { label: "Through", value: "", w: 0.35 },
    { label: "Number of years", value: "", w: 0.3 }
  ]);

  D.signature([
    { label: "Driver's printed name", value: d.driverName, w: 0.36 },
    { label: "Driver's signature", value: "", w: 0.34 },
    { label: "Date", value: "", w: 0.3 }
  ]);

  D.callout(
    "If a limited query shows that information exists, 382.701(b)(2) requires a full query within 24 hours. If the full " +
    "query is not completed, the driver must not perform any safety-sensitive function until it is. Retain query records " +
    "for 3 years, 382.701(e)."
  );
  D.callout(
    "A pre-employment query is different and must be a FULL query with the driver's specific electronic consent given " +
    "inside the Clearinghouse. This general consent does not cover it. 382.701(a).",
    { warn: true }
  );
  D.disclaimer(d);
};

/* 12 — action plan --------------------------------------------------------- */
DOCS.actions = function (D, d) {
  D.addPage("Action plan · the parts that are not paperwork");
  D.title("What Paperwork Cannot Fix", d.driverName || "This driver");

  D.text(
    d.cdl
      ? "A complete packet does not perform the Clearinghouse queries or drug test required before safety-sensitive work. These are separate actions, taken in FMCSA systems and through the carrier's testing program."
      : "A complete packet still requires the carrier to obtain official records and verify the driver's current qualification. These actions cannot be completed by a generated form.",
    { size: 9.5, lead: 12.5, after: 8 }
  );

  D.h2("Before this driver operates a commercial motor vehicle");
  var beforeDriving = [];
  if (d.cdl) {
    beforeDriving.push(
      ["Register your company in the Clearinghouse", "382.711(b)", "clearinghouse.fmcsa.dot.gov"],
      ["Run a full pre-employment query, with the driver's specific electronic consent given in the Clearinghouse", "382.701(a)", "clearinghouse.fmcsa.dot.gov"],
      ["Obtain a verified negative pre-employment controlled substances test result", "382.301(a)", "Your consortium or collection site"]
    );
  }
  if (d.medicalVariance) {
    beforeDriving.push(["Attach and verify the driver's current medical variance, SPE certificate, or exemption", "391.51(b)(7)", "Driver's current qualification records"]);
  }
  if (d.lcv) {
    beforeDriving.push(["Obtain and attach the applicable LCV training or grandfathering certificate", "49 CFR Part 380", "Training provider or existing driver record"]);
  }
  beforeDriving.push(
    ["Verify the driver holds one valid license, correctly classed and endorsed for the assigned vehicle", "391.11(b)(5)", "The license itself, and the MVR"],
    d.cdl
      ? ["Pull the CDLIS motor vehicle record and confirm medical certification status is certified and current", "391.23(m)(2), 391.51(b)(6)(ii)", "Your State licensing agency"]
      : ["Obtain the medical examiner's certificate and verify the examiner on the National Registry", "391.23(m)(1)", "nationalregistry.fmcsa.dot.gov"]
  );
  if (d.cdl) {
    beforeDriving.push(["Provide your actual drug and alcohol educational materials and obtain the signed receipt", "382.601", "Carrier policy plus receipt in this packet"]);
  }
  D.table(
    [{ head: "Action", w: 0.46 }, { head: "Requirement", w: 0.18 }, { head: "Where", w: 0.36 }],
    beforeDriving
  );

  D.h2("Within 30 days of the date of hire" + (d.deadline30 ? " — by " + fmtDate(d.deadline30) : ""));
  D.table(
    [{ head: "Action", w: 0.46 }, { head: "Requirement", w: 0.18 }, { head: "Where", w: 0.36 }],
    [
      ["Obtain the MVR from each licensing authority where the driver held a CMV licence in the past 3 years, and file it", "391.23(a)(1), (b)", "Each State licensing agency"],
      ["Complete the safety performance history investigation and file the responses, or the documentation of good faith efforts", "391.23(a)(2), (c)", "Driver investigation history file, 391.53"]
    ]
  );

  if (d.cdl) {
    D.h2("Medical certification for CDL drivers — a transition in progress");
    D.text(
      "Since June 23, 2025, medical examiners transmit CDL and CLP driver examination results electronically to FMCSA, " +
      "which passes medical certification status to the State licensing agency. No paper certificate is issued to a CDL " +
      "driver, and the carrier documents medical certification by obtaining the CDLIS motor vehicle record — 391.51(b)(6)(ii). " +
      "Because some States were slow to implement, FMCSA has granted temporary exemptions permitting reliance on a paper " +
      "certificate. The current exemption runs through October 11, 2026 and allows a paper certificate for up to 60 days " +
      "from issuance. FMCSA has said it does not anticipate granting further nationwide exemptions. Until this settles, " +
      "keep both: pull the CDLIS MVR, and keep any paper certificate the driver still has.",
      { size: 9, lead: 11.5, after: 4 }
    );
  }

  D.h2("The recurring items");
  D.text(
    "These recurring items must be tracked from the date each underlying action was actually completed. The hire date does " +
    "not automatically become the annual MVR-review date or Clearinghouse-query date.",
    { size: 9, lead: 11.5, after: 4 }
  );
  var recurringRows = [
    ["Motor vehicle record and annual review", "Every 12 months", "391.25", "From actual review date"],
    ["Driver's licence", "At expiration", "391.11(b)(5)", "Use credential date"],
    [d.cdl ? "Medical certification, via CDLIS MVR" : "Medical examiner's certificate",
     "Up to 24 months", "391.45", "Use actual expiration"]
  ];
  if (d.cdl) {
    recurringRows.splice(1, 0, ["Clearinghouse query", "Every 12 months", "382.701(b)", "From actual query date"]);
  }
  D.table(
    [{ head: "Item", w: 0.32 }, { head: "Interval", w: 0.2 }, { head: "Requirement", w: 0.2 }, { head: "Next due", w: 0.28 }],
    recurringRows
  );

  D.callout(
    "Tracking the applicable dates across a fleet is what We Heart Paperwork does — $2 a month for the company plus $1 per " +
    "active driver. The documents in this packet are yours to keep either way."
  );
  D.disclaimer(d);
};

/* ------------------------------------------------------------------ build -- */

function addDays(iso, n) {
  if (!iso) return "";
  var p = iso.split("-");
  var dt = new Date(+p[0], +p[1] - 1, +p[2]);
  dt.setDate(dt.getDate() + n);
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
}

/** Decide which documents this driver needs. Returns [{key,label,why}] */
function plan(d) {
  var out = [];
  out.push({ key: "cover", label: "Driver qualification file index", why: "391.51(b) — what this driver's file must contain, with retention dates" });
  out.push({ key: "application", label: "Driver's application for employment", why: "391.21(b) — all twelve required elements including the 10-year history" });

  if (d.priorEmployers !== "no") {
    out.push({ key: "history", label: "Safety performance history request and driver release", why: "391.23(d), (e), (f) — sent to each DOT-regulated employer in the past 3 years" });
  }
  out.push({ key: "goodFaith", label: "Record of contact with previous employers", why: "391.23(c)(2) — the proof-you-tried document almost nobody keeps" });

  if (d.roadTestPath === "cdl") {
    out.push({ key: "cdlEquivalent", label: "CDL copy accepted as the road-test equivalent", why: "391.33(a)(1), (b) — normally no new road test; doubles, triples and tanks are exceptions" });
  } else {
    out.push({ key: "roadTestForm", label: "Road test examiner's rating form", why: "391.31(c), (d) — all eight operations that must be tested" });
    out.push({ key: "roadTestCert", label: "Certificate of driver's road test", why: "391.31(f) — in the form the regulation prescribes" });
  }

  out.push({ key: "annualReview", label: "Annual review of driving record", why: "391.25(c)(2) — reviewer name and review date, the elements most often missing" });
  if (!d.cdl) {
    out.push({ key: "registryNote", label: "National Registry verification note", why: "391.23(m)(1), 391.51(b)(8)(i) — still required for non-CDL drivers" });
  }
  if (d.cdl) {
    out.push({ key: "policyReceipt", label: "Drug and alcohol materials receipt", why: "382.601 — receipt and content checklist; the carrier must separately provide the actual materials" });
    out.push({ key: "chConsent", label: "Clearinghouse limited query consent", why: "382.701(b) — general consent for the annual query" });
  }
  out.push({ key: "actions", label: "Action plan", why: "The Clearinghouse and testing steps no form can satisfy" });
  return out;
}

function derive(data) {
  var d = {};
  for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) d[k] = data[k];
  var now = new Date();
  d.today = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  d.deadline30 = d.hireDate ? addDays(d.hireDate, 30) : "";
  d.nextReview = "";
  // A valid CDL covering the assigned vehicle may substitute for the road test,
  // even when the particular assignment does not itself require a CDL.
  d.roadTestPath = (d.hasCdl && !d.endDoubles && !d.endTank) ? "cdl" : "test";
  return d;
}

async function buildPacket(data) {
  var L = global.PDFLib;
  INK = L.rgb(0.078, 0.094, 0.106);
  GREY = L.rgb(0.42, 0.46, 0.48);
  RULE = L.rgb(0.72, 0.75, 0.74);
  LIGHT = L.rgb(0.85, 0.87, 0.86);

  var d = derive(data);
  var pdf = await L.PDFDocument.create();
  pdf.setTitle("Driver Qualification File — " + (d.driverName || "Driver"));
  pdf.setSubject("49 CFR Part 391 driver qualification documents");
  pdf.setCreator("We Heart Paperwork · weheartpaperwork.com");
  pdf.setProducer("We Heart Paperwork");

  var fonts = {
    reg: await pdf.embedFont(L.StandardFonts.Helvetica),
    bold: await pdf.embedFont(L.StandardFonts.HelveticaBold),
    ital: await pdf.embedFont(L.StandardFonts.HelveticaOblique)
  };

  var D = new Doc(pdf, fonts);
  var list = plan(d);
  for (var i = 0; i < list.length; i++) DOCS[list[i].key](D, d);

  return { bytes: await pdf.save(), pages: pdf.getPageCount(), plan: list, derived: d };
}

global.DQ = { buildPacket: buildPacket, plan: plan, derive: derive, fmtDate: fmtDate };

})(window);
